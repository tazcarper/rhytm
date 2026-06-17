import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPublicPricingForProperty,
  buildBookingSummary,
} from "@/src/services/public/pricing";
import type { BookingType } from "@/src/components/public/booking-flow/booking-flow-types";

// A bid's price, materialized as real lines.
//
// A bid stores opaque totals (bookings.estimated_price / confirmed_price) plus
// booking_add_ons. This service decomposes a bid into bid_line_items rows using
// the SAME computation the public funnel shows (buildBookingSummary) for the
// base + guest-fee lines, and the booking_add_ons snapshots for add-on lines.
//
// The lines are a point-in-time SNAPSHOT of the quote, not a live view:
//   * The base + guest-fee lines are built ONCE at creation, while the bid is
//     pending_review, from the pricing model the customer was quoted against.
//     They are never recomputed afterward — recomputing would re-read live
//     pricing and silently drift from what the guest saw. See FULL_BUILD_*.
//   * The add-on lines mirror booking_add_ons, which staff can edit through
//     `confirmed`. They are rebuilt from those price snapshots on each edit
//     (drift-free — the unit price is the stored snapshot, not live). See the
//     ADD_ON_EDIT window, which matches ADD_ON_EDITABLE_STATUSES in the
//     add-ons Server Action.
//   * Reads NEVER materialize (no write-on-read). Old bids are backfilled by
//     the backfill_bid_line_items() SQL function (see the RLS+backfill
//     migration), not lazily on view.
//
// Writes require the service role (bid_line_items is service-role-write only).

// Full (re)build — base + guest-fee from the pricing model — only at creation.
const FULL_BUILD_STATUSES: ReadonlySet<string> = new Set(["pending_review"]);

// Add-on lines may change while staff can still edit the bid's add-ons. Keep
// in sync with ADD_ON_EDITABLE_STATUSES in app/admin/bids/[id]/add-ons-actions.
const ADD_ON_EDIT_STATUSES: ReadonlySet<string> = new Set([
  "pending_review",
  "confirmed",
]);

export type LineItemKind =
  | "base_experience"
  | "guest_fee"
  | "add_on"
  | "instructor"
  | "fee"
  | "other";

export type LineItemTaxStatus = "taxable" | "exempt";

export interface BidLineItem {
  id: string;
  kind: LineItemKind;
  label: string;
  quantity: number;
  unitAmount: number;
  lineAmount: number;
  taxStatus: LineItemTaxStatus;
  sortOrder: number;
}

type LineInsert = {
  booking_id: string;
  kind: LineItemKind;
  label: string;
  quantity: number;
  unit_amount: number;
  line_amount: number;
  tax_status: LineItemTaxStatus;
  source_service_id: string | null;
  source_add_on_id: string | null;
  sort_order: number;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

// add_on lines start after the base (0) and guest-fee (1) lines.
const ADD_ON_SORT_OFFSET = 2;

// PostgREST returns an embedded to-one relation as either an object or a
// single-element array depending on the relationship metadata; normalize both.
function addOnName(embedded: unknown): string {
  const rel = Array.isArray(embedded) ? embedded[0] : embedded;
  const name = (rel as { name?: unknown } | null)?.name;
  return typeof name === "string" && name.length > 0 ? name : "Add-on";
}

// The add-on portion of a bid's lines, sourced from the booking_add_ons price
// snapshots (authoritative — never live pricing, so drift-free). Used both in
// the full creation build and in the add-on-only rebuild on edit.
async function computeAddOnLines(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<LineInsert[]> {
  const { data: addOnRows } = await supabase
    .from("booking_add_ons")
    .select("service_id, add_on_id, quantity, unit_price_at_booking, add_ons(name)")
    .eq("booking_id", bookingId);

  return (addOnRows ?? []).map((row, index) => {
    const unit = Number(row.unit_price_at_booking) || 0;
    const qty = Number(row.quantity) || 0;
    return {
      booking_id: bookingId,
      kind: "add_on" as const,
      label: addOnName(row.add_ons),
      quantity: qty,
      unit_amount: round2(unit),
      line_amount: round2(unit * qty),
      tax_status: "taxable" as const,
      source_service_id: (row.service_id as string) ?? null,
      source_add_on_id: (row.add_on_id as string) ?? null,
      sort_order: ADD_ON_SORT_OFFSET + index,
    };
  });
}

// Compute the FULL line set for a booking from its stored shape — base +
// guest-fee (from the pricing model, captured at creation as the quote
// snapshot) plus the add-on lines. Returns the rows to insert (does not
// write). Returns null when the booking row can't be loaded.
async function computeLines(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<LineInsert[] | null> {
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      "id, booking_type, guest_count, junior_guest_count, duration_hours, property_id",
    )
    .eq("id", bookingId)
    .single();
  if (error || !booking) return null;

  const bookingType = booking.booking_type as BookingType;
  const lines: LineInsert[] = [];

  // ---- base experience + guest fee (from the pricing model) ----
  const { data: pricingByType } = await getPublicPricingForProperty(
    booking.property_id as string,
  );
  const pricing = pricingByType?.[bookingType] ?? null;

  const summary = buildBookingSummary({
    bookingType,
    pricing,
    guestCount: booking.guest_count as number,
    juniorGuestCount: (booking.junior_guest_count as number | null) ?? 0,
    durationHours: booking.duration_hours as number,
    selections: [],
    services: [],
  });

  if (!summary.isTeamQuoted && summary.baseAmount !== null) {
    lines.push({
      booking_id: bookingId,
      kind: "base_experience",
      label: summary.baseLabel,
      quantity: 1,
      unit_amount: round2(summary.baseAmount),
      line_amount: round2(summary.baseAmount),
      tax_status: "taxable",
      source_service_id: null,
      source_add_on_id: null,
      sort_order: 0,
    });
  }

  if (summary.guestFeeAmount > 0) {
    lines.push({
      booking_id: bookingId,
      kind: "guest_fee",
      label: summary.guestFeeLabel ?? "Guest fee",
      quantity: 1,
      unit_amount: round2(summary.guestFeeAmount),
      line_amount: round2(summary.guestFeeAmount),
      tax_status: "taxable",
      source_service_id: null,
      source_add_on_id: null,
      sort_order: 1,
    });
  }

  // ---- add-on lines (from the booking_add_ons snapshots — authoritative) ----
  lines.push(...(await computeAddOnLines(supabase, bookingId)));

  return lines;
}

// The outcome of a (re)materialization. `subtotal` is the sum of the freshly
// computed lines — the caller (e.g. the creation hook) reconciles it against
// the stored estimate. `skipped` distinguishes the two no-op cases from a
// genuine write failure.
export interface MaterializeResult {
  ok: boolean;
  count: number;
  subtotal: number;
  skipped?: "frozen" | "unpriceable";
}

// The bid's current workflow status, or null when no bid row exists yet
// (shouldn't happen post-create). Centralizing this read keeps the snapshot
// lifecycle rules in one place — callers don't reason about statuses.
async function getBidStatus(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("bids")
    .select("status")
    .eq("booking_id", bookingId)
    .maybeSingle<{ status: string }>();
  return data?.status ?? null;
}

// Full materialize of a booking's line items: delete any existing rows and
// insert a freshly computed set (base + guest-fee + add-ons). The creation
// path. No-ops (leaving existing rows untouched) once the bid is past
// pending_review, so a stray later call can't recompute base/guest-fee from
// live pricing and silently rewrite the quoted snapshot.
export async function materializeBidLineItems(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<MaterializeResult> {
  const status = await getBidStatus(supabase, bookingId);
  // A missing bid row is treated as buildable so creation is never blocked.
  if (status !== null && !FULL_BUILD_STATUSES.has(status)) {
    return { ok: false, count: 0, subtotal: 0, skipped: "frozen" };
  }

  const lines = await computeLines(supabase, bookingId);
  if (lines === null) {
    return { ok: false, count: 0, subtotal: 0, skipped: "unpriceable" };
  }

  const subtotal = round2(
    lines.reduce((sum, line) => sum + line.line_amount, 0),
  );

  await supabase.from("bid_line_items").delete().eq("booking_id", bookingId);
  if (lines.length === 0) return { ok: true, count: 0, subtotal: 0 };

  const { error } = await supabase.from("bid_line_items").insert(lines);
  if (error) return { ok: false, count: 0, subtotal };
  return { ok: true, count: lines.length, subtotal };
}

// Rebuild ONLY the add_on lines from the current booking_add_ons snapshots,
// leaving the base/guest-fee snapshot intact. Called after an add-on edit.
// Drift-free: add-on amounts come from the stored unit_price_at_booking, never
// live pricing. No-ops once the bid is past the add-on edit window.
export async function rematerializeAddOnLines(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<MaterializeResult> {
  const status = await getBidStatus(supabase, bookingId);
  if (status !== null && !ADD_ON_EDIT_STATUSES.has(status)) {
    return { ok: false, count: 0, subtotal: 0, skipped: "frozen" };
  }

  const addOnLines = await computeAddOnLines(supabase, bookingId);
  const subtotal = round2(
    addOnLines.reduce((sum, line) => sum + line.line_amount, 0),
  );

  await supabase
    .from("bid_line_items")
    .delete()
    .eq("booking_id", bookingId)
    .eq("kind", "add_on");
  if (addOnLines.length === 0) return { ok: true, count: 0, subtotal: 0 };

  const { error } = await supabase.from("bid_line_items").insert(addOnLines);
  if (error) return { ok: false, count: 0, subtotal };
  return { ok: true, count: addOnLines.length, subtotal };
}

// Read the materialized lines for a booking, ordered for display. Pure read —
// never materializes (see backfill_bid_line_items() for old bids). Reads
// through the caller's RLS scope.
export async function getBidLineItems(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<BidLineItem[]> {
  const { data, error } = await supabase
    .from("bid_line_items")
    .select("id, kind, label, quantity, unit_amount, line_amount, tax_status, sort_order")
    .eq("booking_id", bookingId)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id as string,
    kind: row.kind as LineItemKind,
    label: row.label as string,
    quantity: Number(row.quantity),
    unitAmount: Number(row.unit_amount),
    lineAmount: Number(row.line_amount),
    taxStatus: row.tax_status as LineItemTaxStatus,
    sortOrder: row.sort_order as number,
  }));
}
