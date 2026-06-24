import type { SupabaseClient } from "@supabase/supabase-js";
import { toNumber } from "@/src/services/public/format";

// Per-line waive/comp overrides for a bid (Phase 1). Read + summarize helpers
// shared by the admin bid detail, the bids queue flag, and the dashboard card.
// The override math has ONE definition here so reconciliation, display, and the
// queue/dashboard counts can never disagree.
//
// `reason` is admin-only — it is selected here (these reads run under the staff
// RLS scope or the service role) but must never be threaded to a customer
// surface. The customer page derives its discount arithmetically and never
// touches this module.

export interface BidLineOverride {
  id: string;
  bookingId: string;
  lineItemId: string;
  originalAmount: number;
  newAmount: number;
  // Negative for a discount; 0 for a reversing entry.
  delta: number;
  reason: string; // ADMIN-ONLY
  customerFacingLabel: string | null;
  actorEmail: string;
  createdAt: string;
}

type OverrideRow = {
  id: string;
  booking_id: string;
  line_item_id: string;
  original_amount: string | number;
  new_amount: string | number;
  delta: string | number;
  reason: string;
  customer_facing_label: string | null;
  actor_email: string;
  created_at: string;
};

function mapOverride(row: OverrideRow): BidLineOverride {
  return {
    id: row.id,
    bookingId: row.booking_id,
    lineItemId: row.line_item_id,
    originalAmount: toNumber(row.original_amount) ?? 0,
    newAmount: toNumber(row.new_amount) ?? 0,
    delta: toNumber(row.delta) ?? 0,
    reason: row.reason,
    customerFacingLabel: row.customer_facing_label,
    actorEmail: row.actor_email,
    createdAt: row.created_at,
  };
}

// All override rows for a booking, newest first. Reads through the caller's RLS
// scope (staff only) — or bypasses it under the service role.
export async function getLineOverrides(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<BidLineOverride[]> {
  const { data, error } = await supabase
    .from("bid_line_overrides")
    .select(
      "id, booking_id, line_item_id, original_amount, new_amount, delta, reason, customer_facing_label, actor_email, created_at",
    )
    .eq("booking_id", bookingId)
    // `id` is the deterministic tie-breaker: two rows can share a created_at to
    // the microsecond, so without it "newest" would be ambiguous and the latest
    // -per-line pick below could disagree with the apply_line_override() RPC
    // (which orders the same way). Same ordering everywhere → one truth.
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error || !data) return [];
  return (data as OverrideRow[]).map(mapOverride);
}

// The EFFECTIVE override per line: its most recent row. The table is
// append-only, so a line can carry several rows over time (e.g. a comp then a
// reversing entry); only the latest one is in force. Keyed by lineItemId.
//
// Relies on the caller passing the rows in the deterministic newest-first order
// that getLineOverrides returns, so the FIRST row seen per line is the latest —
// no timestamp comparison needed (lexicographic string compare of timestamps is
// fragile across differing fractional precision).
export function latestOverridesByLine(
  overrides: ReadonlyArray<BidLineOverride>,
): Map<string, BidLineOverride> {
  const latest = new Map<string, BidLineOverride>();
  for (const override of overrides) {
    if (!latest.has(override.lineItemId)) {
      latest.set(override.lineItemId, override);
    }
  }
  return latest;
}

export interface OverrideSummary {
  // Lines with an in-force discount (latest row has a negative delta).
  activeCount: number;
  // Sum of the in-force per-line deltas (<= 0). The amount taken off the quote.
  totalDelta: number;
}

// Roll an already-computed latest-per-line map into the figures the queue flag,
// dashboard card, and quote breakdown show. A line whose latest row is a
// reversing entry (delta 0) is not counted as active and contributes 0.
// Callers that already hold the latest map (e.g. the quote-breakdown card, which
// also renders per line) pass it in so the rows are walked once, not twice.
export function summarizeLatest(
  latest: ReadonlyMap<string, BidLineOverride>,
): OverrideSummary {
  let activeCount = 0;
  let totalDelta = 0;
  for (const override of latest.values()) {
    if (override.delta < 0) {
      activeCount += 1;
      totalDelta += override.delta;
    }
  }
  return { activeCount, totalDelta: Math.round(totalDelta * 100) / 100 };
}

// Convenience for callers that only hold the raw rows (queue flag, dashboard).
export function summarizeOverrides(
  overrides: ReadonlyArray<BidLineOverride>,
): OverrideSummary {
  return summarizeLatest(latestOverridesByLine(overrides));
}
