# Phase 6 — Webhook Idempotency

## Prerequisites

- Phase 1 complete
- No other application tables required

## What This Phase Builds

`processed_webhooks`

One table. Deploy it before any Inngest webhook handler is written.

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
  id           text        NOT NULL,   -- provider's event ID (e.g. Stripe evt_xxx, DocuSign envelope ID)
  source       text        NOT NULL CHECK (source IN ('stripe', 'dropbox_sign')),
  processed_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (id, source)
);

-- No RLS: this table is only ever accessed by the service role in Route Handlers
-- Enabling RLS with no policies would block all access — leave it disabled intentionally

CREATE INDEX idx_processed_webhooks_cleanup
  ON processed_webhooks (processed_at);
```

RLS is intentionally not enabled on this table. It is accessed exclusively by server-side Route Handlers using the service role client. No user — authenticated or anonymous — ever reads or writes this table directly.

---

## Usage Pattern

Every webhook Route Handler follows this exact sequence. Do not vary the order.

```typescript
// app/api/webhooks/stripe/route.ts
import { createClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  const supabase = createClient()  // service role client

  // 1. Verify the webhook signature (Stripe, Dropbox Sign both provide this)
  const event = await verifyStripeWebhook(request)
  if (!event) return new Response('Invalid signature', { status: 400 })

  // 2. Check idempotency — has this event already been processed?
  const { data: existing } = await supabase
    .from('processed_webhooks')
    .select('id')
    .eq('id', event.id)
    .eq('source', 'stripe')
    .single()

  if (existing) {
    // Already processed — acknowledge and exit
    return new Response('Already processed', { status: 200 })
  }

  // 3. Process the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handleDepositPaid(event.data.object, supabase)
      break
    // ...
  }

  // 4. Record the event as processed AFTER successful handling
  await supabase
    .from('processed_webhooks')
    .insert({ id: event.id, source: 'stripe' })

  return new Response('OK', { status: 200 })
}
```

**Important:** Step 4 (recording the event) happens after step 3 (processing). If step 3 fails and throws, the event is not recorded — the retry will re-attempt processing. If step 3 succeeds and step 4 fails (rare), the next retry will re-process. Design handlers to be idempotent for this edge case (e.g., use `upsert` when updating `bookings.deposit_payment_intent_id`).

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

**`PRIMARY KEY (id, source)` — not just `id`.** Stripe event IDs are prefixed (`evt_`), Dropbox Sign uses envelope IDs. They are not guaranteed globally unique across providers. The composite PK ensures a Stripe event and a Dropbox Sign event with the same ID (unlikely but possible) don't collide.

**Do not use a transaction for the idempotency check + processing.** If you wrap the check and the processing in a single transaction, the `processed_webhooks` INSERT is only visible to other transactions after the outer transaction commits. Two concurrent retries of the same event can both pass the check before either commits the Insert. The current pattern (check, process, insert as three separate operations) is correct because Inngest provides its own retry management — the window for a true concurrent retry is narrow and the downstream operations are themselves idempotent (Stripe prevents double charges, Supabase upserts prevent duplicate rows).

**Dropbox Sign envelope ID as the idempotency key.** Dropbox Sign webhooks carry the `signature_request_id` as the event identifier. Use this as the `id` field with `source = 'dropbox_sign'`. Multiple event types can fire for the same envelope (e.g., `signature_request_signed` and `signature_request_all_signed`). These are different events and should be tracked with a composite key if needed — consider storing `event_type` as an additional column if multiple event types per source require independent idempotency tracking.
