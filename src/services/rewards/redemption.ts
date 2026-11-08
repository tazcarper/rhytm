import type { SupabaseClient } from "@supabase/supabase-js";
import type { RewardsProgram } from "@/src/constants/rewards/program";
import { getRewardBalance } from "@/src/services/rewards/accounts";
import {
  dollarsForPoints,
  isValidRedemptionAmount,
  maxRedeemablePoints,
} from "@/src/services/rewards/points";

// Applying points at online checkout.
//
// Points are QUOTED when the PaymentIntent is opened (balance + expiry +
// ownership checked here) and DEBITED when Stripe confirms the payment
// (webhook → settle-payment-rewards). The quote travels on the PaymentIntent
// metadata so the webhook knows what discount was given.

export interface RewardRedemption {
  membershipId: string;
  points: number;
  discountUsd: number;
}

export type RedemptionQuoteResult =
  | { ok: true; redemption: RewardRedemption }
  | { ok: false; message: string };

/**
 * A strategy the deposit session calls once it knows the booking and the
 * pre-discount charge. Built by the Server Action, which knows who is
 * signed in; the payment service stays ignorant of auth (Dependency
 * Inversion).
 */
export type RedemptionQuoter = (input: {
  bookingId: string;
  chargeUsd: number;
}) => Promise<RedemptionQuoteResult>;

export interface QuoteRedemptionInput {
  program: RewardsProgram;
  /** Signed-in member's client (RLS scope = their household). */
  viewerSupabase: SupabaseClient;
  /** Service client, to read the booking's linked membership. */
  serviceSupabase: SupabaseClient;
  bookingId: string;
  chargeUsd: number;
  points: number;
}

/** Membership on the booking that the signed-in member belongs to, if any. */
async function viewerMembershipForBooking(
  viewerSupabase: SupabaseClient,
  serviceSupabase: SupabaseClient,
  bookingId: string,
): Promise<string | null> {
  const { data: booking } = await serviceSupabase
    .from("bookings")
    .select("property_id, reward_membership_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return null;

  // RLS on memberships limits this to the viewer's own households.
  const { data: mine } = await viewerSupabase
    .from("memberships")
    .select("id")
    .eq("property_id", booking.property_id as string)
    .eq("status", "active");
  const myIds = new Set((mine ?? []).map((row) => row.id as string));

  const linked = booking.reward_membership_id as string | null;
  if (linked) return myIds.has(linked) ? linked : null;
  return myIds.size === 1 ? [...myIds][0]! : null;
}

export async function quoteRedemption(
  input: QuoteRedemptionInput,
): Promise<RedemptionQuoteResult> {
  const { program, viewerSupabase, serviceSupabase, bookingId, chargeUsd, points } = input;

  if (!isValidRedemptionAmount(program, points)) {
    return { ok: false, message: `Points are applied in steps of ${program.redemptionStep}.` };
  }

  const membershipId = await viewerMembershipForBooking(viewerSupabase, serviceSupabase, bookingId);
  if (!membershipId) {
    return {
      ok: false,
      message: "Sign in to the member account linked to this booking to use points.",
    };
  }

  const balance = await getRewardBalance(viewerSupabase, membershipId);
  if (balance.isExpired) {
    return {
      ok: false,
      message: "Your points are past their expiration date. Contact the property to have them reinstated.",
    };
  }

  const max = maxRedeemablePoints(program, balance.balance, chargeUsd);
  if (points > max) {
    return { ok: false, message: `You can apply up to ${max.toLocaleString()} points on this payment.` };
  }

  return {
    ok: true,
    redemption: { membershipId, points, discountUsd: dollarsForPoints(program, points) },
  };
}

/** What a signed-in member could apply on a booking (for the checkout UI). */
export async function getRedeemableForBooking(input: {
  program: RewardsProgram;
  viewerSupabase: SupabaseClient;
  serviceSupabase: SupabaseClient;
  bookingId: string;
}): Promise<{ membershipId: string; balance: number; isExpired: boolean } | null> {
  const membershipId = await viewerMembershipForBooking(
    input.viewerSupabase,
    input.serviceSupabase,
    input.bookingId,
  );
  if (!membershipId) return null;
  const balance = await getRewardBalance(input.viewerSupabase, membershipId);
  return { membershipId, balance: balance.balance, isExpired: balance.isExpired };
}

// ---- PaymentIntent metadata round-trip ----

const META_MEMBERSHIP = "reward_membership_id";
const META_POINTS = "reward_points_redeemed";
const META_DISCOUNT = "reward_discount_usd";

export function redemptionToMetadata(
  redemption: RewardRedemption | null,
): Record<string, string> {
  if (!redemption) return {};
  return {
    [META_MEMBERSHIP]: redemption.membershipId,
    [META_POINTS]: String(redemption.points),
    [META_DISCOUNT]: redemption.discountUsd.toFixed(2),
  };
}

export function redemptionFromMetadata(
  metadata: Record<string, string> | null | undefined,
): RewardRedemption | null {
  const membershipId = metadata?.[META_MEMBERSHIP];
  const points = Number.parseInt(metadata?.[META_POINTS] ?? "", 10);
  const discountUsd = Number.parseFloat(metadata?.[META_DISCOUNT] ?? "");
  if (!membershipId || !Number.isFinite(points) || points <= 0 || !Number.isFinite(discountUsd)) {
    return null;
  }
  return { membershipId, points, discountUsd };
}

/** Points applied on an existing PaymentIntent (0 when none), for reuse checks. */
export function redeemedPointsOnMetadata(
  metadata: Record<string, string> | null | undefined,
): number {
  return redemptionFromMetadata(metadata)?.points ?? 0;
}
