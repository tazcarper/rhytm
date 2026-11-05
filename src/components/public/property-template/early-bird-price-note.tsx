import type { EarlyBirdOffer } from "@/src/services/events/event-pricing";

// One line under an event's prices while early-bird pricing is running:
// how long it lasts and what the price goes up to after.

const CLUB_TIMEZONE = "America/Chicago";

function isMidnightInClubTime(date: Date): boolean {
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: CLUB_TIMEZONE,
  }).format(date);
  return time === "00:00";
}

// "Sign up by Saturday, October 31" when the cut-off is midnight (staff said
// "before Nov 1"), otherwise "Sign up before November 1, 5:00 PM".
export function formatEarlyBirdDeadline(endsAtIso: string): string {
  const endsAt = new Date(endsAtIso);
  if (isMidnightInClubTime(endsAt)) {
    const lastDay = new Date(endsAt.getTime() - 1);
    const day = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: CLUB_TIMEZONE,
    }).format(lastDay);
    return `Sign up by ${day}`;
  }
  const moment = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: CLUB_TIMEZONE,
  }).format(endsAt);
  return `Sign up before ${moment}`;
}

function formatPrice(value: number | null): string {
  // Same rule as the event detail pages' price display.
  return value === null ? "Free" : `$${value.toFixed(0)}`;
}

function regularPriceText(offer: EarlyBirdOffer): string {
  const member = formatPrice(offer.regularMemberPrice);
  const nonMember = formatPrice(offer.regularNonMemberPrice);
  return member === nonMember ? `${nonMember} after` : `${member} member / ${nonMember} non-member after`;
}

export function EarlyBirdPriceNote({ offer }: { offer: EarlyBirdOffer }) {
  return (
    <p className="mb-6 font-property-sans text-[13px] text-property-ink">
      <span className="mr-2 inline-block border border-property-ink/20 px-2 py-0.5 text-[11px] uppercase tracking-widest">
        Early-bird
      </span>
      {formatEarlyBirdDeadline(offer.endsAt)} — {regularPriceText(offer)}.
    </p>
  );
}
