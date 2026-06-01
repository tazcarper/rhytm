import { Badge } from "@/lib/ui";
import type { BadgeVariant } from "@/lib/ui";
import type { MembershipStatus } from "@/src/services/admin/members";

const STATUS_TO_VARIANT: Record<MembershipStatus, BadgeVariant> = {
  pending: "filling", // amber — application awaiting approval
  active: "open", // green — in good standing
  inactive: "past", // gray — manually deactivated
  lapsed: "waitlist", // orange — dues not paid
  suspended: "full", // red — staff suspension
};

const STATUS_LABEL: Record<MembershipStatus, string> = {
  pending: "Pending",
  active: "Active",
  inactive: "Inactive",
  lapsed: "Lapsed",
  suspended: "Suspended",
};

export function MembershipStatusBadge({ status }: { status: MembershipStatus }) {
  return <Badge variant={STATUS_TO_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function membershipStatusLabel(status: MembershipStatus): string {
  return STATUS_LABEL[status];
}
