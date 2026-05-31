import Link from "next/link";
import { Alert } from "@/lib/ui";
import type { MemberBookingRow } from "@/src/services/members/bookings";
import { MyBookingCard } from "./my-booking-card";

// Pure presentational list. Props in, JSX out — no auth or fetching.
// Reused by App 3.8 preview-as-member against admin-RLS-scoped data.
//
// Each card is wrapped in a Link to /member/bookings/[id]. The href
// is built here (in the list) rather than in the card so the card
// stays href-agnostic and the admin preview can mount the same card
// without the link wrapping if it ever needs to.
export function MyBookingsList({
  bookings,
  error,
}: {
  bookings: MemberBookingRow[];
  error?: { message: string } | null;
}) {
  if (error) {
    return (
      <Alert variant="error" title="Could not load bookings">
        {error.message}
      </Alert>
    );
  }

  if (bookings.length === 0) {
    return (
      <Alert variant="info" title="No bookings yet">
        Once anyone on your membership books a visit, lesson, or occasion,
        it will show up here.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {bookings.map((booking) => (
        <Link
          key={booking.id}
          href={`/member/bookings/${booking.id}`}
          className="block no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-tan rounded-card transition-transform hover:-translate-y-[1px]"
        >
          <MyBookingCard booking={booking} />
        </Link>
      ))}
    </div>
  );
}
