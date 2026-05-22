-- =============================================================
-- dev_email_outbox  —  DEV-ONLY SHIM.  DROP THIS TABLE BEFORE LAUNCH.
--
-- App 2 sub-phase 2.9 — Confirmation Email Shim.
--
-- App 2 needs a confirmation email to fire after a public booking is
-- created (so the guest can find their bid URL again). The real Resend
-- transport doesn't land until App 8. Rather than wait, we wire the
-- trigger point + payload shape now and "send" by writing the rendered
-- email to this table. App 8 swaps the transport — the call site at
-- src/services/notifications/send-email.ts stays put.
--
-- Visual review happens at /dev/emails (also dev-only): lists recent
-- rows and renders body_html in an iframe.
--
-- Drop-pre-launch checklist:
--   - this table
--   - the LoggingEmailService implementation
--   - the /dev/emails route
--   - this migration file (the rest of /dev gets the same treatment)
--
-- Security model: RLS enabled with NO policies. Mirrors the
-- processed_webhooks pattern (see 20260518133910_phase_6_webhooks.sql).
-- Supabase grants the anon/authenticated roles default read+write on
-- every public-schema table — leaving RLS off would let the anon key
-- list every "sent" email payload (guest names, emails, bid URLs,
-- access codes). Enabled-with-no-policies denies all access except the
-- service role. The LoggingEmailService writes via service-role; the
-- /dev/emails page reads via service-role behind the DEV_DASHBOARD_PASSWORD
-- cookie gate.
-- =============================================================

CREATE TABLE dev_email_outbox (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- A short identifier of where the send originated. 'public_booking' is the
  -- only producer today; App 8 adds more (member RSVP, partner invite, etc.).
  source        text        NOT NULL,
  -- Logical template name — matches the React component file under
  -- src/components/email/templates/ (e.g. 'guest_booking_confirmation').
  template_name text        NOT NULL,
  to_email      text        NOT NULL,
  from_email    text        NOT NULL,
  subject       text        NOT NULL,
  body_html     text        NOT NULL,   -- rendered via renderToStaticMarkup
  body_text     text,                   -- plaintext alt; nullable until App 8 cares
  -- Raw props passed into the template. Kept so debugging a render bug
  -- doesn't require re-walking the funnel.
  payload       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE dev_email_outbox IS
  'Dev-only shim for App 2.9 confirmation emails. Drop before launch — replaced by real Resend transport in App 8.';

ALTER TABLE dev_email_outbox ENABLE ROW LEVEL SECURITY;

-- /dev/emails lists "most recent first". Index supports that scan path.
CREATE INDEX idx_dev_email_outbox_created_at
  ON dev_email_outbox (created_at DESC);
