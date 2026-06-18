import type { SupabaseClient } from "@supabase/supabase-js";
import { toNumber } from "@/src/services/public/format";

// Source-tagged audit of every bookings.confirmed_price change. Three writers —
// the manual PricingEditor path (updateBidPricing), the per-line override path
// (apply_line_override RPC), and the automatic comp reversal when an add-on is
// re-materialized (reverse_add_on_comps RPC) — all append here, so the admin
// timeline can always tell which mechanism made a given change. Append-only;
// writes require the service role (bid_pricing_events is service-role-write
// only). The override/auto-reversal events are written inside their Postgres
// functions, in the same transaction as the price change they record.

export type PricingEventSource = "manual" | "line_override" | "auto_reversal";

// The per-line detail for a line_override event, joined from the linked
// override row. reason is ADMIN-ONLY (the history panel is admin-only).
export interface PricingEventOverrideDetail {
  lineLabel: string | null;
  originalAmount: number;
  newAmount: number;
  reason: string;
  customerFacingLabel: string | null;
}

export interface PricingEvent {
  id: string;
  source: PricingEventSource;
  oldTotal: number | null;
  newTotal: number | null;
  actorEmail: string;
  note: string | null;
  createdAt: string;
  // Present for source === "line_override".
  override: PricingEventOverrideDetail | null;
}

export interface RecordPricingEventParams {
  bookingId: string;
  source: PricingEventSource;
  lineOverrideId?: string | null;
  oldTotal: number | null;
  newTotal: number | null;
  actorId: string;
  actorEmail: string;
  note?: string | null;
}

// Append one audit row. Best-effort within its caller's transaction-less flow:
// the price change itself is already persisted, so a failed audit insert must
// not roll it back — we surface failures to the server log, not the user.
export async function recordPricingEvent(
  serviceClient: SupabaseClient,
  params: RecordPricingEventParams,
): Promise<void> {
  const { error } = await serviceClient.from("bid_pricing_events").insert({
    booking_id: params.bookingId,
    source: params.source,
    line_override_id: params.lineOverrideId ?? null,
    old_total: params.oldTotal,
    new_total: params.newTotal,
    actor_id: params.actorId,
    actor_email: params.actorEmail,
    note: params.note ?? null,
  });
  if (error) {
    console.error("[pricing-events] failed to record event", error.message);
  }
}

// PostgREST returns a to-one embed as an object or a single-element array
// depending on relationship metadata; normalize both.
function firstEmbed<T>(embedded: unknown): T | null {
  if (Array.isArray(embedded)) return (embedded[0] as T) ?? null;
  return (embedded as T) ?? null;
}

type PricingEventRow = {
  id: string;
  source: PricingEventSource;
  old_total: string | number | null;
  new_total: string | number | null;
  actor_email: string;
  note: string | null;
  created_at: string;
  bid_line_overrides: unknown;
};

type OverrideEmbed = {
  original_amount: string | number;
  new_amount: string | number;
  reason: string;
  customer_facing_label: string | null;
  bid_line_items: unknown;
};

// Every pricing event for a booking, newest first, with per-line detail joined
// for override entries. Reads through the caller's RLS scope (staff only).
export async function getPricingEvents(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<PricingEvent[]> {
  const { data, error } = await supabase
    .from("bid_pricing_events")
    .select(
      `
      id, source, old_total, new_total, actor_email, note, created_at,
      bid_line_overrides (
        original_amount, new_amount, reason, customer_facing_label,
        bid_line_items ( label )
      )
      `,
    )
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  return (data as PricingEventRow[]).map((row) => {
    const embed = firstEmbed<OverrideEmbed>(row.bid_line_overrides);
    const override: PricingEventOverrideDetail | null = embed
      ? {
          lineLabel:
            firstEmbed<{ label: string }>(embed.bid_line_items)?.label ?? null,
          originalAmount: toNumber(embed.original_amount) ?? 0,
          newAmount: toNumber(embed.new_amount) ?? 0,
          reason: embed.reason,
          customerFacingLabel: embed.customer_facing_label,
        }
      : null;
    return {
      id: row.id,
      source: row.source,
      oldTotal: toNumber(row.old_total),
      newTotal: toNumber(row.new_total),
      actorEmail: row.actor_email,
      note: row.note,
      createdAt: row.created_at,
      override,
    };
  });
}
