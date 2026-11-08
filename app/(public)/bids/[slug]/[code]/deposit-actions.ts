"use server";

import { createStripeClient } from "@/lib/stripe/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { REWARDS_PROGRAM } from "@/src/constants/rewards/program";
import { quoteRedemption } from "@/src/services/rewards/redemption";
import {
  createDepositSession,
  type CreateDepositSessionResult,
} from "@/src/services/stripe/create-deposit-session";

// Server Action invoked by the client <DepositPaymentForm> (App 6.4) to
// open or reuse a Stripe PaymentIntent for the deposit. Thin wrapper —
// builds the service context and delegates. Per CLAUDE.md "one action,
// one purpose": no email, no logging beyond what the service emits.
//
// (slug, code) come from the URL path — the page component reads them
// from `params` and passes them to the client form, which passes them
// here. The service re-verifies the access code on every call; the URL
// is not implicitly trusted.
//
// `rewardPoints` (optional): points the signed-in member wants applied as
// a discount. The quote runs against the viewer's own session, so points
// can only come from a household the viewer belongs to.

export async function createDepositSessionAction(
  bidSlug: string,
  bidAccessCode: string,
  amount?: number,
  rewardPoints?: number,
): Promise<CreateDepositSessionResult> {
  const serviceSupabase = createServiceRoleClient();
  const points = rewardPoints ?? 0;

  return createDepositSession({
    supabase: serviceSupabase,
    stripe: createStripeClient(),
    bidSlug,
    bidAccessCode,
    amount,
    quoteRedemption:
      points > 0
        ? async ({ bookingId, chargeUsd }) =>
            quoteRedemption({
              program: REWARDS_PROGRAM,
              viewerSupabase: await createServerSupabaseClient(),
              serviceSupabase,
              bookingId,
              chargeUsd,
              points,
            })
        : undefined,
  });
}
