import { Badge } from "@/lib/ui";
import type { BadgeVariant } from "@/lib/ui";
import type { AdminBidStatus } from "@/src/services/admin/bids";

// Color taxonomy: lifecycle progresses amber → cool → green; terminals
// branch by reason (failure red / passive gray / deliberate tan). See
// the project's badge stylesheet for the actual hexes.
const STATUS_TO_VARIANT: Record<AdminBidStatus, BadgeVariant> = {
  pending_review: "filling",      // amber — needs staff action
  confirmed: "tierCharter",        // slate blue — active, customer's turn
  signed: "tierMember",            // deep olive — progress milestone
  paid: "open",                    // green — the financial milestone
  refunded: "draft",               // tan — deliberate terminal, not a failure
  denied: "full",                  // red — staff rejection (true failure)
  expired: "past",                 // gray — passive timeout
};

const STATUS_LABEL: Record<AdminBidStatus, string> = {
  pending_review: "Pending review",
  confirmed: "Confirmed",
  signed: "Signed",
  paid: "Paid",
  refunded: "Refunded",
  denied: "Denied",
  expired: "Expired",
};

// "Stage" presentation collapses the active sub-statuses — confirmed,
// signed, paid — into a single "Confirmed" badge. Rationale: in a Status
// column, a "Signed" badge reads like a distinct lifecycle state and makes
// people wonder whether the booking is still confirmed. Signing and paying
// are sub-steps of a confirmed booking, not statuses of their own — the
// per-row progress checkboxes carry that detail. The exact-status
// presentation stays the default for surfaces that want the precise state
// (e.g. the bid detail page).
const STAGE_LABEL: Record<AdminBidStatus, string> = {
  pending_review: "Pending review",
  confirmed: "Confirmed",
  signed: "Confirmed",
  paid: "Confirmed",
  refunded: "Refunded",
  denied: "Denied",
  expired: "Expired",
};

// Active sub-statuses share one variant so they're visually identical in
// the column — the whole point is that they read as the same stage.
const STAGE_VARIANT: Record<AdminBidStatus, BadgeVariant> = {
  pending_review: "filling",
  confirmed: "tierCharter",
  signed: "tierCharter",
  paid: "tierCharter",
  refunded: "draft",
  denied: "full",
  expired: "past",
};

export type BidStatusDisplay = "exact" | "stage";

export function BidStatusBadge({
  status,
  display = "exact",
}: {
  status: AdminBidStatus;
  display?: BidStatusDisplay;
}) {
  if (display === "stage") {
    return <Badge variant={STAGE_VARIANT[status]}>{STAGE_LABEL[status]}</Badge>;
  }
  return <Badge variant={STATUS_TO_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function bidStatusLabel(status: AdminBidStatus): string {
  return STATUS_LABEL[status];
}
