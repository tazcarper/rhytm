import { headers } from "next/headers";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createStripeClient } from "@/lib/stripe/server";
import { handlePaymentIntentSucceeded } from "@/src/services/stripe/handle-payment-intent-succeeded";
import { handleAdventureRsvpSucceeded } from "@/src/services/stripe/handle-adventure-rsvp-succeeded";

// Stripe webhook endpoint. Phase 6 idempotency pattern: signature
// verify → claim into processed_webhooks → dispatch.
//
// The route handler:
//   1. Reads the raw body (signature verify needs the exact bytes).
//   2. Verifies the Stripe-Signature header via constructEvent (throws
//      on bad signature → 400).
//   3. INSERTs a claim into processed_webhooks. ON CONFLICT DO NOTHING
//      means a retry that races the original sees 0 rows and short-
//      circuits with 200 OK — no duplicate processing.
//   4. Dispatches the event to a per-type handler service.
//
// On handler exception we return 500 so Stripe retries. The claim row
// stays — subsequent retries will see it and skip. That's the
// intentional trade-off (claim-first): once we've acknowledged
// receiving the event, we stop processing it; better to drop a single
// event than to risk double-processing. Recovery is via Sentry +
// manual replay from the Stripe dashboard.

// POST handlers are never cached or prerendered — Next.js Route Handler
// docs §Caching — so no `dynamic` export is needed. `runtime = "nodejs"`
// IS required: edge runtime can't run the Node crypto used by
// stripe.webhooks.constructEvent for signature verification.
export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const stripe = createStripeClient();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return new Response("missing signature", { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET is not set");
    return new Response("webhook not configured", { status: 500 });
  }

  // constructEvent requires the raw request body — JSON.parse must not
  // run on it first. Stripe signs the exact bytes; any normalization
  // (whitespace, key ordering) invalidates the signature.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    console.warn("[stripe webhook] signature verification failed", { message });
    return new Response("invalid signature", { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Claim-first idempotency. PK is (id, source, event_type); the same
  // event id retried by Stripe returns 0 rows from the upsert and we
  // short-circuit.
  const { data: claim, error: claimErr } = await supabase
    .from("processed_webhooks")
    .insert({
      id: event.id,
      source: "stripe",
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
    })
    .select("id")
    .maybeSingle();

  if (claimErr) {
    // ON CONFLICT DO NOTHING returns no error AND no rows — so a real
    // error here is something else (table missing, RLS, network).
    // Returning 500 tells Stripe to retry; the next attempt likely
    // hits the same error. Worth a Sentry alert.
    if (claimErr.code === "23505") {
      // Duplicate key — race condition where two webhook deliveries
      // arrived simultaneously. The other won; this one short-circuits.
      return new Response("already processed", { status: 200 });
    }
    console.error("[stripe webhook] claim insert failed", claimErr);
    return new Response("claim failed", { status: 500 });
  }

  if (!claim) {
    // No error + no row = silent ON CONFLICT DO NOTHING. PostgREST
    // returns this when the constraint blocks the insert without
    // raising. Same outcome as the explicit 23505 branch above.
    return new Response("already processed", { status: 200 });
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      // Route by PaymentIntent metadata: adventure RSVPs and bid deposits
      // share the endpoint but confirm different records.
      const pi = event.data.object as Stripe.PaymentIntent;
      if (pi.metadata?.kind === "adventure_rsvp") {
        await handleAdventureRsvpSucceeded({ supabase, event });
      } else {
        await handlePaymentIntentSucceeded({ supabase, event });
      }
    }
    // Other event types: claimed (Stripe won't retry) but no-op.
    // Future handlers register here: payment_intent.payment_failed,
    // charge.refunded (admin refund cross-check), etc.
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[stripe webhook] handler threw", {
      eventId: event.id,
      eventType: event.type,
      err: err instanceof Error ? err.message : String(err),
    });
    return new Response("handler error", { status: 500 });
  }
}
