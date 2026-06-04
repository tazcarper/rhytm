"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Alert, Button } from "@/lib/ui";
import { getPublishableKey } from "@/lib/stripe/publishable-key";
import {
  releaseAdventureHoldAction,
  requestAdventureAction,
  startCheckoutAction,
} from "@/app/(public)/adventures/[id]/reserve/actions";
import { adventureTotal, adventureTotalLabel } from "@/src/services/adventures/display";
import { formatMoney } from "@/src/services/public/format";
import type { AdventurePaymentMode } from "@/src/services/public/adventures";
import { HoldCountdown } from "./hold-countdown";

// Adventure checkout, mode-aware:
//   instant — party → pay full → done
//   deposit — party → pay deposit (balance settled offline) → done
//   inquire — party → request to reserve (no payment) → requested
// Payment modes hold the spot (pending_payment) + run Stripe; inquire just
// files a request and notifies staff.

const stripePromise = (() => {
  try {
    return loadStripe(getPublishableKey());
  } catch (err) {
    console.error("[adventure-checkout] publishable key missing", err);
    return Promise.resolve<StripeJs | null>(null);
  }
})();

export function AdventureCheckout({
  adventureId,
  price,
  guestPrice,
  maxGuests,
  paymentMode,
  depositAmount,
  freeCancellationDays,
}: {
  adventureId: string;
  price: number;
  guestPrice: number | null;
  maxGuests: number;
  paymentMode: AdventurePaymentMode;
  depositAmount: number | null;
  freeCancellationDays: number;
}) {
  const [guestCount, setGuestCount] = useState(1);
  const [step, setStep] = useState<"party" | "pay" | "done" | "requested">("party");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [payNow, setPayNow] = useState(price);
  const [balanceDue, setBalanceDue] = useState(0);
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);
  const [holdExpired, setHoldExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const total = adventureTotal(price, guestPrice, guestCount);
  const liveTotal = adventureTotalLabel(price, guestPrice, guestCount);
  const dueNowPreview =
    paymentMode === "deposit" && depositAmount && depositAmount > 0 && depositAmount < total
      ? depositAmount
      : total;
  const showsBalance = paymentMode === "deposit" && dueNowPreview < total;

  const handleHoldExpired = () => {
    setHoldExpired(true);
    void releaseAdventureHoldAction({ adventureId });
  };

  const restartFromParty = () => {
    setHoldExpired(false);
    setClientSecret(null);
    setHoldExpiresAt(null);
    setStep("party");
  };

  const proceed = async () => {
    setError(null);
    setStarting(true);

    if (paymentMode === "inquire") {
      const result = await requestAdventureAction({ adventureId, guestCount });
      setStarting(false);
      if (!result.ok) {
        setError(result.message ?? "Couldn't send your request.");
        return;
      }
      setStep("requested");
      return;
    }

    const result = await startCheckoutAction({ adventureId, guestCount });
    setStarting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPayNow(result.chargeAmount);
    setBalanceDue(result.balanceDue);
    // Free ("Included") trip — confirmed server-side, no Stripe.
    if (!result.clientSecret) {
      setStep("done");
      return;
    }
    setClientSecret(result.clientSecret);
    setHoldExpiresAt(result.holdExpiresAt);
    setStep("pay");
  };

  if (step === "requested") {
    return (
      <div className="text-center">
        <div className="font-serif text-[26px] text-olive italic mb-2">Request sent</div>
        <p className="font-serif text-[15px] text-gray mb-5 max-w-sm mx-auto">
          Your concierge will confirm availability with the outfitter and reach
          out to finalize the details.
        </p>
        <Button asChild variant="primary" size="lg">
          <Link href="/member/adventures">View my adventures &rarr;</Link>
        </Button>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="text-center">
        <div className="font-serif text-[26px] text-olive italic mb-2">
          You&rsquo;re all set
        </div>
        <p className="font-serif text-[15px] text-gray mb-5 max-w-sm mx-auto">
          {balanceDue > 0
            ? `Deposit received — we've emailed your receipt. The $${formatMoney(balanceDue)} balance settles with the concierge.`
            : "Payment received — we've emailed your receipt. Your place is confirmed."}
        </p>
        <Button asChild variant="primary" size="lg">
          <Link href="/member/adventures">View my adventures &rarr;</Link>
        </Button>
      </div>
    );
  }

  if (step === "pay" && clientSecret) {
    return (
      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <PaymentStep
          payNow={payNow}
          balanceDue={balanceDue}
          holdExpiresAt={holdExpiresAt}
          expired={holdExpired}
          onExpire={handleHoldExpired}
          onDone={() => setStep("done")}
          onBack={restartFromParty}
        />
      </Elements>
    );
  }

  // Party step.
  const buttonLabel = starting
    ? "Just a moment…"
    : paymentMode === "inquire"
      ? "Request to reserve"
      : paymentMode === "deposit"
        ? "Continue to deposit"
        : "Continue to payment";
  const footNote =
    paymentMode === "inquire"
      ? "No payment now — your concierge follows up to confirm."
      : paymentMode === "deposit"
        ? "Pay a deposit now; the balance settles with the concierge."
        : "Full payment reserves your place. Charged securely via Stripe.";

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <Alert variant="warn" title="Couldn't start your reservation">
          {error}
        </Alert>
      )}

      {maxGuests > 1 && (
        <div className="flex items-center justify-between gap-3">
          <span className="font-sans text-[13px] text-gray tracking-[0.5px] uppercase">
            Your party
          </span>
          <div className="flex items-center border border-rule rounded-pill">
            <button
              type="button"
              onClick={() => setGuestCount((n) => Math.max(1, n - 1))}
              disabled={guestCount <= 1 || starting}
              aria-label="Fewer guests"
              className="px-4 py-1.5 font-mono text-olive disabled:opacity-40"
            >
              −
            </button>
            <span className="px-3 font-mono text-[16px] text-olive min-w-[1.5ch] text-center">
              {guestCount}
            </span>
            <button
              type="button"
              onClick={() => setGuestCount((n) => Math.min(maxGuests, n + 1))}
              disabled={guestCount >= maxGuests || starting}
              aria-label="More guests"
              className="px-4 py-1.5 font-mono text-olive disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>
      )}

      <div className="flex items-baseline justify-between pt-4 border-t border-rule">
        <span className="font-sans text-[13px] text-gray tracking-[0.5px] uppercase">
          Total
        </span>
        <span className="font-serif text-[28px] text-olive">{liveTotal}</span>
      </div>
      {showsBalance && (
        <div className="flex items-baseline justify-between -mt-3">
          <span className="font-sans text-[12px] text-tan-deep tracking-[0.5px] uppercase">
            Deposit due now
          </span>
          <span className="font-serif text-[18px] text-olive">
            ${formatMoney(dueNowPreview)}
          </span>
        </div>
      )}

      <Button type="button" variant="primary" size="lg" fullWidth loading={starting} onClick={proceed}>
        {buttonLabel}
      </Button>
      <p className="font-serif italic text-[13px] text-gray text-center m-0">{footNote}</p>
      {paymentMode !== "inquire" && (
        <p className="font-sans text-[11px] tracking-[0.5px] uppercase text-tan-deep text-center m-0">
          Free cancellation up to {freeCancellationDays} days before the trip
        </p>
      )}
    </div>
  );
}

function PaymentStep({
  payNow,
  balanceDue,
  holdExpiresAt,
  expired,
  onExpire,
  onDone,
  onBack,
}: {
  payNow: number;
  balanceDue: number;
  holdExpiresAt: string | null;
  expired: boolean;
  onExpire: () => void;
  onDone: () => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || expired) return;
    setError(null);
    setSubmitting(true);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/member/adventures` },
      redirect: "if_required",
    });

    if (result.error) {
      setError(result.error.message ?? "Payment couldn't be completed. Try again.");
      setSubmitting(false);
      return;
    }
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {holdExpiresAt && !expired && (
        <div className="text-center font-sans text-[12px] tracking-[0.5px] uppercase text-tan-deep">
          <HoldCountdown expiresAt={holdExpiresAt} prefix="Spot held" onExpire={onExpire} />
        </div>
      )}

      {expired && (
        <Alert variant="warn" title="Your hold was released">
          Your 30-minute hold ended, so we&rsquo;ve opened the spot back up to
          other members — first come, first served. If it&rsquo;s still
          available, you can reserve it again (the timer starts over).
        </Alert>
      )}

      {balanceDue > 0 && !expired && (
        <p className="font-serif italic text-[13px] text-gray text-center m-0">
          Paying a deposit now — the ${formatMoney(balanceDue)} balance settles
          with the concierge.
        </p>
      )}

      {error && (
        <Alert variant="warn" title="Payment didn't go through">
          {error}
        </Alert>
      )}

      <PaymentElement onReady={() => setReady(true)} />

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          type="button"
          variant={expired ? "primary" : "ghost"}
          size="sm"
          onClick={onBack}
          disabled={submitting}
        >
          &larr; {expired ? "Reserve again" : "Change party"}
        </Button>
        {!expired && (
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={!stripe || !ready || submitting}
          >
            {submitting ? "Processing…" : `Pay $${formatMoney(payNow)}`}
          </Button>
        )}
      </div>
    </form>
  );
}
