"use server";

import { createStripeClient } from "@/lib/stripe/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
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

export async function createDepositSessionAction(
  bidSlug: string,
  bidAccessCode: string,
): Promise<CreateDepositSessionResult> {
  return createDepositSession({
    supabase: createServiceRoleClient(),
    stripe: createStripeClient(),
    bidSlug,
    bidAccessCode,
  });
}
