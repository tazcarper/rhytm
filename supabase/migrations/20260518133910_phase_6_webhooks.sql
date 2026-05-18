-- Phase 6: Webhook Idempotency
--
-- One table: processed_webhooks. Used by every webhook Route Handler
-- (Stripe payment intents, Dropbox Sign envelopes, future providers)
-- to dedupe retries.
--
-- The PK (id, source, event_type) is the idempotency key. The claim-
-- first pattern in the route handler does INSERT … ON CONFLICT DO
-- NOTHING RETURNING; if another instance already claimed the event,
-- the insert returns 0 rows and we exit early. See
-- plan/supabase/phase-6-webhooks.md "Usage Pattern" for the full
-- handler shape including failure handling.

-- ============================================================
-- Extensions
-- ============================================================
-- pg_cron is required for the weekly cleanup job below. On Supabase,
-- pg_cron must be enabled via the dashboard's Database → Extensions
-- page first (free-tier projects may not have it available). If the
-- next statement fails with "extension is not allowed", enable
-- pg_cron in the dashboard and re-run this migration.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- Table
-- ============================================================

CREATE TABLE processed_webhooks (
  id           text        NOT NULL,   -- provider's event ID (Stripe evt_xxx, Dropbox Sign envelope ID, etc.)
  source       text        NOT NULL CHECK (source IN ('stripe', 'dropbox_sign')),
  event_type   text        NOT NULL,   -- provider's event type (e.g. payment_intent.succeeded)
  payload      jsonb       NOT NULL,   -- raw event body, kept for 30-day debugging window
  processed_at timestamptz NOT NULL DEFAULT now(),

  -- A given (provider, object, event-type) tuple is independently idempotent.
  -- Multi-event-per-object providers (Dropbox Sign sends both
  -- signature_request_signed AND signature_request_all_signed against the
  -- same envelope_id) get distinct rows per event type.
  PRIMARY KEY (id, source, event_type)
);

-- RLS enabled with NO policies. Supabase grants anon/authenticated default
-- read/write on every public-schema table, so leaving RLS off would let the
-- anon key list every webhook we've processed. Enabled-with-no-policies
-- denies all access except the service role.
ALTER TABLE processed_webhooks ENABLE ROW LEVEL SECURITY;

-- Cleanup query filters on processed_at.
CREATE INDEX idx_processed_webhooks_cleanup
  ON processed_webhooks (processed_at);

-- ============================================================
-- Weekly cleanup
-- ============================================================
-- Stripe retry window is 72 hours; Dropbox Sign is similar. 30 days
-- gives plenty of margin and keeps the table small.

SELECT cron.schedule(
  'cleanup-processed-webhooks',
  '0 3 * * 0',  -- Sundays 03:00 UTC
  $$
    DELETE FROM processed_webhooks
    WHERE processed_at < now() - interval '30 days';
  $$
);
