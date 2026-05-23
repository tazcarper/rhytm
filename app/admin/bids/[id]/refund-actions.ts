"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createStripeClient } from "@/lib/stripe/server";
import {
  refundDeposit,
  type RefundDepositResult,
} from "@/src/services/admin/refund-deposit";

// Admin-triggered refund Server Action. Mirrors the confirmBidAction
// shape in app/admin/bids/[id]/actions.ts: thin wrapper, build the
// service context, delegate, revalidate.
//
// Auth: route is gated by middleware to staff roles (proxy.ts). The
// service uses the cookie-aware Supabase client (admin's RLS scope),
// which satisfies the bids/staff-update policy from Phase 3. No
// service-role bypass needed for this path.

export async function refundDepositAction(
  bidId: string,
  amount: number | undefined,
  reason: string | undefined,
): Promise<RefundDepositResult> {
  if (!bidId) {
    return {
      ok: false,
      reason: "not_found",
      message: "Missing bid id.",
    };
  }

  // Surface schema-level validations before hitting Stripe — saves a
  // round trip on obvious bad input.
  if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
    return {
      ok: false,
      reason: "amount_invalid",
      message: "Refund amount must be a positive number.",
    };
  }

  const trimmedReason = reason?.trim();
  if (trimmedReason && trimmedReason.length > 2000) {
    return {
      ok: false,
      reason: "amount_invalid",
      message: "Reason is too long (max 2000 characters).",
    };
  }

  const supabase = await createServerSupabaseClient();
  const stripe = createStripeClient();

  const result = await refundDeposit({
    supabase,
    stripe,
    bidId,
    amount,
    reason: trimmedReason || undefined,
  });

  if (result.ok) {
    revalidatePath(`/admin/bids/${bidId}`);
    revalidatePath("/admin/bids");
    revalidatePath("/admin");
  }
  return result;
}
