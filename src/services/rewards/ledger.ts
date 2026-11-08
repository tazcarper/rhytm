import type { SupabaseClient } from "@supabase/supabase-js";
import { REWARDS_PROGRAM } from "@/src/constants/rewards/program";

// Write side of the rewards ledger. The ledger is append-only; the
// database functions (post_reward_transaction / staff_post_reward_transaction)
// do the locking, balance check, expiry check and idempotency. These
// wrappers only shape inputs and translate the database's error codes into
// domain reasons.

export type RewardKind = "earn" | "redeem" | "adjustment";

export interface RewardEntryInput {
  membershipId: string;
  /** Signed: positive adds, negative subtracts. */
  points: number;
  kind: RewardKind;
  reason: string;
  /** YYYY-MM-DD business date; defaults to today in the database. */
  occurredOn?: string;
  amountUsd?: number;
}

export interface AutomatedRewardEntryInput extends RewardEntryInput {
  paymentIntentId: string;
  bookingId?: string;
  adventureRsvpId?: string;
  /** A discount already given at checkout is recorded even if the balance moved since. */
  allowNegative?: boolean;
}

export type PostRewardResult =
  | { ok: true; transactionId: string }
  | {
      ok: false;
      reason: "insufficient_points" | "expired" | "not_authorized" | "db_error";
      message: string;
    };

function toResult(
  data: { id: string } | null,
  error: { message: string } | null,
): PostRewardResult {
  if (!error && data) return { ok: true, transactionId: data.id };
  const message = error?.message ?? "";
  if (message.includes("reward_insufficient_points")) {
    return { ok: false, reason: "insufficient_points", message: "Not enough points for that." };
  }
  if (message.includes("reward_points_expired")) {
    return {
      ok: false,
      reason: "expired",
      message: "These points are past their expiration date. Extend the date first to use them.",
    };
  }
  if (message.includes("not_authorized")) {
    return { ok: false, reason: "not_authorized", message: "You can't change points for this membership." };
  }
  return { ok: false, reason: "db_error", message: "Couldn't save the points. Try again in a moment." };
}

/**
 * Automated entry from a Stripe payment. Requires a service-role client
 * (EXECUTE is granted to service_role only). Idempotent per
 * (PaymentIntent, kind): a replayed webhook returns the original row.
 */
export async function postAutomatedRewardEntry(
  serviceSupabase: SupabaseClient,
  entry: AutomatedRewardEntryInput,
): Promise<PostRewardResult> {
  const { data, error } = await serviceSupabase
    .rpc("post_reward_transaction", {
      p_membership_id: entry.membershipId,
      p_points: entry.points,
      p_kind: entry.kind,
      p_source: "online_payment",
      p_reason: entry.reason,
      p_occurred_on: entry.occurredOn ?? null,
      p_expiry_months: REWARDS_PROGRAM.expiryMonths,
      p_amount_usd: entry.amountUsd ?? null,
      p_booking_id: entry.bookingId ?? null,
      p_adventure_rsvp_id: entry.adventureRsvpId ?? null,
      p_payment_intent_id: entry.paymentIntentId,
      p_allow_negative: entry.allowNegative ?? false,
      p_enforce_expiry: !(entry.allowNegative ?? false),
    })
    .single<{ id: string }>();
  return toResult(data, error);
}

/**
 * Staff entry from the admin Rewards page. Uses the signed-in staff
 * member's client: the database checks their property scope and stamps
 * created_by from their session.
 */
export async function postStaffRewardEntry(
  staffSupabase: SupabaseClient,
  entry: RewardEntryInput,
): Promise<PostRewardResult> {
  const { data, error } = await staffSupabase
    .rpc("staff_post_reward_transaction", {
      p_membership_id: entry.membershipId,
      p_points: entry.points,
      p_kind: entry.kind,
      p_reason: entry.reason,
      p_occurred_on: entry.occurredOn ?? null,
      p_expiry_months: REWARDS_PROGRAM.expiryMonths,
      p_amount_usd: entry.amountUsd ?? null,
    })
    .single<{ id: string }>();
  return toResult(data, error);
}

/** Staff moves the soft expiration date. The balance is never touched. */
export async function setRewardExpiry(
  staffSupabase: SupabaseClient,
  membershipId: string,
  expiresAtIso: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await staffSupabase.rpc("staff_set_reward_expiry", {
    p_membership_id: membershipId,
    p_expires_at: expiresAtIso,
  });
  if (error) {
    return {
      ok: false,
      message: error.message.includes("not_authorized")
        ? "You can't change this membership's rewards."
        : "Couldn't update the expiration date.",
    };
  }
  return { ok: true };
}
