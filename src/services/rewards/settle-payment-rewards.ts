import type { SupabaseClient } from "@supabase/supabase-js";
import type { RewardsProgram } from "@/src/constants/rewards/program";
import { postAutomatedRewardEntry } from "@/src/services/rewards/ledger";
import { pointsForPayment } from "@/src/services/rewards/points";
import type { RewardRedemption } from "@/src/services/rewards/redemption";
import {
  loadBookingRewardContext,
  resolveRewardMembershipForBooking,
} from "@/src/services/rewards/resolve-membership";

// Turns a confirmed online payment into ledger entries:
//   - debit the points that were applied as a discount (if any)
//   - credit points on the cash actually charged
//
// Called from the Stripe webhook handlers AFTER the payment is recorded.
// Every ledger write is idempotent on (PaymentIntent, kind), so a replayed
// webhook can't double-credit. Never throws: rewards must not break the
// payment path — failures are logged for staff to fix by hand.

export interface SettledRewards {
  membershipId: string | null;
  pointsEarned: number;
  pointsRedeemed: number;
}

const NONE: SettledRewards = { membershipId: null, pointsEarned: 0, pointsRedeemed: 0 };

export interface SettleBookingPaymentInput {
  program: RewardsProgram;
  bookingId: string;
  paymentIntentId: string;
  /** What the card was charged (after any points discount). */
  amountChargedUsd: number;
  redemption: RewardRedemption | null;
}

export async function settleBookingPaymentRewards(
  serviceSupabase: SupabaseClient,
  input: SettleBookingPaymentInput,
): Promise<SettledRewards> {
  try {
    const { program, bookingId, paymentIntentId, amountChargedUsd, redemption } = input;
    const context = await loadBookingRewardContext(serviceSupabase, bookingId);
    if (!context) return NONE;

    let pointsRedeemed = 0;
    if (redemption) {
      const result = await postAutomatedRewardEntry(serviceSupabase, {
        membershipId: redemption.membershipId,
        points: -redemption.points,
        kind: "redeem",
        reason: `Applied $${redemption.discountUsd.toFixed(2)} at online checkout`,
        amountUsd: redemption.discountUsd,
        bookingId,
        paymentIntentId,
        // The discount was already given; record it even if the balance moved.
        allowNegative: true,
      });
      if (result.ok) pointsRedeemed = redemption.points;
      else console.error("[rewards] redemption debit failed", { bookingId, paymentIntentId, result });
    }

    // A redemption pins the membership (the payer proved they own it).
    const membershipId =
      redemption?.membershipId ?? (await resolveRewardMembershipForBooking(serviceSupabase, context));
    if (!membershipId) return { ...NONE, pointsRedeemed };

    await serviceSupabase
      .from("bookings")
      .update({
        reward_membership_id: membershipId,
        reward_points_redeemed: pointsRedeemed,
      })
      .eq("id", bookingId);

    const points = pointsForPayment(program, amountChargedUsd);
    if (points === 0) return { membershipId, pointsEarned: 0, pointsRedeemed };

    const earn = await postAutomatedRewardEntry(serviceSupabase, {
      membershipId,
      points,
      kind: "earn",
      reason: `Online payment of $${amountChargedUsd.toFixed(2)}`,
      amountUsd: amountChargedUsd,
      bookingId,
      paymentIntentId,
    });
    if (!earn.ok) {
      console.error("[rewards] earn credit failed", { bookingId, paymentIntentId, earn });
      return { membershipId, pointsEarned: 0, pointsRedeemed };
    }
    return { membershipId, pointsEarned: points, pointsRedeemed };
  } catch (err) {
    console.error("[rewards] settleBookingPaymentRewards threw", { input, err });
    return NONE;
  }
}

export interface SettleAdventurePaymentInput {
  program: RewardsProgram;
  rsvpId: string;
  membershipId: string | null;
  paymentIntentId: string;
  amountChargedUsd: number;
}

/** Member adventures are always booked from a member account, so the membership is known. */
export async function settleAdventurePaymentRewards(
  serviceSupabase: SupabaseClient,
  input: SettleAdventurePaymentInput,
): Promise<SettledRewards> {
  try {
    const { program, rsvpId, membershipId, paymentIntentId, amountChargedUsd } = input;
    if (!membershipId) return NONE;
    const points = pointsForPayment(program, amountChargedUsd);
    if (points === 0) return { membershipId, pointsEarned: 0, pointsRedeemed: 0 };

    const earn = await postAutomatedRewardEntry(serviceSupabase, {
      membershipId,
      points,
      kind: "earn",
      reason: `Adventure payment of $${amountChargedUsd.toFixed(2)}`,
      amountUsd: amountChargedUsd,
      adventureRsvpId: rsvpId,
      paymentIntentId,
    });
    if (!earn.ok) {
      console.error("[rewards] adventure earn failed", { rsvpId, paymentIntentId, earn });
      return { membershipId, pointsEarned: 0, pointsRedeemed: 0 };
    }
    return { membershipId, pointsEarned: points, pointsRedeemed: 0 };
  } catch (err) {
    console.error("[rewards] settleAdventurePaymentRewards threw", { input, err });
    return NONE;
  }
}

export interface ReverseRefundInput {
  program: RewardsProgram;
  bookingId: string;
  /** Stripe refund id — the idempotency key for the reversal entry. */
  refundId: string;
  refundedCardUsd: number;
  isFullRefund: boolean;
}

/**
 * When a booking payment is refunded: take back the points that payment
 * earned (all of them on a full refund, 1 per refunded dollar on a partial
 * one) and, on a full refund, give back any points that were applied as a
 * discount. Posted as one net adjustment keyed on the refund id. May take
 * the balance below zero if the points were already spent. Never throws.
 */
export async function reverseBookingRefundRewards(
  serviceSupabase: SupabaseClient,
  input: ReverseRefundInput,
): Promise<void> {
  try {
    const { data: booking } = await serviceSupabase
      .from("bookings")
      .select("reward_membership_id, reward_points_redeemed")
      .eq("id", input.bookingId)
      .maybeSingle();
    const membershipId = (booking?.reward_membership_id as string | null) ?? null;
    if (!membershipId) return;

    const { data: earnRows } = await serviceSupabase
      .from("reward_transactions")
      .select("points")
      .eq("booking_id", input.bookingId)
      .eq("kind", "earn");
    const earned = (earnRows ?? []).reduce((sum, row) => sum + (row.points as number), 0);

    const takeBack = input.isFullRefund
      ? earned
      : Math.min(earned, pointsForPayment(input.program, input.refundedCardUsd));
    const giveBack = input.isFullRefund
      ? ((booking?.reward_points_redeemed as number | null) ?? 0)
      : 0;
    const net = giveBack - takeBack;
    if (net === 0) return;

    const parts = [
      takeBack > 0 ? `removed ${takeBack} points earned` : null,
      giveBack > 0 ? `returned ${giveBack} points used` : null,
    ].filter(Boolean);

    const result = await postAutomatedRewardEntry(serviceSupabase, {
      membershipId,
      points: net,
      kind: "adjustment",
      reason: `Refund of $${input.refundedCardUsd.toFixed(2)}: ${parts.join(", ")}`,
      amountUsd: input.refundedCardUsd,
      bookingId: input.bookingId,
      paymentIntentId: input.refundId,
      allowNegative: true,
    });
    if (!result.ok) console.error("[rewards] refund reversal failed", { input, result });
  } catch (err) {
    console.error("[rewards] reverseBookingRefundRewards threw", { input, err });
  }
}
