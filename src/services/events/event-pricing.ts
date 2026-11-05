// Date-based (early-bird) event pricing. Pure functions, no I/O: given an
// event's price columns and the moment someone signs up, which price
// applies?
//
// An event has its regular member / non-member prices, plus an optional
// early-bird tier: a cut-off instant and an early member and/or non-member
// price. Before the cut-off the early price applies (for each audience that
// has one); from the cut-off onward the regular price applies. "$65 before
// Nov 1, $85 after" is earlyBirdEndsAt = Nov 1 00:00 club time, early
// price 65, regular price 85.
//
// The registration action and the public pages both read prices through
// resolveEventPrices, so what a guest sees and what gets quoted on their
// registration always agree.

export interface EventPriceColumns {
  memberPrice: number | null;
  nonMemberPrice: number | null;
  earlyBirdEndsAt: string | null;
  earlyBirdMemberPrice: number | null;
  earlyBirdNonMemberPrice: number | null;
}

export interface EarlyBirdOffer {
  // The instant early-bird pricing stops (exclusive), as an ISO string.
  endsAt: string;
  // What each audience pays once early-bird ends.
  regularMemberPrice: number | null;
  regularNonMemberPrice: number | null;
}

export interface ResolvedEventPrices {
  // The prices that apply right now.
  memberPrice: number | null;
  nonMemberPrice: number | null;
  // Set while an early-bird price is in effect, so pages can say until when
  // and what it goes up to. Null when there's no early-bird or it's over.
  earlyBird: EarlyBirdOffer | null;
}

// The raw `events` price columns as PostgREST returns them (numeric comes
// back as a string or number).
export interface EventPriceRow {
  member_price: string | number | null;
  non_member_price: string | number | null;
  early_bird_ends_at: string | null;
  early_bird_member_price: string | number | null;
  early_bird_non_member_price: string | number | null;
}

const toMoney = (value: string | number | null): number | null => (value === null ? null : Number(value));

export function toEventPriceColumns(row: EventPriceRow): EventPriceColumns {
  return {
    memberPrice: toMoney(row.member_price),
    nonMemberPrice: toMoney(row.non_member_price),
    earlyBirdEndsAt: row.early_bird_ends_at,
    earlyBirdMemberPrice: toMoney(row.early_bird_member_price),
    earlyBirdNonMemberPrice: toMoney(row.early_bird_non_member_price),
  };
}

export function hasEarlyBird(columns: EventPriceColumns): boolean {
  return (
    columns.earlyBirdEndsAt !== null &&
    (columns.earlyBirdMemberPrice !== null || columns.earlyBirdNonMemberPrice !== null)
  );
}

export function isEarlyBirdActive(columns: EventPriceColumns, at: Date): boolean {
  if (!hasEarlyBird(columns) || columns.earlyBirdEndsAt === null) return false;
  return at.getTime() < new Date(columns.earlyBirdEndsAt).getTime();
}

export function resolveEventPrices(columns: EventPriceColumns, at: Date): ResolvedEventPrices {
  if (!isEarlyBirdActive(columns, at) || columns.earlyBirdEndsAt === null) {
    return { memberPrice: columns.memberPrice, nonMemberPrice: columns.nonMemberPrice, earlyBird: null };
  }
  return {
    memberPrice: columns.earlyBirdMemberPrice ?? columns.memberPrice,
    nonMemberPrice: columns.earlyBirdNonMemberPrice ?? columns.nonMemberPrice,
    earlyBird: {
      endsAt: columns.earlyBirdEndsAt,
      regularMemberPrice: columns.memberPrice,
      regularNonMemberPrice: columns.nonMemberPrice,
    },
  };
}

// The price quoted on one registration, chosen by member status at the
// moment of sign-up.
export function priceForRegistration(columns: EventPriceColumns, isMemberRate: boolean, at: Date): number | null {
  const prices = resolveEventPrices(columns, at);
  return isMemberRate ? prices.memberPrice : prices.nonMemberPrice;
}
