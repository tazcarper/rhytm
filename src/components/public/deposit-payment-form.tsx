"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Alert, Button } from "@/lib/ui";
import { getPublishableKey } from "@/lib/stripe/publishable-key";
import { createDepositSessionAction } from "@/app/(public)/bids/[slug]/[code]/deposit-actions";
import { buildBidUrl } from "@/src/services/bids/bid-url";
import { formatMoney } from "@/src/services/public/format";
import s from "./deposit-payment-form.module.css";

// Inline deposit collection: Stripe <PaymentElement> backed by a
// server-issued PaymentIntent (App 6.3). The form lives inside the
// existing DepositSlot card on the public bid page.
//
// Lifecycle:
//   1. Mount → call Server Action → receive client_secret.
//   2. Mount <Elements> + <PaymentElement>; wait for onReady before
//      enabling the submit button.
//   3. Submit → stripe.confirmPayment with redirect: 'if_required'.
//      Card payments resolve inline; 3DS redirects out-of-page and
//      back via return_url.
//   4. On confirmPayment success → optimistic "Payment received" card
//      + periodic router.refresh() until the webhook flips bid.status
//      to 'paid' (parent unmounts this component) or 30s elapses
//      (manual-refresh CTA).
//
// loadStripe is called once at module scope; the returned Promise is
// stable across renders so <Elements> doesn't re-initialize Stripe.js
// on every parent re-render.

const stripePromise = (() => {
  try {
    return loadStripe(getPublishableKey());
  } catch (err) {
    console.error("[deposit-payment-form] publishable key missing", err);
    return Promise.resolve<StripeJs | null>(null);
  }
})();

interface DepositPaymentFormProps {
  bidSlug: string;
  bidAccessCode: string;
  depositAmount: number; // minimum payable (dollars)
  quotedAmount: number | null; // maximum payable (dollars); null → fixed at deposit
}

export function DepositPaymentForm({
  bidSlug,
  bidAccessCode,
  depositAmount,
  quotedAmount,
}: DepositPaymentFormProps) {
  const router = useRouter();

  // Path A: the customer chooses any amount in [depositAmount, maxAmount].
  // If no quote is set (or quote ≤ deposit), the form is fixed at deposit.
  const maxAmount =
    quotedAmount !== null && quotedAmount > depositAmount
      ? quotedAmount
      : depositAmount;
  const allowsCustomAmount = maxAmount > depositAmount;

  const [committedAmount, setCommittedAmount] = useState(depositAmount);
  const [amountInput, setAmountInput] = useState(() =>
    depositAmount.toFixed(2),
  );
  const [amountError, setAmountError] = useState<string | null>(null);
  // Flattened state model (no union). Splitting these out lets us
  // overlay-on-top-of-the-existing-Elements during a refetch instead of
  // tearing the iframe down to a skeleton. Without this, the whole
  // payment section flashes on every amount change — see the comment
  // on the overlay render below.
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  // True after PaymentElement.onReady fires for the *current*
  // clientSecret. Reset when clientSecret changes so we re-show the
  // overlay while the new iframe initializes.
  const [isElementReady, setIsElementReady] = useState(false);
  const [paymentSucceeded, setPaymentSucceeded] = useState(false);
  const [pollingExhausted, setPollingExhausted] = useState(false);
  const [fetchToken, setFetchToken] = useState(0);
  // Locks the AmountPicker once the user has typed in the Stripe
  // PaymentElement. Without this, changing the amount triggers a
  // clientSecret refetch → <Elements key={clientSecret}> remount →
  // card fields wiped. One-way: stays locked until form unmounts
  // (success or page refresh). Comparable to Stripe's own pattern:
  // amount is finalized before card entry begins.
  const [cardInteracted, setCardInteracted] = useState(false);

  // Step 1: fetch the clientSecret for the committed amount. Re-fetch
  // when committedAmount or fetchToken changes (the latter via retry).
  // React Strict Mode in dev will double-fire this — the Server Action
  // is amount-aware and reuses the existing PI when the amount matches,
  // so the duplicate is benign.
  //
  // Critically: we do NOT reset `clientSecret` to null here. Keeping
  // the old clientSecret means the existing <Elements> stays mounted
  // during the fetch; the overlay covers it. When the new clientSecret
  // arrives, the `key` change triggers a clean swap behind the overlay.
  useEffect(() => {
    let cancelled = false;
    setIsFetching(true);
    setSessionError(null);
    (async () => {
      const result = await createDepositSessionAction(
        bidSlug,
        bidAccessCode,
        committedAmount,
      );
      if (cancelled) return;
      if (result.ok) {
        setClientSecret(result.clientSecret);
      } else {
        setSessionError(result.message);
      }
      setIsFetching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [bidSlug, bidAccessCode, fetchToken, committedAmount]);

  // Reset the iframe-ready flag whenever clientSecret changes so the
  // overlay stays up during the new iframe's load.
  useEffect(() => {
    if (clientSecret) setIsElementReady(false);
  }, [clientSecret]);

  // Step 4: after a confirmed payment, refresh the server component
  // until the webhook has updated bid.status='paid' (at which point
  // the parent re-renders the slot in its "paid" state and this
  // component unmounts). Cap at 30s; show a manual-refresh CTA if it
  // still hasn't landed.
  useEffect(() => {
    if (!paymentSucceeded) return;
    router.refresh();
    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      router.refresh();
      if (attempts >= 15) {
        window.clearInterval(interval);
        setPollingExhausted(true);
      }
    }, 2000);
    return () => window.clearInterval(interval);
  }, [paymentSucceeded, router]);

  const retry = useCallback(() => setFetchToken((n) => n + 1), []);

  // Commit a typed/clicked amount. Only triggers a re-fetch if the
  // amount actually changed — avoids needless PaymentElement remounts.
  // Validates locally before committing; the server re-validates.
  const commitAmount = useCallback(
    (next: number) => {
      const rounded = Math.round(next * 100) / 100;
      if (!Number.isFinite(rounded)) {
        setAmountError("Enter a valid amount.");
        return;
      }
      if (rounded < depositAmount - 1e-9) {
        setAmountError(
          `Minimum is the deposit ($${depositAmount.toFixed(2)}).`,
        );
        return;
      }
      if (rounded > maxAmount + 1e-9) {
        setAmountError(`Maximum is $${maxAmount.toFixed(2)}.`);
        return;
      }
      setAmountError(null);
      setAmountInput(rounded.toFixed(2));
      if (rounded !== committedAmount) {
        setCommittedAmount(rounded);
      }
    },
    [depositAmount, maxAmount, committedAmount],
  );

  if (paymentSucceeded) {
    return <SuccessCard pollingExhausted={pollingExhausted} />;
  }

  return (
    <div className={s.wrap}>
      {allowsCustomAmount && (
        <AmountPicker
          inputValue={amountInput}
          onInputChange={setAmountInput}
          onCommit={(raw) => commitAmount(Number.parseFloat(raw))}
          depositAmount={depositAmount}
          maxAmount={maxAmount}
          committedAmount={committedAmount}
          error={amountError}
          locked={isFetching || cardInteracted}
          lockedByCard={cardInteracted}
        />
      )}

      {/* Stable amount header — lives OUTSIDE <Elements> so it doesn't
          flicker on remount. Always reflects the currently committed
          amount, even while the underlying PI is being re-issued. */}
      <div className={s.amountLine}>
        <span className={s.amountLabel}>Deposit</span>
        <span className={s.amount}>${formatMoney(committedAmount)}</span>
      </div>

      {sessionError && (
        <div className={s.errorBlock}>
          <Alert variant="warn" title="We couldn't open the payment form">
            {sessionError}
          </Alert>
          <div className={s.submitRow}>
            <Button type="button" onClick={retry} variant="secondary">
              Try again
            </Button>
          </div>
        </div>
      )}

      {!sessionError && (
        <div className={s.paymentSection}>
          {/* First load: no clientSecret yet, show a calm skeleton.
              After first load: keep the previous <Elements> mounted
              while a refetch is in flight and overlay it. The
              overlay also stays through the iframe's own load (which
              fires onReady when ready). */}
          {clientSecret === null ? (
            <div className={s.skeleton} aria-busy="true" aria-live="polite" />
          ) : (
            <Elements
              key={clientSecret}
              stripe={stripePromise}
              options={{ clientSecret }}
            >
              <PaymentFormBody
                amount={committedAmount}
                bidSlug={bidSlug}
                bidAccessCode={bidAccessCode}
                paused={isFetching || !isElementReady}
                onSucceeded={() => setPaymentSucceeded(true)}
                onCardInteracted={() => setCardInteracted(true)}
                onReady={() => setIsElementReady(true)}
              />
            </Elements>
          )}

          {clientSecret !== null && (isFetching || !isElementReady) && (
            <div className={s.paymentOverlay} aria-busy="true">
              <div className={s.paymentOverlaySpinner} aria-hidden="true" />
              <p className={s.paymentOverlayText}>
                Updating to ${formatMoney(committedAmount)}…
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface AmountPickerProps {
  inputValue: string;
  onInputChange: (next: string) => void;
  onCommit: (raw: string) => void;
  depositAmount: number;
  maxAmount: number;
  committedAmount: number;
  error: string | null;
  locked: boolean;
  lockedByCard: boolean;
}

function AmountPicker({
  inputValue,
  onInputChange,
  onCommit,
  depositAmount,
  maxAmount,
  committedAmount,
  error,
  locked,
  lockedByCard,
}: AmountPickerProps) {
  const isDeposit = Math.abs(committedAmount - depositAmount) < 0.005;
  const isFull = Math.abs(committedAmount - maxAmount) < 0.005;

  return (
    <div className={s.amountPicker}>
      <label className={s.amountPickerLabel} htmlFor="deposit-amount">
        Amount to pay
      </label>
      <div className={s.amountPickerRow}>
        <input
          id="deposit-amount"
          className={s.amountPickerInput}
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onBlur={(e) => onCommit(e.target.value)}
          disabled={locked}
        />
        <Button
          type="button"
          size="sm"
          variant={isDeposit ? "primary" : "secondary"}
          onClick={() => onCommit(depositAmount.toFixed(2))}
          disabled={locked}
        >
          Deposit ${depositAmount.toFixed(2)}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={isFull ? "primary" : "secondary"}
          onClick={() => onCommit(maxAmount.toFixed(2))}
          disabled={locked}
        >
          Full ${maxAmount.toFixed(2)}
        </Button>
      </div>
      <p className={s.amountPickerHint}>
        {error
          ? error
          : lockedByCard
            ? "Amount is locked once you start entering card details. Refresh the page to change it."
            : `Pay at least the $${depositAmount.toFixed(2)} deposit, up to the $${maxAmount.toFixed(2)} quote. The remainder settles at the property.`}
      </p>
    </div>
  );
}

interface PaymentFormBodyProps {
  amount: number;
  bidSlug: string;
  bidAccessCode: string;
  // True while a re-fetch is happening or the new iframe is still
  // initializing. The Pay button stays disabled and the parent's
  // overlay covers the form visually. Without this, a click during
  // the swap could confirm the stale PI.
  paused: boolean;
  onSucceeded: () => void;
  // Fires on the first PaymentElement onChange event where the user
  // has actually typed something (event.empty === false). Parent
  // uses this to lock the AmountPicker so a remount doesn't wipe
  // their card data.
  onCardInteracted: () => void;
  // Fires when Stripe's iframe is fully loaded for the current
  // clientSecret. Parent uses this to dismiss the loading overlay.
  onReady: () => void;
}

function PaymentFormBody({
  amount,
  bidSlug,
  bidAccessCode,
  paused,
  onSucceeded,
  onCardInteracted,
  onReady,
}: PaymentFormBodyProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // One-shot guard so we don't bombard the parent with onChange events
  // (PaymentElement fires onChange on every keystroke). useRef avoids
  // re-renders just to track this.
  const interactedRef = useRef(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSubmitError(null);
    setSubmitting(true);

    const returnUrl = `${window.location.origin}${buildBidUrl(
      bidSlug,
      bidAccessCode,
    )}`;

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });

    if (result.error) {
      // Validation, declines, network errors. Stripe's error.message
      // is end-user-friendly ("Your card was declined.", etc.).
      setSubmitError(
        result.error.message ??
          "Payment couldn't be completed. Try again in a moment.",
      );
      setSubmitting(false);
      return;
    }

    // No error → the PaymentIntent is in a non-error state (succeeded,
    // requires_action handled in-browser, or processing). The webhook
    // is the authority on bid status; we optimistically show success
    // and let the polling refresh confirm.
    onSucceeded();
    // Leave `submitting=true` so the form stays locked while the
    // parent transitions to the success card.
  };

  const buttonLabel = submitting
    ? "Processing…"
    : `Pay $${formatMoney(amount)}`;

  // `paused` covers the overlay window: refetch in flight OR new
  // iframe still initializing. Confirming during either would target
  // a stale PI or a not-yet-loaded element.
  const buttonDisabled = !stripe || !elements || paused || submitting;

  return (
    <form onSubmit={handleSubmit} className={s.formBody}>
      {submitError && (
        <Alert variant="warn" title="Payment didn't go through">
          {submitError}
        </Alert>
      )}

      <div className={s.elementMount}>
        <PaymentElement
          onReady={onReady}
          onChange={(event) => {
            // PaymentElement.onChange fires both on initial mount and
            // on every user keystroke. We only want to lock the
            // AmountPicker when the user has ACTUALLY typed something
            // — `empty: false` is the signal for that. Mount events
            // and the user clearing the form (back to empty) don't
            // count.
            if (!interactedRef.current && !event.empty) {
              interactedRef.current = true;
              onCardInteracted();
            }
          }}
        />
      </div>

      <div className={s.submitRow}>
        <Button type="submit" disabled={buttonDisabled}>
          {buttonLabel}
        </Button>
      </div>
    </form>
  );
}

function SuccessCard({ pollingExhausted }: { pollingExhausted: boolean }) {
  return (
    <div className={s.successWrap}>
      <p className={s.successTitle}>Payment received</p>
      <p className={s.successCopy}>
        {pollingExhausted
          ? "Your payment is in. Refresh in a moment to see your bid update."
          : "Finalizing your bid — this only takes a moment."}
      </p>
      {!pollingExhausted && <div className={s.spinner} aria-hidden="true" />}
    </div>
  );
}
