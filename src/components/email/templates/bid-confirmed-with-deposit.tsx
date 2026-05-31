import {
  BidConfirmedLayout,
  CONFIRMED_COLOR_INK,
  CONFIRMED_COLOR_MUTED,
} from "./bid-confirmed-layout";

// Bid-confirmed email — DEPOSIT variant. Fires when an admin approves a
// pending bid that has a deposit set. The guest's next steps are: sign
// the liability waiver on their bid page, pay the deposit on the same
// page, and have remaining guests sign paper waivers at check-in.
//
// The waiver is signed ON the bid page (an embedded Dropbox Sign flow),
// NOT via a separate Dropbox Sign email — the copy reflects that.
//
// Pairs with bid-confirmed-no-deposit.tsx; the Inngest handler picks the
// variant based on whether deposit_amount is set. Both compose the shared
// BidConfirmedLayout shell.

export interface BidConfirmedWithDepositProps {
  guestName: string;
  propertyName: string;
  dateLong: string; // e.g. "Saturday, May 23"
  timeLabel: string; // e.g. "9 AM CT"
  guestCount: number;
  totalPrice: string; // pre-formatted whole dollars, no $ prefix
  depositAmount: string; // pre-formatted whole dollars, no $ prefix
  balanceDue: string; // pre-formatted whole dollars, no $ prefix
  // Absolute bid-page URL, or null for legacy bids — see layout.
  bidUrl: string | null;
}

export function BidConfirmedWithDeposit({
  guestName,
  propertyName,
  dateLong,
  timeLabel,
  guestCount,
  totalPrice,
  depositAmount,
  balanceDue,
  bidUrl,
}: BidConfirmedWithDepositProps) {
  const pricingDetail = (
    <p
      style={{
        margin: "12px 0 0",
        fontSize: "14px",
        color: CONFIRMED_COLOR_INK,
      }}
    >
      <strong>${depositAmount}</strong> deposit due now &middot;{" "}
      <span style={{ color: CONFIRMED_COLOR_MUTED }}>
        ${balanceDue} balance settles at the property
      </span>
    </p>
  );

  const onBidPage = bidUrl ? (
    "your bid page"
  ) : (
    <>
      your bid page (open the link from your first email &mdash;{" "}
      <em>&ldquo;We&rsquo;re preparing your bid&rdquo;</em>)
    </>
  );

  const steps = [
    <>
      <strong>Sign your waiver.</strong> Open {onBidPage} and sign the
      liability waiver as the primary guest &mdash; it takes about a minute.
    </>,
    <>
      <strong>Pay your ${depositAmount} deposit.</strong> On the same page,
      pay the deposit to lock your date and instructor. The remaining $
      {balanceDue} settles at the property.
    </>,
    <>
      <strong>Bring everyone on the day.</strong> Each additional guest signs
      a quick paper waiver at check-in &mdash; we&rsquo;ll have copies ready.
    </>,
  ];

  return (
    <BidConfirmedLayout
      guestName={guestName}
      propertyName={propertyName}
      dateLong={dateLong}
      timeLabel={timeLabel}
      guestCount={guestCount}
      totalPrice={totalPrice}
      bidUrl={bidUrl}
      intro="Here are the final details and the steps to lock it in."
      pricingDetail={pricingDetail}
      steps={steps}
      ctaLabel="Sign waiver & pay deposit"
    />
  );
}
