import { Badge, Card } from "@/lib/ui";
import type {
  BidStatus,
  BookingStatus,
  BookingType,
  MemberBookingRow,
} from "@/src/services/members/bookings";
import {
  formatDateLongTz,
  formatMoney,
  formatSlotLabelTz,
} from "@/src/services/public/format";
import type { BadgeVariant } from "@/lib/ui/primitives/badge/badge";

// One booking card. Pure presentational — props in, JSX out. No data
// fetching, no auth.uid() lookups.
//
// Designed to be reused by App 3.8 (/admin/members/[id]/preview)
// against admin-RLS-scoped rows; see plan/app/app-4-member-portal.md
// Decision §1.

const BOOKING_TYPE_LABELS: Record<BookingType, string> = {
  plan_a_visit: "Plan a Visit",
  private_lesson: "Private Lesson",
  host_an_occasion: "Host an Occasion",
};

const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending_review: "Pending review",
  awaiting_guest: "Awaiting your action",
  denied: "Denied",
  signed: "Signed",
  deposit_paid: "Deposit paid",
  fulfilled: "Complete",
  cancelled: "Cancelled",
  expired: "Expired",
};

const BOOKING_STATUS_VARIANTS: Record<BookingStatus, BadgeVariant> = {
  pending_review: "draft",
  awaiting_guest: "filling",
  denied: "past",
  signed: "open",
  deposit_paid: "open",
  fulfilled: "past",
  cancelled: "past",
  expired: "past",
};

const BID_STATUS_LABELS: Record<BidStatus, string> = {
  pending_review: "Awaiting staff review",
  confirmed: "Quoted — ready to sign + pay",
  denied: "Denied by staff",
  signed: "Signed",
  paid: "Paid",
  expired: "Expired",
  refunded: "Refunded",
};

// Bookings in terminal states are de-emphasized but not hidden.
function isTerminal(status: BookingStatus): boolean {
  return (
    status === "denied" ||
    status === "cancelled" ||
    status === "expired" ||
    status === "fulfilled"
  );
}

function formatTotalPrice(pricing: MemberBookingRow["pricing"]): string {
  const total = pricing.confirmedPrice ?? pricing.estimatedPrice;
  if (total === null) return "—";
  return `$${formatMoney(total)}`;
}

export function MyBookingCard({ booking }: { booking: MemberBookingRow }) {
  const terminal = isTerminal(booking.status);
  const dateLabel = formatDateLongTz(booking.startTime, booking.property.timezone);
  const timeLabel = formatSlotLabelTz(booking.startTime, booking.property.timezone);

  return (
    <Card padding="loose" className={terminal ? "opacity-70" : undefined}>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
        <div>
          <div className="font-serif text-[20px] text-olive italic">
            {dateLabel}
          </div>
          <div className="text-gray text-[14px] mt-1">
            {timeLabel} &middot; {booking.durationHours}h &middot;{" "}
            {booking.property.name}
          </div>
        </div>
        <Badge variant={BOOKING_STATUS_VARIANTS[booking.status]}>
          {BOOKING_STATUS_LABELS[booking.status]}
        </Badge>
      </div>

      <div className="font-sans text-[13px] text-gray tracking-[0.5px] uppercase mb-3">
        {BOOKING_TYPE_LABELS[booking.bookingType]}
        {" · "}
        {booking.guestCount} {booking.guestCount === 1 ? "guest" : "guests"}
        {booking.instructor && (
          <>
            {" · "}
            with {booking.instructor.name}
          </>
        )}
      </div>

      {!booking.isMine && booking.bookedBy && (
        <p className="font-serif italic text-[14px] text-tan-deep m-0 mb-2">
          Booked by{" "}
          {booking.bookedBy.displayName ??
            `${booking.bookedBy.firstName ?? ""} ${
              booking.bookedBy.lastName ?? ""
            }`.trim()}
        </p>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-rule">
        <div className="font-mono text-[13px] text-olive">
          {formatTotalPrice(booking.pricing)}
          {booking.pricing.amountPaid > 0 && (
            <span className="text-gray ml-2 font-serif italic">
              · ${formatMoney(booking.pricing.amountPaid)} paid
            </span>
          )}
        </div>
        {booking.isMine && booking.bid && (
          <span className="font-sans text-[12px] text-gray tracking-[0.5px]">
            Bid: {BID_STATUS_LABELS[booking.bid.status]}
          </span>
        )}
      </div>
    </Card>
  );
}
