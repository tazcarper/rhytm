import type { SupabaseClient } from "@supabase/supabase-js";

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

function toNumber(value: string | number | null): number {
  if (value === null) return 0;
  return typeof value === "string" ? parseFloat(value) : value;
}

function mapOverride(row: OverrideRow): BidLineOverride {
  return {
    id: row.id,
    bookingId: row.booking_id,
    lineItemId: row.line_item_id,
    originalAmount: toNumber(row.original_amount),
    newAmount: toNumber(row.new_amount),
    delta: toNumber(row.delta),
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
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as OverrideRow[]).map(mapOverride);
}

// The EFFECTIVE override per line: its most recent row. The table is
// append-only, so a line can carry several rows over time (e.g. a comp then a
// reversing entry); only the latest one is in force. Keyed by lineItemId.
export function latestOverridesByLine(
  overrides: ReadonlyArray<BidLineOverride>,
): Map<string, BidLineOverride> {
  const latest = new Map<string, BidLineOverride>();
  for (const override of overrides) {
    const current = latest.get(override.lineItemId);
    if (!current || override.createdAt > current.createdAt) {
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

// Roll the latest-per-line overrides into the figures the queue flag and
// dashboard card show. A line whose latest row is a reversing entry (delta 0)
// is not counted as active and contributes 0.
export function summarizeOverrides(
  overrides: ReadonlyArray<BidLineOverride>,
): OverrideSummary {
  const latest = latestOverridesByLine(overrides);
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
