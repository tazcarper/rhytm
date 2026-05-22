// Stripe publishable key (pk_… or pk_test_…). Safe to ship to the
// browser — it identifies the Stripe account, not the secret-key holder.
// Stripe.js uses it to create the embedded Payment Element session
// against the client_secret the server returned from a Checkout Session.
//
// Read via getPublishableKey() rather than process.env directly so a
// missing value fails fast at the call site with a clear message,
// instead of as a cryptic "Stripe is not defined" at runtime inside
// `loadStripe(undefined)`.
//
// Next.js inlines NEXT_PUBLIC_* into the client bundle at build time,
// so this works equally well in a client component and a Server
// Component (only the client path actually needs it — Server Components
// don't talk to Stripe.js).

export function getPublishableKey(): string {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Add a publishable " +
        "key (pk_test_… for dev, pk_live_… for prod) in .env.local / Vercel env.",
    );
  }
  return key;
}
