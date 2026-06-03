-- App 9 W3 — Pre-event reminder cadence.
--
-- Two changes:
--   1. Property-level content fields the reminder emails render (directions,
--      parking, who-to-ask-for on arrival). These are static per property,
--      so they live on `properties` and are admin-editable on the property
--      settings page — NOT per-bid.
--   2. A singleton `reminder_settings` row holding the cadence offsets and
--      flags. Config-in-DB (per project convention): the client's eventual
--      Q15 answer edits these values, not code — no redeploy to retune the
--      T-14 / T-3 / T-1 / T+1 schedule.
--
-- The cadence engine (lib/inngest/functions/send-pre-event-cadence.ts) reads
-- both via the service-role client (bypasses RLS), so the policies below
-- exist only for the admin UI.

-- ============================================================
-- properties — reminder content fields
-- ============================================================

ALTER TABLE properties
  ADD COLUMN directions      text,
  ADD COLUMN parking         text,
  ADD COLUMN arrival_contact text;

COMMENT ON COLUMN properties.directions IS
  'Guest-facing directions to the property; rendered in the early pre-event email. Null omits the section.';
COMMENT ON COLUMN properties.parking IS
  'Guest-facing parking instructions; rendered in the mid pre-event email. Null omits the section.';
COMMENT ON COLUMN properties.arrival_contact IS
  'Who the guest should ask for on arrival; rendered in the final pre-event email. Null omits the line.';

-- ============================================================
-- reminder_settings — singleton cadence config
-- ============================================================

CREATE TABLE reminder_settings (
  -- Singleton: exactly one row. The id=1 CHECK + PK make a second insert
  -- impossible; the engine reads `... limit 1`.
  id                     integer     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- Master switch — flip false to stop scheduling any pre-event cadence.
  enabled                boolean     NOT NULL DEFAULT true,
  -- Days BEFORE the event each pre-event touch fires. A booking confirmed
  -- inside one of these windows collapses the already-passed touches into a
  -- single consolidated "everything for your visit" email (see the engine).
  early_offset_days      integer     NOT NULL DEFAULT 14 CHECK (early_offset_days > 0),
  mid_offset_days        integer     NOT NULL DEFAULT 3  CHECK (mid_offset_days  > 0),
  final_offset_days      integer     NOT NULL DEFAULT 1  CHECK (final_offset_days > 0),
  -- Days AFTER the event the follow-up fires.
  followup_offset_days   integer     NOT NULL DEFAULT 1  CHECK (followup_offset_days > 0),
  -- Soft membership CTA in the post-event follow-up (public guests). Off
  -- until Q15b is confirmed.
  membership_cta_enabled boolean     NOT NULL DEFAULT false,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

INSERT INTO reminder_settings (id) VALUES (1);

CREATE TRIGGER reminder_settings_updated_at
  BEFORE UPDATE ON reminder_settings
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE reminder_settings ENABLE ROW LEVEL SECURITY;

-- Admin-only manage (read + write). Mirrors the properties admin-write
-- policy. References only auth.jwt() — no cross-table subquery, no policy
-- cycle. The cadence engine uses the service-role client and bypasses this.
CREATE POLICY "reminder_settings: admin manage"
  ON reminder_settings FOR ALL
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'))
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));
