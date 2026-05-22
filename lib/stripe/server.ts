import Stripe from "stripe";

// Server-only Stripe client. Reads STRIPE_SECRET_KEY (a Restricted API
// Key is preferred — Stripe's `rk_…` and `sk_…` keys are interchangeable
// at the SDK layer; the variable name remains `STRIPE_SECRET_KEY`
// regardless). Never import this from a client component.
//
// Singleton-per-process: the Stripe SDK maintains an HTTP keepalive pool
// internally, so reusing one client across requests amortizes the TLS
// handshake. The Supabase service client is rebuilt per request because
// it carries no connection state; the Stripe client is the opposite.
//
// API version is pinned to the SDK's compiled-in `LatestApiVersion`.
// When we upgrade the `stripe` package, that constant moves and this
// import either still matches (no action) or fails to type-check
// (action required: review API change notes before bumping).
//
// Use for:
//   - Server Action: createDepositSession (Checkout Session create)
//   - Webhook route: signature verification + event handling
//   - Admin Server Action: refundDeposit (Refunds API)
//
// Never:
//   - Pass a Stripe instance to a client component or serialize it.
//   - Log the secret key or include it in error messages.

let cached: Stripe | undefined;

export function createStripeClient(): Stripe {
  if (cached) return cached;

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add a Restricted API Key (rk_…) " +
        "in .env.local for development or in Vercel env for deploys.",
    );
  }

  cached = new Stripe(secret, {
    apiVersion: "2026-04-22.dahlia",
  });
  return cached;
}
