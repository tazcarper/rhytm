-- Newsletter signups
--
-- Backs the (previously non-functional) "Subscribe" form in PropertyFooter,
-- shown on every page of all three properties. One row per (property, email)
-- signup — the same person can subscribe at more than one club, but signing
-- up twice for the same club is a no-op (see the public insert path, which
-- upserts with ON CONFLICT DO NOTHING).
--
-- RLS follows the inquiries precedent exactly: public INSERT-only via the
-- form's Server Action, no public SELECT (an email address is PII a
-- stranger shouldn't be able to enumerate), staff read via is_admin() /
-- property_manager scoping.

-- ============================================================
-- Step 1 — newsletter_signups
-- ============================================================

CREATE TABLE newsletter_signups (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  uuid NOT NULL REFERENCES properties(id),
  email        text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (property_id, email)
);

CREATE INDEX idx_newsletter_signups_property ON newsletter_signups (property_id, created_at DESC);

-- ============================================================
-- Step 2 — RLS
-- ============================================================

ALTER TABLE newsletter_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "newsletter_signups: public insert"
  ON newsletter_signups FOR INSERT
  WITH CHECK (true);

CREATE POLICY "newsletter_signups: admin all"
  ON newsletter_signups FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "newsletter_signups: property_manager read own"
  ON newsletter_signups FOR SELECT
  USING ((SELECT auth_role()) = 'property_manager' AND property_id = (SELECT auth_property_id()));
