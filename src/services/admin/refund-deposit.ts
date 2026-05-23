import { createElement } from "react";
import { after } from "next/server";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_FROM_EMAIL,
  getEmailService,
} from "@/src/services/notifications/send-email";
import { RefundNotice } from "@/src/components/email/templates/refund-notice";
import {
  formatDateLongTz,
  formatMoney,
  formatSlotLabelTz,
} from "@/src/services/public/format";

// Admin-triggered Stripe refund. Mirror of create-deposit-session.ts in
// reverse: validate state, hit Stripe, then atomically reflect the
// refund in our DB.
//
// Atomicity ordering: Stripe call FIRST. A refund is irrevocable from
// Stripe's side; if our DB write fails afterwards, the customer is
// already refunded and the system is inconsistent — we surface a clear
// error message and the admin reconciles. Doing the DB write first
// would create the opposite problem: we'd mark the bid refunded without
// actually having moved any money.
//
// The Stripe `idempotency_key` is safe here (unlike PI create — see
// 6.3) because Stripe's refund idempotency cache returns the same
// refund OBJECT on retry, which is exactly what we want.
//
// SOLID: receives supabase + stripe injected. The Server Action wrapper
// (`app/admin/bids/[id]/refund-actions.ts`) builds the context.

export interface RefundDepositContext {
  supabase: SupabaseClient;
  stripe: Stripe;
  bidId: string;
  // Optional partial amount in dollars; defaults to the full deposit.
  amount?: number;
  // Optional staff note appended to bids.staff_notes (markdown).
  reason?: string;
}

export type RefundDepositResult =
  | {
      ok: true;
      refundId: string;
      refundedAmount: number; // dollars
    }
  | {
      ok: false;
      reason:
        | "not_found"
        | "not_paid"
        | "already_refunded"
        | "no_payment_intent"
        | "amount_invalid"
        | "stripe_error"
        | "db_error";
      message: string;
    };

type RefundDepositRow = {
  id: string;
  status: string;
  slug: string;
  refund_payment_intent_id: string | null;
  signed_at: string | null;
  staff_notes: string | null;
  bookings: {
    id: string;
    guest_name: string;
    guest_email: string;
    start_time: string;
    deposit_amount: string | number | null;
    amount_paid: string | number | null;
    deposit_payment_intent_id: string | null;
    properties: { name: string; timezone: string } | null;
  } | null;
};

export async function refundDeposit(
  ctx: RefundDepositContext,
): Promise<RefundDepositResult> {
  const { supabase, stripe, bidId, amount, reason } = ctx;

  // 1. Fetch the bid + booking + property in one round trip.
  const { data, error: fetchErr } = await supabase
    .from("bids")
    .select(
      `
      id, status, slug, refund_payment_intent_id, signed_at, staff_notes,
      bookings (
        id, guest_name, guest_email, start_time,
        deposit_amount, amount_paid, deposit_payment_intent_id,
        properties ( name, timezone )
      )
    `,
    )
    .eq("id", bidId)
    .maybeSingle<RefundDepositRow>();

  if (fetchErr) {
    return {
      ok: false,
      reason: "db_error",
      message: `Couldn't load the bid: ${fetchErr.message}`,
    };
  }
  if (!data || !data.bookings || !data.bookings.properties) {
    return {
      ok: false,
      reason: "not_found",
      message: "Bid not found.",
    };
  }

  // 2. Gate on state. The DB UPDATE below also enforces these, but
  //    pre-checking lets us return a precise error instead of a
  //    generic "0 rows" branch.
  if (data.status !== "paid") {
    return {
      ok: false,
      reason: "not_paid",
      message: "Only paid bids can be refunded.",
    };
  }
  if (data.refund_payment_intent_id !== null) {
    return {
      ok: false,
      reason: "already_refunded",
      message: "This bid has already been refunded.",
    };
  }

  const booking = data.bookings;
  if (!booking.deposit_payment_intent_id) {
    // The fallback write in handle-payment-intent-succeeded should
    // prevent this, but defend anyway. A bid marked paid with no PI
    // means we have nothing to refund through Stripe — operator must
    // reconcile manually (e.g., Stripe dashboard side-channel).
    return {
      ok: false,
      reason: "no_payment_intent",
      message:
        "No payment intent recorded on this booking. Reach out to engineering before refunding.",
    };
  }

  // 3. Amount validation. Defaults to the full amount paid (Path A:
  //    customer may have paid more than the deposit; max refund is
  //    whatever they actually paid, not whatever the deposit was).
  const amountPaidDollars = toNumber(booking.amount_paid) ?? 0;
  const amountPaidCents = Math.round(amountPaidDollars * 100);

  if (amountPaidCents <= 0) {
    return {
      ok: false,
      reason: "no_payment_intent",
      message:
        "No payment recorded on this booking. Reach out to engineering before refunding.",
    };
  }

  const requestedCents =
    amount === undefined ? amountPaidCents : Math.round(amount * 100);

  if (requestedCents <= 0) {
    return {
      ok: false,
      reason: "amount_invalid",
      message: "Refund amount must be greater than zero.",
    };
  }
  if (requestedCents > amountPaidCents) {
    return {
      ok: false,
      reason: "amount_invalid",
      message: `Refund amount can't exceed the amount paid ($${formatMoney(
        amountPaidDollars,
      )}).`,
    };
  }

  // 4. Call Stripe Refunds API. Idempotency key is safe here — Stripe's
  //    refund idempotency returns the same refund object on retry,
  //    which is exactly the desired behavior. Unlike PaymentIntent
  //    create (see 6.3 comment), there's no "terminal state cache" trap.
  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: booking.deposit_payment_intent_id,
        amount: requestedCents,
        metadata: {
          bid_id: bidId,
          booking_id: booking.id,
          ...(reason ? { reason } : {}),
        },
      },
      { idempotencyKey: `refund-${bidId}-v1` },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe refund failed.";
    console.error("[admin/refund-deposit] Stripe refund failed", {
      bidId,
      message,
    });
    return {
      ok: false,
      reason: "stripe_error",
      message: `Stripe refund failed: ${message}`,
    };
  }

  // 5. Atomic DB UPDATE: flip bid status + record the refund. The
  //    WHERE clause guards against a parallel refund attempt that beat
  //    us — if 0 rows match, someone else completed the refund first
  //    and our Stripe call returned the same refund via idempotency.
  //    Either way, the financial side is consistent; we just need to
  //    surface the result to the admin.
  const refundedAmountDollars = refund.amount / 100;
  const staffNoteAddition = reason
    ? buildRefundNote(data.staff_notes, refund.id, refundedAmountDollars, reason)
    : data.staff_notes;

  const { error: updateErr, count } = await supabase
    .from("bids")
    .update(
      {
        status: "refunded",
        refund_payment_intent_id: refund.id,
        refund_amount: refundedAmountDollars,
        staff_notes: staffNoteAddition,
      },
      { count: "exact" },
    )
    .eq("id", bidId)
    .eq("status", "paid")
    .is("refund_payment_intent_id", null);

  if (updateErr) {
    // Stripe refund happened, DB write didn't. Surface clearly.
    console.error("[admin/refund-deposit] DB update failed after Stripe refund", {
      bidId,
      refundId: refund.id,
      message: updateErr.message,
    });
    return {
      ok: false,
      reason: "db_error",
      message: `Stripe refund issued (${refund.id}) but our database didn't update: ${updateErr.message}. Reach out to engineering.`,
    };
  }
  if (count === 0) {
    // Race: another admin click landed between our pre-check and
    // UPDATE. The Stripe idempotency cache means we'd have returned
    // the same refund anyway — no double-charge. Treat as success.
    console.warn(
      "[admin/refund-deposit] UPDATE matched 0 rows; assuming concurrent refund",
      { bidId, refundId: refund.id },
    );
  }

  // 6. Queue a refund-notice email to the guest (best-effort, post-response).
  //    Re-narrow `properties` here — TypeScript can't carry the
  //    earlier guard through the intervening operations.
  if (!booking.properties) {
    return { ok: true, refundId: refund.id, refundedAmount: refundedAmountDollars };
  }
  const propertyName = booking.properties.name;
  const tz = booking.properties.timezone;
  const isPartial = requestedCents < amountPaidCents;
  const dateLong = formatDateLongTz(booking.start_time, tz);
  const props = {
    guestName: booking.guest_name,
    propertyName,
    dateLong,
    timeLabel: `${formatSlotLabelTz(booking.start_time, tz)} CT`,
    // refund-notice template's prop name is still `depositAmount`,
    // but with Path A it represents the original amount paid (which
    // may be deposit-only, partial, or the full quote). Renaming
    // would ripple — defer.
    depositAmount: formatMoney(amountPaidDollars),
    refundAmount: formatMoney(refundedAmountDollars),
    isPartial,
  };

  after(async () => {
    try {
      const result = await getEmailService().send({
        to: booking.guest_email,
        from: DEFAULT_FROM_EMAIL,
        subject: isPartial
          ? "We've issued a partial refund for your deposit"
          : "Your deposit has been refunded",
        template: {
          name: "refund_notice",
          element: createElement(RefundNotice, props),
          props,
        },
        source: "admin_refund",
      });
      if (!result.ok) {
        console.error(
          "[admin/refund-deposit] refund-notice send failed",
          { bidId, error: result.error },
        );
      }
    } catch (err) {
      console.error("[admin/refund-deposit] refund-notice send threw", {
        bidId,
        err,
      });
    }
  });

  return {
    ok: true,
    refundId: refund.id,
    refundedAmount: refundedAmountDollars,
  };
}

function toNumber(value: string | number | null): number | null {
  if (value === null) return null;
  return typeof value === "string" ? parseFloat(value) : value;
}

// Markdown-friendly append to bids.staff_notes. Future audit-log work
// (App 9?) replaces this with a proper events table; for now an
// append-to-notes is enough operationally.
function buildRefundNote(
  existing: string | null,
  refundId: string,
  amountDollars: number,
  reason: string,
): string {
  const stamp = new Date().toISOString();
  const block = `\n\n---\n**Refund $${formatMoney(amountDollars)}** (${refundId}) — ${stamp}\n\n${reason}`;
  return (existing ?? "") + block;
}
