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

export function BidStatusBadge({ status }: { status: AdminBidStatus }) {
  return <Badge variant={STATUS_TO_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function bidStatusLabel(status: AdminBidStatus): string {
  return STATUS_LABEL[status];
}
