import { createElement } from "react";
import { after } from "next/server";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/lib/inngest/client";
import { bidDepositPaid, bookingConfirmed } from "@/lib/inngest/events";
import {
  DEFAULT_FROM_EMAIL,
  getEmailService,
} from "@/src/services/notifications/send-email";
import { DepositReceipt } from "@/src/components/email/templates/deposit-receipt";
import {
  formatDateLongTz,
  formatMoney,
  formatSlotLabelTz,
} from "@/src/services/public/format";

// Webhook handler for payment_intent.succeeded — the moment a deposit
// clears Stripe. Flips bids.status='paid' (the trigger fans out to
// bookings.status='deposit_paid') and stamps bids.paid_at. Sends a
// branded receipt via the existing EmailService (LoggingEmailService
// writes to dev_email_outbox today; App 8 swaps in Resend).
//
// SOLID: receives supabase + event; no I/O it didn't ask for. The
// route handler is responsible for signature verification and
// processed_webhooks claim before calling here.
//
// The receipt send goes through `after()` from `next/server` so it
// runs post-response. Stripe needs us to return 200 quickly (its
// retry policy starts at 5s); rendering + sending the email is on
// the order of 100-500ms and doesn't need to block.

export interface HandlePaymentIntentSucceededContext {
  supabase: SupabaseClient;
  event: Stripe.Event;
}

export async function handlePaymentIntentSucceeded(
  ctx: HandlePaymentIntentSucceededContext,
): Promise<void> {
  const { supabase, event } = ctx;
  const pi = event.data.object as Stripe.PaymentIntent;

  const bidId = pi.metadata?.bid_id;
  const bookingId = pi.metadata?.booking_id;
  if (!bidId || !bookingId) {
    // Not a deposit PI we created — could be a future feature or a
    // misrouted event. Skip without erroring; the route handler still
    // returns 200 so Stripe stops retrying.
    console.warn("[stripe webhook] payment_intent.succeeded missing metadata", {
      piId: pi.id,
      eventId: event.id,
    });
    return;
  }

  // 1. Flip the bid. The WHERE clause refuses to act on a bid that's
  //    already paid (duplicate event that beat the processed_webhooks
  //    claim — rare but defended) or in a non-payable terminal state
  //    (refunded/denied/expired, which would mean staff acted between
  //    PI charge and webhook arrival).
  const { data: updatedBid, error: updateErr } = await supabase
    .from("bids")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("id", bidId)
    .in("status", ["confirmed", "signed"])
    .select("id, slug, signed_at")
    .maybeSingle();

  if (updateErr) {
    // Hard DB failure. Don't suppress — let the route handler return
    // 500 so Stripe retries. The processed_webhooks claim row is
    // already in place; Stripe's retry will see it and skip, so this
    // event is effectively dropped after the first failure. Surface
    // to Sentry in App 10.
    throw new Error(
      `[stripe webhook] bid update failed: ${updateErr.message}`,
    );
  }

  if (!updatedBid) {
    // 0 rows matched. Either already paid (duplicate event) or status
    // moved to refunded/denied/expired since the PI was created. Log
    // for visibility; don't send a receipt for a bid that's no longer
    // in a payable state.
    console.warn(
      "[stripe webhook] payment_intent.succeeded but bid not in payable state",
      { bidId, piId: pi.id, eventId: event.id },
    );
    return;
  }

  // 1a. Fire bid/deposit-paid downstream. Only when this call actually
  //     flipped the bid (updatedBid non-null) — replays land in the
  //     warn-and-return branch above and skip this. Best-effort via
  //     after(): the processed_webhooks claim is taken before the
  //     handler runs, so a 5xx here would not trigger a Stripe replay
  //     of the send (the next delivery short-circuits on the duplicate
  //     claim). DB flip is the source of truth; a missed send is
  //     observable via the [stripe webhook] log lines.
  after(() =>
    fireBidDepositPaidEventBestEffort({
      bidId,
      amountPaidCents: pi.amount,
      paymentIntentId: pi.id,
    }),
  );

  // 1b. Reconcile the booking with the PI that actually succeeded.
  //     The webhook is the authoritative truth — overwrite both
  //     columns unconditionally:
  //       - deposit_payment_intent_id: in normal flow the Server
  //         Action already wrote this, but if that write failed OR if
  //         the column references a stale PI from an earlier amount
  //         (Path A: amount changes create new PIs), the column may
  //         reference the wrong PI. The PI that fired this webhook is
  //         the one that got the money — make sure the column points
  //         to it so the refund flow finds the right thing.
  //       - amount_paid: Stripe's pi.amount is the source of truth
  //         for what they paid. Always reflect it.
  //     Single UPDATE keeps the writes atomic relative to each other.
  const amountPaidDollars = pi.amount / 100;
  await supabase
    .from("bookings")
    .update({
      deposit_payment_intent_id: pi.id,
      amount_paid: amountPaidDollars,
    })
    .eq("id", bookingId);

  // 2. Fetch receipt data. Single query — we only need a few columns
  //    and the property name for the body copy.
  const { data: receipt, error: receiptErr } = await supabase
    .from("bookings")
    .select(
      `
      id, guest_name, guest_email, start_time,
      deposit_amount, confirmed_price, estimated_price,
      properties ( name, timezone )
    `,
    )
    .eq("id", bookingId)
    .single<ReceiptRow>();

  if (receiptErr || !receipt || !receipt.properties) {
    // The bid is paid (DB-of-record agrees); the receipt is best-effort.
    // Log + return; staff can resend manually if needed.
    console.warn(
      "[stripe webhook] receipt data fetch failed; bid still marked paid",
      {
        bidId,
        bookingId,
        receiptErr: receiptErr?.message,
      },
    );
    return;
  }

  // 2b. Fire booking/confirmed when paying finalizes the booking. This
  //     is the sign-then-pay convergence: bid was 'signed' before the
  //     payment, so paying tips it into the "fully finalized" state
  //     (mirrors bid-timeline's `signedDone && paidDone` rule). The
  //     pay-then-sign and no-deposit paths fire this event from the
  //     Dropbox Sign handler instead. Shared dedupe id squashes any
  //     race where both sides race to fire.
  if (updatedBid.signed_at !== null) {
    after(() =>
      fireBookingConfirmedEventBestEffort({
        bookingId,
        bidId,
        eventStartAt: receipt.start_time,
      }),
    );
  }

  // 3. Queue the receipt send post-response.
  const propertyName = receipt.properties.name;
  const timezone = receipt.properties.timezone;
  const dateLong = formatDateLongTz(receipt.start_time, timezone);
  const timeLabel = `${formatSlotLabelTz(receipt.start_time, timezone)} CT`;
  const depositAmount = toNumber(receipt.deposit_amount) ?? 0;
  // Coalesce: admin may have explicitly set confirmed_price OR left
  // it blank to keep the auto-estimate (the bid editor's documented
  // behavior). The receipt copy uses whichever applies.
  const effectiveQuote =
    toNumber(receipt.confirmed_price) ?? toNumber(receipt.estimated_price);
  const waiverSigned = updatedBid.signed_at !== null;

  // Path A copy branching. "Full" = paid the entire effective quote
  // (or, if no quote at all was set, exactly the deposit — the
  // historical fixed-amount flow). "Partial" = paid more than the
  // deposit but less than the quote. "Deposit-only" = paid exactly
  // the deposit.
  const isFullPayment =
    effectiveQuote !== null
      ? amountPaidDollars + 1e-9 >= effectiveQuote
      : true; // no quote set → whatever was paid is the full thing
  const balanceDue = effectiveQuote !== null
    ? Math.max(0, effectiveQuote - amountPaidDollars)
    : 0;

  const props = {
    guestName: receipt.guest_name,
    propertyName,
    dateLong,
    timeLabel,
    amountPaid: formatMoney(amountPaidDollars),
    depositAmount: formatMoney(depositAmount),
    balanceDue: formatMoney(balanceDue),
    isFullPayment,
    hasBalance: balanceDue > 0,
    waiverSigned,
  };

  const subject = isFullPayment
    ? waiverSigned
      ? `Payment received — see you on ${dateLong}`
      : "Payment received — one more step"
    : waiverSigned
      ? `Deposit received — see you on ${dateLong}`
      : "Deposit received — one more step";

  after(async () => {
    try {
      const result = await getEmailService().send({
        to: receipt.guest_email,
        from: DEFAULT_FROM_EMAIL,
        subject,
        template: {
          name: "deposit_receipt",
          element: createElement(DepositReceipt, props),
          props,
        },
        source: "stripe_webhook",
      });
      if (!result.ok) {
        console.error(
          "[stripe webhook] receipt send failed",
          { bidId, error: result.error },
        );
      }
    } catch (err) {
      console.error("[stripe webhook] receipt send threw", { bidId, err });
    }
  });
}

type ReceiptRow = {
  id: string;
  guest_name: string;
  guest_email: string;
  start_time: string;
  deposit_amount: string | number | null;
  confirmed_price: string | number | null;
  estimated_price: string | number | null;
  properties: { name: string; timezone: string } | null;
};

function toNumber(value: string | number | null): number | null {
  if (value === null) return null;
  return typeof value === "string" ? parseFloat(value) : value;
}

interface BookingConfirmedEventArgs {
  bookingId: string;
  bidId: string;
  eventStartAt: string;
}

async function fireBookingConfirmedEventBestEffort(
  args: BookingConfirmedEventArgs,
): Promise<void> {
  try {
    await inngest.send({
      id: `booking-${args.bookingId}-confirmed`,
      name: bookingConfirmed.name,
      data: {
        bookingId: args.bookingId,
        bidId: args.bidId,
        eventStartAt: args.eventStartAt,
      },
    });
  } catch (err) {
    console.error(
      "[stripe webhook] inngest booking/confirmed send failed",
      { bookingId: args.bookingId, err },
    );
  }
}

interface BidDepositPaidEventArgs {
  bidId: string;
  amountPaidCents: number;
  paymentIntentId: string;
}

async function fireBidDepositPaidEventBestEffort(
  args: BidDepositPaidEventArgs,
): Promise<void> {
  try {
    await inngest.send({
      // Bid-keyed dedupe: a bid can only transition to `paid` from
      // `confirmed`/`signed` (Path A blocks re-payment of an already-
      // paid bid via the UPDATE WHERE), so one bid → one successful
      // payment → one event in practice.
      id: `bid-${args.bidId}-deposit-paid`,
      name: bidDepositPaid.name,
      data: {
        bidId: args.bidId,
        amountPaidCents: args.amountPaidCents,
        paymentIntentId: args.paymentIntentId,
      },
    });
  } catch (err) {
    console.error(
      "[stripe webhook] inngest bid/deposit-paid send failed",
      { bidId: args.bidId, err },
    );
  }
}
