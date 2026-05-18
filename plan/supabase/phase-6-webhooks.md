# Phase 6 — Webhook Idempotency

## Prerequisites

- Phase 1 complete
- `pg_cron` extension enabled on the Supabase project. On Supabase, `pg_cron` lives in the `extensions` schema and must be enabled once via the dashboard's **Database → Extensions** page (or `CREATE EXTENSION` from the SQL editor with the right search_path) before this migration runs.
- No other application tables required.

## What This Phase Builds

`processed_webhooks`

One table — enabled with RLS (no policies) so the service role is the only path in. Deploy it before any webhook Route Handler is written.

---

## Why This Table Must Exist Before Webhooks

Stripe and Dropbox Sign both retry webhook delivery when they do not receive a `200` response within their timeout window. This happens legitimately — a cold Vercel function, a brief network blip, a Supabase connection spike. Without idempotency tracking:

- A `payment_intent.succeeded` retry charges the deposit twice
- A Dropbox Sign `signature_request_signed` retry creates a second HubSpot deal
- An Inngest step that sends a confirmation email fires twice

The pattern is: **check before processing, record after processing.** If the event ID already exists in `processed_webhooks`, return `200` immediately and do nothing.

---

## Migration

```sql
CREATE TABLE processed_webhooks (
  id           text        NOT NULL,   -- provider's event ID (Stripe evt_xxx, Dropbox Sign envelope ID, etc.)
  source       text        NOT NULL CHECK (source IN ('stripe', 'dropbox_sign')),
  event_type   text        NOT NULL,   -- provider's event type (e.g. payment_intent.succeeded, signature_request_signed)
  payload      jsonb       NOT NULL,   -- raw event body, kept for 30-day debugging window
  processed_at timestamptz NOT NULL DEFAULT now(),

  -- A given (provider, object, event-type) tuple is independently idempotent.
  -- Including event_type matters for providers that fire multiple event types
  -- against the same object — Dropbox Sign sends both signature_request_signed
  -- and signature_request_all_signed against the same envelope_id; without
  -- event_type in the PK, the first one to land would block the second.
  PRIMARY KEY (id, source, event_type)
);

-- RLS enabled with NO policies. Supabase grants anon/authenticated default
-- read/write on every public-schema table, so leaving RLS off would let the
-- anon key list every webhook we've processed. Enabled-with-no-policies
-- denies all access except the service role.
ALTER TABLE processed_webhooks ENABLE ROW LEVEL SECURITY;

-- Cleanup query (see below) filters on processed_at.
CREATE INDEX idx_processed_webhooks_cleanup
  ON processed_webhooks (processed_at);
```

The PK doubles as the idempotency index — the claim INSERT in the route handler relies on it (see *Usage Pattern* below).

---

## Usage Pattern

Every webhook Route Handler follows this exact sequence. **Claim first, then process inside a transaction.** The previous "check, process, record" pattern has a race window between the check and the record where two concurrent retries can both pass and both process; the claim-first pattern below is atomic.

```typescript
// app/api/webhooks/stripe/route.ts
import { createClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  const supabase = createClient()  // service role client

  // 1. Verify the webhook signature first. The shared secret lives in the
  //    Vercel env var STRIPE_WEBHOOK_SECRET (or DROPBOX_SIGN_WEBHOOK_SECRET).
  //    A request that fails signature verification never reaches the DB.
  const event = await verifyStripeWebhook(request)
  if (!event) return new Response('Invalid signature', { status: 400 })

  // 2. Atomic claim. INSERT with ON CONFLICT DO NOTHING; if another instance
  //    won the race, the insert returns 0 rows and we exit early with 200.
  //    The PK (id, source, event_type) makes this conflict the unique key.
  const { data: claim, error: claimError } = await supabase
    .from('processed_webhooks')
    .insert({
      id:         event.id,
      source:     'stripe',
      event_type: event.type,
      payload:    event,
    })
    .select('id')
    .maybeSingle()  // returns null on conflict (duplicate key)

  if (claimError && claimError.code !== '23505') {
    // Real DB error — surface to Sentry, do NOT 200 (Stripe will retry).
    throw claimError
  }
  if (!claim) {
    // Another instance already claimed it; treat as a no-op success.
    return new Response('Already processed', { status: 200 })
  }

  // 3. Process the event inside the same logical transaction as the claim.
  //    If anything throws here, the surrounding handler returns 5xx;
  //    Stripe will retry, and the next attempt will find no existing
  //    claim *because step 2 only commits when the handler returns 2xx*.
  //
  //    For Supabase, this means wrapping steps 2 + 3 in a Postgres function
  //    (RPC) or in a transaction-aware client. The simplest pattern is a
  //    Postgres function that does both, called via supabase.rpc():
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handleDepositPaid(event.data.object, supabase)
        break
      // …other event types
    }
  } catch (err) {
    // Roll back the claim so retry can re-attempt. Without this, the claim
    // would survive (PostgREST inserts auto-commit) and the next retry
    // would no-op despite never having completed the work.
    await supabase
      .from('processed_webhooks')
      .delete()
      .eq('id', event.id)
      .eq('source', 'stripe')
      .eq('event_type', event.type)
    throw err
  }

  return new Response('OK', { status: 200 })
}
```

**Why a try/catch + DELETE instead of an actual SQL transaction.** PostgREST (the layer Supabase exposes to client libraries) auto-commits each statement; there is no `BEGIN`/`COMMIT` from the JS client. The claim INSERT lands immediately. If you need true atomicity between the claim and the work, two options:

- **Recommended for complex flows:** wrap the entire idempotency-check + processing in a Postgres function (`CREATE FUNCTION process_stripe_event(...) RETURNS … AS $$ BEGIN … END; $$`) and invoke it via `supabase.rpc('process_stripe_event', { … })`. Functions run inside a single implicit transaction; a `RAISE EXCEPTION` rolls back everything including the claim.
- **Acceptable for simple flows:** the explicit DELETE-on-throw shown above. The race window is the duration of `handleDepositPaid` plus the time before the DELETE lands; for handler crashes (memory, timeout) the DELETE may not run and the claim is stuck. Operational recovery is a manual `DELETE FROM processed_webhooks WHERE …` and a Stripe replay.

The first option is the right default. The second is fine for handlers that are themselves trivially idempotent (e.g., setting a single column with `update().eq()`).

**Inngest paths.** Webhooks that fan out to Inngest only need claim-first for the *receiving Route Handler*. The work Inngest does downstream has its own retry semantics and dead-letter queue. Just ensure the Inngest event includes the original webhook event_id so Inngest can dedupe on its side.

---

## Cleanup

Stripe's retry window is 72 hours. Dropbox Sign's is similar. Records older than 30 days are safe to delete — no provider will retry that far back.

Schedule a weekly cleanup via Supabase's `pg_cron` extension:

```sql
-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Run every Sunday at 3 AM UTC
SELECT cron.schedule(
  'cleanup-processed-webhooks',
  '0 3 * * 0',
  $$
    DELETE FROM processed_webhooks
    WHERE processed_at < now() - interval '30 days';
  $$
);
```

This keeps the table small. At ~100 bookings/month across all webhook events (deposit, signature, HubSpot), you'll accumulate a few hundred rows per month — easily fits in memory, but the cleanup is good hygiene.

---

## Notes

**`PRIMARY KEY (id, source, event_type)` — three columns, not one.** Stripe event IDs are prefixed (`evt_`), Dropbox Sign uses envelope IDs. They are not guaranteed globally unique across providers, hence `source`. And providers can fire multiple event types per object — Dropbox Sign sends both `signature_request_signed` and `signature_request_all_signed` against the same envelope_id — so `event_type` participates in the PK to keep those independently idempotent.

**Transactions and the claim pattern.** With claim-first (INSERT, then process), wrapping both inside a transaction *is* the right move — a `RAISE EXCEPTION` inside a Postgres function rolls back the claim along with any partial work, so the retry can re-process cleanly. The earlier-style "check, process, insert" pattern famously *cannot* be safely transactional because the check and the insert against the same row in a single transaction don't see each other's pending state. Claim-first sidesteps this entirely.

**Dropbox Sign idempotency mapping.** Use `signature_request_id` as the `id` and the event name (e.g. `signature_request_signed`) as `event_type`. Multiple event types fire for the same envelope across its lifecycle — each is a distinct row in `processed_webhooks` and each gets processed exactly once.

**`payload jsonb` is for the 30-day debug window.** When something looks wrong after the fact ("why did this booking's deposit_payment_intent_id get set?"), the raw event body is in here. After 30 days the cleanup cron deletes it, by which point any provider's retry window has long closed and the data is no longer load-bearing.
