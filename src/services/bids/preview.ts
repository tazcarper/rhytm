import type { BidDetail } from "./get-bid";

// Bid-page state preview helper. Admin-only dev tool: lets staff
// visit a real bid URL with `?preview=<state>` to see what the page
// would look like in that state, without touching the DB or running
// a Stripe/Dropbox Sign flow.
//
// Override happens server-side in app/(public)/bids/[slug]/[code]/page.tsx
// — we transform the BidDetail returned by getBidDetail before passing
// it to the render tree. The toolbar component (admin-only) renders
// the state-switching buttons at the top of the page.

export const PREVIEW_STATES = [
  "pending",
  "confirmed",
  "paid-deposit",
  "paid-full",
  "signed",
  "finalized",
  "refunded",
  "denied",
  "expired",
] as const;

export type BidPreviewState = (typeof PREVIEW_STATES)[number];

export const PREVIEW_LABELS: Record<BidPreviewState, string> = {
  pending: "Pending review",
  confirmed: "Confirmed",
  "paid-deposit": "Deposit paid",
  "paid-full": "Paid in full",
  signed: "Signed only",
  finalized: "Finalized",
  refunded: "Refunded",
  denied: "Denied",
  expired: "Expired",
};

export function isValidPreviewState(
  value: string | undefined | null,
): value is BidPreviewState {
  return (
    typeof value === "string" &&
    (PREVIEW_STATES as ReadonlyArray<string>).includes(value)
  );
}

// Override bid + booking fields based on the requested preview state.
// All other fields (guest, property, disciplines, etc.) come from the
// real DB row so the preview shows the actual booking content.
export function applyBidPreview(
  detail: BidDetail,
  preview: BidPreviewState,
): BidDetail {
  const bid = { ...detail.bid };
  const booking = { ...detail.booking };
  const fakeNow = new Date().toISOString();

  // Default: reset paid/signed signals; each branch sets what it needs.
  bid.paidAt = null;
  bid.signedAt = null;
  booking.amountPaid = 0;

  const depositOrFallback = booking.depositAmount ?? 100;
  const fullOrFallback = booking.effectiveQuote ?? depositOrFallback;

  switch (preview) {
    case "pending":
      bid.status = "pending_review";
      break;
    case "confirmed":
      bid.status = "confirmed";
      break;
    case "paid-deposit":
      bid.status = "paid";
      bid.paidAt = fakeNow;
      booking.amountPaid = depositOrFallback;
      break;
    case "paid-full":
      bid.status = "paid";
      bid.paidAt = fakeNow;
      booking.amountPaid = fullOrFallback;
      break;
    case "signed":
      bid.status = "signed";
      bid.signedAt = fakeNow;
      break;
    case "finalized":
      bid.status = "paid";
      bid.paidAt = fakeNow;
      bid.signedAt = fakeNow;
      booking.amountPaid = fullOrFallback;
      break;
    case "refunded":
      bid.status = "refunded";
      bid.paidAt = fakeNow;
      bid.signedAt = fakeNow;
      booking.amountPaid = depositOrFallback;
      break;
    case "denied":
      bid.status = "denied";
      break;
    case "expired":
      bid.status = "expired";
      break;
  }

  return { ...detail, bid, booking };
}
