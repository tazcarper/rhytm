"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/lib/ui";
import type { PublicAdventure } from "@/src/services/public/adventures";
import type { RsvpStatus } from "@/src/services/members/adventures";
import { adventurePriceLabel } from "@/src/services/adventures/display";
import s from "./reserve-bar.module.css";

export interface ReserveState {
  isMember: boolean;
  membershipId: string | null;
  existingRsvp: { status: RsvpStatus; guestCount: number } | null;
}

// Hide-on-scroll-down / show-on-scroll-up. The state always updates, but
// CSS only acts on data-hidden under the mobile media query — so desktop
// + tablet keep the bar pinned while mobile reclaims the space on the way
// down and brings it back on the way up.
function useHideOnScrollDown(): boolean {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (Math.abs(delta) < 8) return;
      setHidden(y > 120 && delta > 0);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return hidden;
}

// Sticky reserve module pinned to the bottom of the adventure detail page.
// Carries the same members-only gate the in-page panel used to; the form
// only renders for an eligible member.
export function ReserveBar({
  adventure,
  reserve,
}: {
  adventure: PublicAdventure;
  reserve: ReserveState;
}) {
  const hidden = useHideOnScrollDown();

  return (
    <div className={s.bar} data-hidden={hidden}>
      <div className={s.inner}>
        <BarContent adventure={adventure} reserve={reserve} />
      </div>
    </div>
  );
}

function BarContent({
  adventure,
  reserve,
}: {
  adventure: PublicAdventure;
  reserve: ReserveState;
}) {
  const { isMember, membershipId, existingRsvp } = reserve;
  const priceLabel = adventurePriceLabel({
    price: adventure.pricing.price,
    guestPrice: adventure.pricing.guestPrice,
    priceLabel: adventure.priceLabel,
  });

  if (adventure.comingSoon) {
    return (
      <Summary label="Coming soon" note="Members hear first" />
    );
  }

  if (existingRsvp) {
    const guests = `${existingRsvp.guestCount} ${existingRsvp.guestCount === 1 ? "guest" : "guests"}`;
    // Waitlisted + a spot is now open → invite them to claim it.
    if (existingRsvp.status === "waitlisted" && !adventure.isSoldOut) {
      return (
        <>
          <Summary label="A spot’s open" note="Reserve before it’s taken" />
          <div className={s.action}>
            <Button asChild variant="primary" size="md">
              <Link href={`/adventures/${adventure.id}/reserve`}>Reserve your spot</Link>
            </Button>
          </div>
        </>
      );
    }
    return (
      <>
        <Summary
          label={existingRsvp.status === "confirmed" ? "✓ You’re going" : "You’re waitlisted"}
          note={guests}
        />
        <div className={s.action}>
          <Button asChild variant="secondary" size="md">
            <Link href="/member/adventures">My adventures &rarr;</Link>
          </Button>
        </div>
      </>
    );
  }

  if (adventure.isSoldOut) {
    return (
      <>
        <Summary label="Fully reserved" note="Join the waitlist — we'll email you if a spot opens" />
        <div className={s.action}>
          {isMember && membershipId ? (
            <Button asChild variant="primary" size="md">
              <Link href={`/adventures/${adventure.id}/reserve`}>Join the waitlist</Link>
            </Button>
          ) : !isMember ? (
            <Button asChild variant="secondary" size="md">
              <Link href="/login">Members&rsquo; Entrance</Link>
            </Button>
          ) : null}
        </div>
      </>
    );
  }

  if (isMember && membershipId) {
    const ctaLabel =
      adventure.paymentMode === "inquire"
        ? "Request to reserve"
        : adventure.paymentMode === "deposit"
          ? "Reserve · deposit"
          : "Reserve & pay";
    return (
      <>
        <Summary label="Reserve your place" note={priceLabel} />
        <div className={s.action}>
          <Button asChild variant="primary" size="lg">
            <Link href={`/adventures/${adventure.id}/reserve`}>{ctaLabel}</Link>
          </Button>
        </div>
      </>
    );
  }

  if (isMember) {
    return <Summary label="Members only" note={`Reserved for members of ${adventure.propertyName}`} />;
  }

  return (
    <>
      <Summary label="A members’ privilege" note={priceLabel} />
      <div className={s.action}>
        <Button asChild variant="primary" size="lg">
          <Link href="/login">Sign in to reserve</Link>
        </Button>
      </div>
    </>
  );
}

function Summary({ label, note }: { label: string; note?: string }) {
  return (
    <div className={s.summary}>
      <span className={s.summaryLabel}>{label}</span>
      {note && <span className={s.summaryNote}>{note}</span>}
    </div>
  );
}
