import { Badge } from "@/lib/ui";
import type { BadgeVariant } from "@/lib/ui";
import type { AdminBookingStatus } from "@/src/services/admin/bookings";

const STATUS_TO_VARIANT: Record<AdminBookingStatus, BadgeVariant> = {
  pending_review: "filling",
  awaiting_guest: "waitlist",
  signed: "tierCharter",
  deposit_paid: "open",
  fulfilled: "past",
  denied: "full",
  cancelled: "full",
  expired: "past",
};

const STATUS_LABEL: Record<AdminBookingStatus, string> = {
  pending_review: "Pending review",
  awaiting_guest: "Awaiting guest",
  signed: "Signed",
  deposit_paid: "Deposit paid",
  fulfilled: "Fulfilled",
  denied: "Denied",
  cancelled: "Cancelled",
  expired: "Expired",
};

export function BookingStatusBadge({ status }: { status: AdminBookingStatus }) {
  return <Badge variant={STATUS_TO_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function bookingStatusLabel(status: AdminBookingStatus): string {
  return STATUS_LABEL[status];
}
