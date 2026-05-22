"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
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
  amount: number; // dollars, server-known
}

type SessionState =
  | { kind: "loading" }
  | { kind: "ready"; clientSecret: string }
  | { kind: "error"; message: string };

export function DepositPaymentForm({
  bidSlug,
  bidAccessCode,
  amount,
}: DepositPaymentFormProps) {
  const router = useRouter();
  const [sessionState, setSessionState] = useState<SessionState>({
    kind: "loading",
  });
  const [paymentSucceeded, setPaymentSucceeded] = useState(false);
  const [pollingExhausted, setPollingExhausted] = useState(false);
  const [fetchToken, setFetchToken] = useState(0);

  // Step 1: fetch the clientSecret. Re-fetch when fetchToken changes
  // (retry button bumps the token). React Strict Mode in dev will
  // double-fire this — the Server Action is idempotent (Stripe returns
  // the same PI from the idempotency cache), so the duplicate is
  // benign.
  useEffect(() => {
    let cancelled = false;
    setSessionState({ kind: "loading" });
    (async () => {
      const result = await createDepositSessionAction(bidSlug, bidAccessCode);
      if (cancelled) return;
      if (result.ok) {
        setSessionState({
          kind: "ready",
          clientSecret: result.clientSecret,
        });
      } else {
        setSessionState({
          kind: "error",
          message: result.message,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bidSlug, bidAccessCode, fetchToken]);

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

  if (paymentSucceeded) {
    return <SuccessCard pollingExhausted={pollingExhausted} />;
  }

  if (sessionState.kind === "loading") {
    return <div className={s.skeleton} aria-busy="true" aria-live="polite" />;
  }

  if (sessionState.kind === "error") {
    return (
      <div className={s.errorBlock}>
        <Alert variant="warn" title="We couldn't open the payment form">
          {sessionState.message}
        </Alert>
        <div className={s.submitRow}>
          <Button type="button" onClick={retry} variant="secondary">
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Elements
      key={sessionState.clientSecret}
      stripe={stripePromise}
      options={{ clientSecret: sessionState.clientSecret }}
    >
      <PaymentFormBody
        amount={amount}
        bidSlug={bidSlug}
        bidAccessCode={bidAccessCode}
        onSucceeded={() => setPaymentSucceeded(true)}
      />
    </Elements>
  );
}

interface PaymentFormBodyProps {
  amount: number;
  bidSlug: string;
  bidAccessCode: string;
  onSucceeded: () => void;
}

function PaymentFormBody({
  amount,
  bidSlug,
  bidAccessCode,
  onSucceeded,
}: PaymentFormBodyProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [elementReady, setElementReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const buttonDisabled = !stripe || !elements || !elementReady || submitting;

  return (
    <form onSubmit={handleSubmit} className={s.wrap}>
      <div className={s.amountLine}>
        <span className={s.amountLabel}>Deposit</span>
        <span className={s.amount}>${formatMoney(amount)}</span>
      </div>

      {submitError && (
        <Alert variant="warn" title="Payment didn't go through">
          {submitError}
        </Alert>
      )}

      <div className={s.elementMount}>
        <PaymentElement onReady={() => setElementReady(true)} />
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
