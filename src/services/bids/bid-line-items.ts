import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  getPublicPricingForProperty,
  buildBookingSummary,
} from "@/src/services/public/pricing";
import type { BookingType } from "@/src/components/public/booking-flow/booking-flow-types";

// A bid's price, materialized as real lines.
//
// Today a bid stores opaque totals (bookings.estimated_price / confirmed_price)
// plus booking_add_ons. This service decomposes a bid into bid_line_items rows
// using the SAME computation the public funnel shows (buildBookingSummary) for
// the base + guest-fee lines, and the booking_add_ons snapshots for add-on
// lines. One materialization path, reused by:
//   * the creation hook (new bids get lines immediately), and
//   * ensureBidLineItems (idempotent backfill the first time a bid is read).
//
// Writes require the service role (bid_line_items is service-role-write only).

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

// Compute the line rows for a booking from its stored shape. Returns the
// rows to insert (does not write). Returns [] when the booking can't be
// priced into lines (e.g. team-quoted host bookings with no add-ons).
async function computeLines(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<LineInsert[] | null> {
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, booking_type, guest_count, duration_hours, property_id")
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
  const { data: addOnRows } = await supabase
    .from("booking_add_ons")
    .select("service_id, add_on_id, quantity, unit_price_at_booking, add_ons(name)")
    .eq("booking_id", bookingId);

  let sort = 2;
  for (const row of addOnRows ?? []) {
    const unit = Number(row.unit_price_at_booking) || 0;
    const qty = Number(row.quantity) || 0;
    const name =
      (row.add_ons as { name?: string } | { name?: string }[] | null) &&
      (Array.isArray(row.add_ons) ? row.add_ons[0]?.name : (row.add_ons as { name?: string })?.name);
    lines.push({
      booking_id: bookingId,
      kind: "add_on",
      label: name || "Add-on",
      quantity: qty,
      unit_amount: round2(unit),
      line_amount: round2(unit * qty),
      tax_status: "taxable",
      source_service_id: (row.service_id as string) ?? null,
      source_add_on_id: (row.add_on_id as string) ?? null,
      sort_order: sort++,
    });
  }

  return lines;
}

// Force-(re)materialize a booking's line items: delete any existing rows and
// insert a freshly computed set. Idempotent. Service-role client required.
export async function materializeBidLineItems(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<{ ok: boolean; count: number }> {
  const lines = await computeLines(supabase, bookingId);
  if (lines === null) return { ok: false, count: 0 };

  await supabase.from("bid_line_items").delete().eq("booking_id", bookingId);
  if (lines.length === 0) return { ok: true, count: 0 };

  const { error } = await supabase.from("bid_line_items").insert(lines);
  if (error) return { ok: false, count: 0 };
  return { ok: true, count: lines.length };
}

// Materialize only if the booking has no line items yet — the backfill path
// for bids created before this foundation. Cheap existence check first.
export async function ensureBidLineItems(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<void> {
  const { count } = await supabase
    .from("bid_line_items")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", bookingId);
  if ((count ?? 0) > 0) return;
  await materializeBidLineItems(supabase, bookingId);
}

// Read the materialized lines for a booking, ordered for display.
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
  return data.map((r) => ({
    id: r.id as string,
    kind: r.kind as LineItemKind,
    label: r.label as string,
    quantity: Number(r.quantity),
    unitAmount: Number(r.unit_amount),
    lineAmount: Number(r.line_amount),
    taxStatus: r.tax_status as LineItemTaxStatus,
    sortOrder: r.sort_order as number,
  }));
}

// Convenience: ensure-then-read using a fresh service-role client. For
// surfaces (admin bid detail) that want the breakdown without threading a
// service client through. Self-heals old bids on first view.
export async function getOrMaterializeBidLineItems(
  bookingId: string,
): Promise<BidLineItem[]> {
  const supabase = createServiceRoleClient();
  await ensureBidLineItems(supabase, bookingId);
  return getBidLineItems(supabase, bookingId);
}
