import { inngest } from "@/lib/inngest/client";
import { bidSigned, bookingConfirmed } from "@/lib/inngest/events";

// Fires the post-signing workflow events. This reproduces the exact
// contract of the old Dropbox Sign webhook (handle-signature-event.ts
// onSigned), just called inline from the synchronous signing path instead
// of from an async webhook:
//
//   - bid/signed       — always.
//   - booking/confirmed — only when signing reaches the finalization
//                         threshold. With a deposit, that's signed AND
//                         paid; with no deposit, signing alone finalizes
//                         (the bid never reaches 'paid').
//
// Both sends are best-effort: the DB write (signed_at + waiver_documents)
// is the source of truth, so a failed emit is logged, not fatal. The
// dedupe ids match the prior webhook so a sign/pay cross-path race
// collapses to a single workflow run.

export interface SignedSideEffectContext {
  bidId: string;
  bookingId: string;
  signedAt: string;
  paidAt: string | null;
  // Already coerced to a number by the caller (PostgREST can surface a
  // numeric column as a string).
  depositAmount: number;
  startTime: string;
}

export async function emitSignedSideEffects(
  ctx: SignedSideEffectContext,
): Promise<void> {
  try {
    await inngest.send({
      id: `bid-${ctx.bidId}-signed`,
      name: bidSigned.name,
      data: { bidId: ctx.bidId, signedAt: ctx.signedAt },
    });
  } catch (err) {
    console.error("[waiver/record-signature] bid/signed emit failed", {
      bidId: ctx.bidId,
      err,
    });
  }

  const requiresDeposit = ctx.depositAmount > 0;
  const finalized = requiresDeposit ? ctx.paidAt !== null : true;
  if (!finalized) return;

  try {
    await inngest.send({
      id: `booking-${ctx.bookingId}-confirmed`,
      name: bookingConfirmed.name,
      data: {
        bookingId: ctx.bookingId,
        bidId: ctx.bidId,
        eventStartAt: ctx.startTime,
      },
    });
  } catch (err) {
    console.error("[waiver/record-signature] booking/confirmed emit failed", {
      bookingId: ctx.bookingId,
      err,
    });
  }
}
