// Which price is in force for an event right now. Pure — no clients, no
// clock of its own — so the public pages and the sign-up quote agree.

export interface EventPriceTiers {
  memberPrice: number | null;
  nonMemberPrice: number | null;
  // First calendar day ("YYYY-MM-DD", club timezone) the "after" prices apply.
  priceChangeOn: string | null;
  memberPriceAfter: number | null;
  nonMemberPriceAfter: number | null;
}

export interface EffectivePrices {
  memberPrice: number | null;
  nonMemberPrice: number | null;
}

// The clubs' timezone; matches the Chicago wall-clock handling in the
// admin events service.
export const CLUB_TIMEZONE = "America/Chicago";

// Today's calendar date ("YYYY-MM-DD") in the given timezone.
export function todayInTimezone(timezone: string = CLUB_TIMEZONE, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function effectivePrices(tiers: EventPriceTiers, today: string): EffectivePrices {
  const changed = tiers.priceChangeOn !== null && today >= tiers.priceChangeOn;
  if (!changed) return { memberPrice: tiers.memberPrice, nonMemberPrice: tiers.nonMemberPrice };
  return {
    memberPrice: tiers.memberPriceAfter ?? tiers.memberPrice,
    nonMemberPrice: tiers.nonMemberPriceAfter ?? tiers.nonMemberPrice,
  };
}
