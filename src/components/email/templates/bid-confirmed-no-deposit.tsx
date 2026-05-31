import { BidConfirmedLayout } from "./bid-confirmed-layout";

// Bid-confirmed email — NO-DEPOSIT variant. Fires when an admin approves
// a pending bid with no deposit set. The only remaining guest action is
// signing the liability waiver on the bid page; everything else settles
// at the property. Remaining guests sign paper waivers at check-in.
//
// The waiver is signed ON the bid page (an embedded Dropbox Sign flow),
// NOT via a separate Dropbox Sign email — the copy reflects that.
//
// Pairs with bid-confirmed-with-deposit.tsx; the Inngest handler picks
// the variant based on whether deposit_amount is set. Both compose the
// shared BidConfirmedLayout shell.

export interface BidConfirmedNoDepositProps {
  guestName: string;
  propertyName: string;
  dateLong: string; // e.g. "Saturday, May 23"
  timeLabel: string; // e.g. "9 AM CT"
  guestCount: number;
  totalPrice: string; // pre-formatted whole dollars, no $ prefix
  // Absolute bid-page URL, or null for legacy bids — see layout.
  bidUrl: string | null;
}

export function BidConfirmedNoDeposit({
  guestName,
  propertyName,
  dateLong,
  timeLabel,
  guestCount,
  totalPrice,
  bidUrl,
}: BidConfirmedNoDepositProps) {
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
      That&rsquo;s all we need before your visit; the ${totalPrice} settles at
      the property.
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
      intro="Here are the final details and the last step before your visit."
      pricingDetail={null}
      steps={steps}
      ctaLabel="Sign your waiver"
    />
  );
}
