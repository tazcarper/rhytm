import { Badge } from "@/lib/ui";
import type { BadgeVariant } from "@/lib/ui";
import type { AdminBidStatus } from "@/src/services/admin/bids";

const STATUS_TO_VARIANT: Record<AdminBidStatus, BadgeVariant> = {
  pending_review: "filling",
  confirmed: "open",
  signed: "tierCharter",
  paid: "open",
  denied: "full",
  expired: "full",
};

const STATUS_LABEL: Record<AdminBidStatus, string> = {
  pending_review: "Pending review",
  confirmed: "Confirmed",
  signed: "Signed",
  paid: "Paid",
  denied: "Denied",
  expired: "Expired",
};

export function BidStatusBadge({ status }: { status: AdminBidStatus }) {
  return <Badge variant={STATUS_TO_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function bidStatusLabel(status: AdminBidStatus): string {
  return STATUS_LABEL[status];
}
