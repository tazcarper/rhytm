"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Card } from "@/lib/ui";
import type { MyAdventureTrip } from "@/src/services/members/adventures";
import {
  adventureDateLabel,
  adventurePriceLabel,
} from "@/src/services/adventures/display";
import { formatMoney } from "@/src/services/public/format";
import { cancelMyAdventureRsvpAction } from "@/app/(public)/adventures/[id]/reserve/actions";
import { GuestManifestEditor } from "./guest-manifest-editor";

// One "my trip" card. Shows the member's RSVP status + links to the public
// detail page, and lets them cancel (windowed refund per the adventure's
// policy). Read-everything-else; the cancel is the only write.
function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const start = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((start - today) / 86_400_000);
}

export function MyAdventureCard({ trip }: { trip: MyAdventureTrip }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  const paid = trip.amountPaid ?? 0;
  const withinWindow = daysUntil(trip.startDate) < trip.freeCancellationDays;
  const refundMsg =
    paid > 0
      ? withinWindow
        ? `This is inside the ${trip.freeCancellationDays}-day cancellation window — your $${formatMoney(paid)} is non-refundable.`
        : `You'll be refunded $${formatMoney(paid)}.`
      : "This frees your spot.";

  const cancel = () => {
    if (!window.confirm(`Cancel your reservation for ${trip.title}?\n\n${refundMsg}`)) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelMyAdventureRsvpAction(trip.rsvpId);
      if (!result.ok) {
        setError(result.message ?? "Couldn't cancel — contact the concierge.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <Card padding="loose">
      {error && (
        <Alert variant="error" title="Couldn't cancel">
          {error}
        </Alert>
      )}
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

      <Link
        href={`/adventures/${trip.adventureId}`}
        className="font-serif text-[22px] text-olive italic leading-tight no-underline hover:underline"
      >
        {trip.title}
      </Link>

      {metaParts.length > 0 && (
        <div className="font-sans text-[13px] text-gray tracking-[0.3px] mt-1">
          {metaParts.join("  ·  ")}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3 pt-3 mt-3 border-t border-rule">
        <span className="font-mono text-[14px] text-olive">{priceLabel}</span>
        <div className="flex items-center gap-3">
          <Link
            href={`/adventures/${trip.adventureId}`}
            className="font-sans text-[11px] text-tan-deep tracking-[1px] uppercase no-underline hover:text-olive"
          >
            View details &rarr;
          </Link>
          <button
            type="button"
            onClick={cancel}
            disabled={isPending}
            className="font-sans text-[11px] tracking-[1px] uppercase text-[color:var(--error)] disabled:opacity-40"
          >
            {isPending ? "Cancelling…" : "Cancel"}
          </button>
        </div>
      </div>

      {going && (
        <GuestManifestEditor
          rsvpId={trip.rsvpId}
          guestCount={trip.guestCount}
          initialGuests={trip.guests}
        />
      )}
    </Card>
  );
}
