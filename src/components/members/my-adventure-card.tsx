import Link from "next/link";
import { Badge, Card } from "@/lib/ui";
import type { MyAdventureTrip } from "@/src/services/members/adventures";
import {
  adventureDateLabel,
  adventurePriceLabel,
} from "@/src/services/adventures/display";

// One "my trip" card for /member/adventures — read-only. Shows the
// member's RSVP status (going / waitlisted) on an adventure they've
// reserved. Links to the public detail page for the full write-up;
// sign-up + changes happen there. Visual language matches my-booking-card.
export function MyAdventureCard({ trip }: { trip: MyAdventureTrip }) {
  const going = trip.rsvpStatus === "confirmed";
  const dateLabel = adventureDateLabel(trip);
  const priceLabel = adventurePriceLabel({
    price: trip.price,
    guestPrice: trip.guestPrice,
    priceLabel: trip.priceLabel,
  });
  const guestLabel = `${trip.guestCount} ${trip.guestCount === 1 ? "guest" : "guests"}`;
  const metaParts = [trip.location, dateLabel, trip.durationLabel].filter(
    (part): part is string => !!part,
  );

  return (
    <Link
      href={`/adventures/${trip.adventureId}`}
      className="block no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-tan rounded-card transition-transform hover:-translate-y-[1px]"
    >
      <Card padding="loose">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
          {trip.category && (
            <div className="font-sans text-[12px] text-gray tracking-[0.5px] uppercase">
              {trip.category}
            </div>
          )}
          <Badge variant={going ? "open" : "waitlist"} pill>
            {going ? `✓ You’re going · ${guestLabel}` : `Waitlisted · ${guestLabel}`}
          </Badge>
        </div>

        <div className="font-serif text-[22px] text-olive italic leading-tight mb-2">
          {trip.title}
        </div>

        {metaParts.length > 0 && (
          <div className="font-sans text-[13px] text-gray tracking-[0.3px]">
            {metaParts.join("  ·  ")}
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-3 pt-3 mt-3 border-t border-rule">
          <span className="font-mono text-[14px] text-olive">{priceLabel}</span>
          <span className="font-sans text-[11px] text-tan-deep tracking-[1px] uppercase">
            View details &rarr;
          </span>
        </div>
      </Card>
    </Link>
  );
}
