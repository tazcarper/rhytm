import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/lib/inngest/client";
import { bidSigned, bookingConfirmed } from "@/lib/inngest/events";

// Dropbox Sign webhook event handler.
//
// Dispatched from app/api/webhooks/dropbox-sign/route.ts after
// signature verification + Phase 6 `processed_webhooks` claim. Three
// event types we care about:
//
//   - signature_request_all_signed: all signers complete. For our
//     single-signer setup this is the canonical "signed" event.
//   - signature_request_signed: per-signer signed. Single-signer →
//     same outcome as all_signed. Multi-signer would partial-update.
//   - signature_request_declined: signer hit decline. Bid stays in
//     current state; we log + flag for admin follow-up.
//   - signature_request_canceled: sender (admin) canceled. Clear
//     envelope reference so the bid page no longer offers signing.
//
// CRITICAL contract (the App 6 workflow finalization rule):
//   bids.signed_at is stamped ALWAYS on a signed event.
//   bids.status is advanced to 'signed' ONLY if currently 'confirmed'.
//   If the bid is already 'paid' (pay-then-sign order), DO NOT
//   regress status — just stamp signed_at. The sync_booking_from_bid
//   trigger would RAISE if we tried to advance bid to 'signed' from
//   booking 'deposit_paid'; the guard below prevents that path.

export interface DropboxSignEventPayload {
  event: {
    event_type:
      | "signature_request_all_signed"
      | "signature_request_signed"
      | "signature_request_declined"
      | "signature_request_canceled"
      | string;
    event_time: string;
  };
  signature_request?: {
    signature_request_id: string;
    metadata?: { bid_id?: string };
  };
}

export interface HandleSignatureEventContext {
  supabase: SupabaseClient;
  payload: DropboxSignEventPayload;
}

export async function handleSignatureEvent(
  ctx: HandleSignatureEventContext,
): Promise<void> {
  const { supabase, payload } = ctx;

  const envelopeId = payload.signature_request?.signature_request_id;
  const eventType = payload.event.event_type;

  if (!envelopeId) {
    console.warn(
      "[dropbox-sign webhook] event missing signature_request_id",
      { eventType },
    );
    return;
  }

  switch (eventType) {
    case "signature_request_all_signed":
    case "signature_request_signed":
      await onSigned(supabase, envelopeId);
      return;

    case "signature_request_declined":
      console.warn(
        "[dropbox-sign webhook] signer declined; admin follow-up required",
        { envelopeId },
      );
      // Future: stamp a `declined_at` or set bid.status='denied' if
      // staff decision. For now: log + leave bid in current state.
      return;

    case "signature_request_canceled":
      // Sender (admin) canceled the envelope. We clear the reference
      // so the bid page stops offering signing. Future polish: a
      // status flag or a "re-create envelope" admin action.
      await supabase
        .from("bids")
        .update({ dropbox_sign_envelope_id: null })
        .eq("dropbox_sign_envelope_id", envelopeId);
      return;

    default:
      // Stripe/Dropbox Sign both fire many event types we don't act
      // on (e.g. signature_request_sent, signature_request_viewed).
      // The route handler still 200s — Dropbox Sign won't retry.
      return;
  }
}

// ---- onSigned -------------------------------------------------------
// Stamp signed_at (always) + conditionally advance status.
//
// The two UPDATEs are intentional. The first is unconditional on
// `signed_at IS NULL` (idempotent — re-firing the webhook for an
// already-signed bid is a no-op). The second has a WHERE that
// excludes already-paid bids, so the sync trigger never has to
// reject a non-applicable transition.
async function onSigned(
  supabase: SupabaseClient,
  envelopeId: string,
): Promise<void> {
  const now = new Date().toISOString();

  // 1. Stamp signed_at. Idempotent on IS NULL guard. The `.select(...)`
  //    returns the affected row only when this call actually performed
  //    the stamp — replays land here with an empty array, which is our
  //    signal to skip the downstream Inngest event. paid_at + booking_id
  //    feed the booking/confirmed convergence check below.
  const { data: stampedRows, error: stampErr } = await supabase
    .from("bids")
    .update({ signed_at: now })
    .eq("dropbox_sign_envelope_id", envelopeId)
    .is("signed_at", null)
    .select("id, signed_at, paid_at, booking_id");

  if (stampErr) {
    console.error(
      "[dropbox-sign webhook] signed_at stamp failed",
      { envelopeId, message: stampErr.message },
    );
    throw stampErr; // let the route handler return 500 → Stripe-equivalent retry behavior
  }

  // 2. Advance status only when current status is `confirmed`. The
  //    WHERE makes this a no-op when bid is already `paid` (App 6
  //    pay-then-sign): we leave status='paid' and just rely on the
  //    signed_at stamp from step 1 for the "fully finalized" rule.
  //
  //    The sync_booking_from_bid trigger fires only when status
  //    changes; the trigger's `signed` arm expects booking in
  //    `awaiting_guest`, which is what confirmed → signed transitions
  //    leave it in. ✓
  const { error: advanceErr } = await supabase
    .from("bids")
    .update({ status: "signed" })
    .eq("dropbox_sign_envelope_id", envelopeId)
    .eq("status", "confirmed");

  if (advanceErr) {
    console.error(
      "[dropbox-sign webhook] status advance failed",
      { envelopeId, message: advanceErr.message },
    );
    throw advanceErr;
  }

  // 3. Fire bid/signed downstream. Skipped on replays (stampedRows
  //    empty when signed_at was already set). Best-effort via after():
  //    the processed_webhooks claim is taken before the handler runs,
  //    so a 500 here would not trigger a meaningful Dropbox Sign retry
  //    of the send — the next delivery would short-circuit on the
  //    duplicate claim. Logged failures are observable; the DB stamp
  //    is the source of truth.
  const stamped = stampedRows?.[0] as
    | { id: string; signed_at: string; paid_at: string | null; booking_id: string }
    | undefined;
  if (stamped) {
    after(() =>
      fireBidSignedEventBestEffort({
        bidId: stamped.id,
        signedAt: stamped.signed_at,
      }),
    );

    // 4. booking/confirmed when signing reaches the finalization
    //    threshold. Two cases land here (mirrors bid-timeline.tsx's
    //    "finalized" rule):
    //      - pay-then-sign: bid already has paid_at, so signing is
    //        the second-of-two and tips it into finalized.
    //      - waiver-only: bid's booking has no deposit_amount, so
    //        signing alone finalizes (the bid never reaches 'paid').
    //    The sign-then-pay convergence fires from the Stripe handler.
    //    Shared dedupe id (booking-${bookingId}-confirmed) squashes
    //    any cross-webhook race.
    after(() =>
      fireBookingConfirmedIfFinalizedBestEffort({
        supabase,
        bidId: stamped.id,
        bookingId: stamped.booking_id,
        paidAt: stamped.paid_at,
      }),
    );
  }
}

interface FireBookingConfirmedIfFinalizedArgs {
  supabase: SupabaseClient;
  bidId: string;
  bookingId: string;
  paidAt: string | null;
}

async function fireBookingConfirmedIfFinalizedBestEffort(
  args: FireBookingConfirmedIfFinalizedArgs,
): Promise<void> {
  try {
    const { data: booking, error } = await args.supabase
      .from("bookings")
      .select("start_time, deposit_amount")
      .eq("id", args.bookingId)
      .single<{ start_time: string; deposit_amount: number | string | null }>();

    if (error || !booking) {
      console.error(
        "[dropbox-sign webhook] booking lookup for booking/confirmed failed",
        { bookingId: args.bookingId, error },
      );
      return;
    }

    // requiresDeposit mirrors get-bid.ts:335 (deposit_amount > 0).
    // Numeric columns come back as string from PostgREST in some
    // contexts, so coerce defensively.
    const depositAmount =
      typeof booking.deposit_amount === "string"
        ? parseFloat(booking.deposit_amount)
        : (booking.deposit_amount ?? 0);
    const requiresDeposit = depositAmount > 0;

    const finalized = requiresDeposit ? args.paidAt !== null : true;
    if (!finalized) return;

    await inngest.send({
      id: `booking-${args.bookingId}-confirmed`,
      name: bookingConfirmed.name,
      data: {
        bookingId: args.bookingId,
        bidId: args.bidId,
        eventStartAt: booking.start_time,
      },
    });
  } catch (err) {
    console.error(
      "[dropbox-sign webhook] inngest booking/confirmed send failed",
      { bookingId: args.bookingId, err },
    );
  }
}

interface BidSignedEventArgs {
  bidId: string;
  signedAt: string;
}

async function fireBidSignedEventBestEffort(
  args: BidSignedEventArgs,
): Promise<void> {
  try {
    await inngest.send({
      id: `bid-${args.bidId}-signed`,
      name: bidSigned.name,
      data: {
        bidId: args.bidId,
        signedAt: args.signedAt,
      },
    });
  } catch (err) {
    console.error(
      "[dropbox-sign webhook] inngest bid/signed send failed",
      { bidId: args.bidId, err },
    );
  }
}
