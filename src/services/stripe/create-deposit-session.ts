import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

// Idempotent deposit "payment session" — domain-neutral term covering
// the Stripe PaymentIntent we open for one bid's deposit. The customer
// completes it client-side via <PaymentElement>. The webhook then
// flips the bid to 'paid' (see 6.5).
//
// Flow:
//   1. Validate (slug, code) against the bid via validate_bid_access_code.
//   2. Check bid.status — pending/denied/expired return a 4xx-shaped
//      result; paid/refunded return "already paid"; only confirmed/signed
//      proceed.
//   3. Read booking.deposit_amount + deposit_payment_intent_id.
//   4. If a PaymentIntent already exists AND its amount matches AND it's
//      in a customer-confirmable state, return its client_secret. The
//      Stripe-side idempotency cache (24h) + the amount-aware idem key
//      below double-cover the create path.
//   5. Otherwise create a fresh PI with metadata { bid_id, booking_id }
//      and write its id back to bookings.
//
// No `payment_method_types` per stripe-best-practices — dynamic methods
// on apiVersion ≥ 2023-08-16. No `receipt_email` — the branded receipt
// fires from the webhook via EmailService.
//
// SOLID. Receives `stripe` + `supabase` injected. The Server Action
// (`app/(public)/bids/[slug]/[code]/deposit-actions.ts`) wires them up.

export interface CreateDepositSessionContext {
  supabase: SupabaseClient;
  stripe: Stripe;
  bidSlug: string;
  bidAccessCode: string;
}

export type CreateDepositSessionResult =
  | {
      ok: true;
      clientSecret: string;
      paymentIntentId: string;
      amount: number; // dollars, display-ready (matches BidDetail.booking.depositAmount shape)
      currency: "usd";
    }
  | {
      ok: false;
      reason:
        | "bid_not_found"
        | "bid_not_payable"
        | "already_paid"
        | "no_deposit_amount"
        | "stripe_error"
        | "db_error";
      message: string;
    };

// PI states where the client_secret can still drive a successful
// payment via <PaymentElement>. `requires_capture` is excluded because
// we use automatic capture; we should never see it.
const REUSABLE_PI_STATES = new Set<Stripe.PaymentIntent.Status>([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
]);

type ValidatedBidRow = {
  id: string;
  booking_id: string;
  slug: string;
  status:
    | "pending_review"
    | "confirmed"
    | "denied"
    | "signed"
    | "paid"
    | "expired"
    | "refunded";
};

type BookingRow = {
  id: string;
  deposit_amount: string | number | null;
  deposit_payment_intent_id: string | null;
};

export async function createDepositSession(
  ctx: CreateDepositSessionContext,
): Promise<CreateDepositSessionResult> {
  const { supabase, stripe, bidSlug, bidAccessCode } = ctx;

  if (!bidSlug.trim() || !bidAccessCode.trim()) {
    return {
      ok: false,
      reason: "bid_not_found",
      message: "We couldn't find this bid. Check the link and try again.",
    };
  }

  // 1. Validate (slug, code). The RPC is SECURITY DEFINER and runs a
  //    bcrypt verify; a dummy verify fires on the miss path so timing
  //    can't leak slug existence (Phase 3 contract).
  const { data: bidRows, error: bidErr } = await supabase.rpc(
    "validate_bid_access_code",
    { p_slug: bidSlug, p_code: bidAccessCode },
  );

  if (bidErr) {
    console.error("[stripe/create-deposit-session] RPC failed", bidErr);
    return {
      ok: false,
      reason: "db_error",
      message: "Couldn't load this bid. Try again in a moment.",
    };
  }

  const bid = Array.isArray(bidRows)
    ? (bidRows[0] as ValidatedBidRow | undefined)
    : undefined;

  if (!bid) {
    return {
      ok: false,
      reason: "bid_not_found",
      message: "We couldn't find this bid. Check the link and try again.",
    };
  }

  // 2. Bid status gate.
  if (bid.status === "paid" || bid.status === "refunded") {
    return {
      ok: false,
      reason: "already_paid",
      message: "This bid has already been paid.",
    };
  }
  if (bid.status !== "confirmed" && bid.status !== "signed") {
    return {
      ok: false,
      reason: "bid_not_payable",
      message:
        bid.status === "pending_review"
          ? "This bid is still being reviewed. We'll email you when it's ready to pay."
          : "This bid is no longer payable.",
    };
  }

  // 3. Booking columns we actually need.
  const { data: bookingData, error: bookingErr } = await supabase
    .from("bookings")
    .select("id, deposit_amount, deposit_payment_intent_id")
    .eq("id", bid.booking_id)
    .single<BookingRow>();

  if (bookingErr || !bookingData) {
    console.error(
      "[stripe/create-deposit-session] booking fetch failed",
      { bidId: bid.id, bookingId: bid.booking_id, bookingErr },
    );
    return {
      ok: false,
      reason: "db_error",
      message: "Couldn't load this bid. Try again in a moment.",
    };
  }

  const depositAmount = toNumber(bookingData.deposit_amount);
  if (depositAmount === null || depositAmount <= 0) {
    return {
      ok: false,
      reason: "no_deposit_amount",
      message:
        "No deposit amount is set on this bid yet. We'll update it shortly.",
    };
  }

  const expectedCents = Math.round(depositAmount * 100);

  // 4. Reuse the existing PI if it still matches the current amount
  //    and is in a customer-confirmable state. If the amount drifted
  //    (staff edited the bid), the existing PI is stale — we leave it
  //    in Stripe (auto-cancels in 24h) and create a fresh one keyed on
  //    the new amount.
  if (bookingData.deposit_payment_intent_id) {
    const existing = await stripe.paymentIntents
      .retrieve(bookingData.deposit_payment_intent_id)
      .catch(() => null);

    if (
      existing &&
      existing.amount === expectedCents &&
      REUSABLE_PI_STATES.has(existing.status)
    ) {
      return resultFromPaymentIntent(existing);
    }
  }

  // 5. Create a fresh PaymentIntent. No explicit `idempotencyKey` —
  //    Stripe's 24h idempotency cache returns whatever PI was tied to
  //    that key on first call, INCLUDING terminal-state PIs (the cached
  //    response, not the live PI state). That bit us in testing: a
  //    succeeded PI from an earlier test cycle was returned on the
  //    next create call for the same bid + same amount, and <Elements>
  //    rejected the terminal client_secret with a loaderror.
  //
  //    Deduplication is covered at two safer layers:
  //      - `bookings.deposit_payment_intent_id` (Phase 2 UNIQUE partial
  //        index) — checked in step 4 above; reusable PIs short-circuit.
  //      - The Stripe SDK's internal per-request idempotency key
  //        (network-retry safety, added automatically on retry).
  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe.paymentIntents.create({
      amount: expectedCents,
      currency: "usd",
      metadata: {
        bid_id: bid.id,
        booking_id: bookingData.id,
      },
      description: `Rhythm Outdoors — deposit for bid ${bid.slug}`,
    });
  } catch (err) {
    console.error("[stripe/create-deposit-session] PI create failed", err);
    return {
      ok: false,
      reason: "stripe_error",
      message: "Payment couldn't be set up. Try again in a moment.",
    };
  }

  // 6. Write the PI id back. UNIQUE partial index (Phase 2) prevents
  //    two bookings from sharing the same PI; a parallel-call race
  //    would surface as a constraint violation here, not as a silent
  //    double-write.
  const { error: updateErr } = await supabase
    .from("bookings")
    .update({ deposit_payment_intent_id: pi.id })
    .eq("id", bookingData.id);

  if (updateErr) {
    console.error(
      "[stripe/create-deposit-session] booking update failed",
      { bookingId: bookingData.id, piId: pi.id, updateErr },
    );
    // The PI exists in Stripe but isn't persisted on the booking. Next
    // click will create a different PI (different idem key context if
    // amount drifted, else same one returned from idempotency cache).
    // Not a money-impact bug — the customer hasn't paid yet.
    return {
      ok: false,
      reason: "db_error",
      message: "Payment couldn't be saved. Try again in a moment.",
    };
  }

  return resultFromPaymentIntent(pi);
}

function resultFromPaymentIntent(
  pi: Stripe.PaymentIntent,
): CreateDepositSessionResult {
  if (!pi.client_secret) {
    return {
      ok: false,
      reason: "stripe_error",
      message: "Payment couldn't be set up. Try again in a moment.",
    };
  }
  return {
    ok: true,
    clientSecret: pi.client_secret,
    paymentIntentId: pi.id,
    amount: pi.amount / 100,
    currency: "usd",
  };
}

function toNumber(value: string | number | null): number | null {
  if (value === null) return null;
  return typeof value === "string" ? parseFloat(value) : value;
}
