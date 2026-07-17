-- =============================================================
-- Promotions (feature: reusable sales / seasonal events)
--
-- A marketing content type staff compose once, schedule, place on one
-- or more public pages, publish, then ARCHIVE and re-run later. This is
-- the "reuse" capability the headless-CMS evaluation recommended we
-- build inside our own admin rather than adopt a CMS for
-- (docs/headless-cms-evaluation.md).
--
-- Same "Config in DB" reasoning as homepage_hero and property taglines:
-- editable content lives in a DB row an admin edits at /admin/promotions,
-- not in hardcoded JSX behind a deploy.
--
-- RLS: public reads only PUBLISHED promos inside their live window; only
-- admin / super_admin write (site-wide marketing, mirrors homepage_hero —
-- not a per-property-manager concern). No cross-table subquery in any
-- policy -> no policy-cycle risk (the property scope is resolved by an
-- embedded select + app-side filter, not an RLS join).
-- =============================================================

CREATE TABLE promotions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  title         text        NOT NULL,          -- internal name + public heading
  eyebrow       text,                          -- small label above the title
  body          text,                          -- Markdown, rendered by MarkdownProse
  image_url     text,                          -- optional; reuses the homepage-images bucket

  cta_label     text,                          -- optional button label
  cta_href      text,                          -- optional button destination (path or URL)

  -- Which public surfaces this promo appears on. A promo can appear on
  -- several at once. Constrained to the known slots so a typo can't
  -- silently hide a promo everywhere.
  placements    text[]      NOT NULL DEFAULT '{}'
                CHECK (placements <@ ARRAY['homepage_band','property_page','adventures_page']::text[]),

  -- Lifecycle. 'archived' keeps the content for a later re-run — the
  -- reuse mechanism (no delete needed to take a promo down).
  status        text        NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','published','archived')),

  -- Live window. NULL on either side = open-ended in that direction.
  starts_at     timestamptz,
  ends_at       timestamptz,

  -- Tie-break ordering when several promos are active in one placement.
  sort_order    integer     NOT NULL DEFAULT 0,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT promotions_window_valid
    CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);

COMMENT ON TABLE promotions IS
  'Admin-editable marketing promotions (seasonal/sales events). Edited from '
  '/admin/promotions; rendered on public pages named in `placements`. '
  'Empty promotion_properties => shown for all clubs; rows => only those clubs.';

CREATE INDEX promotions_status_idx ON promotions (status);

CREATE TRIGGER promotions_updated_at
  BEFORE UPDATE ON promotions
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Property targeting (multi-club). NO rows for a promo => it applies to
-- ALL clubs; one or more rows => only those clubs. Kept as a join table
-- (not a nullable FK) so any subset of clubs can be targeted.
CREATE TABLE promotion_properties (
  promotion_id  uuid NOT NULL REFERENCES promotions(id)  ON DELETE CASCADE,
  property_id   uuid NOT NULL REFERENCES properties(id)  ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, property_id)
);

COMMENT ON TABLE promotion_properties IS
  'Which clubs a promotion targets. No rows for a promotion = all clubs.';

CREATE INDEX promotion_properties_property_idx
  ON promotion_properties (property_id);

-- ---- RLS -----------------------------------------------------------------

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_properties ENABLE ROW LEVEL SECURITY;

-- Public: only published promos inside their live window. A NULL bound is
-- open-ended. now() is stable within a statement.
CREATE POLICY "promotions: public read active"
  ON promotions FOR SELECT
  USING (
    status = 'published'
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at   IS NULL OR ends_at   >= now())
  );

-- Admin / super_admin: full read + write (drafts, archived, everything).
-- auth.jwt() wrapped in (SELECT …) so it's evaluated once per query
-- (InitPlan), per the project RLS rules.
CREATE POLICY "promotions: admin all"
  ON promotions FOR ALL
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin','admin')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin','admin')
  );

-- The join table carries no sensitive data (id pairs). Public read lets the
-- public promo query resolve targeting via an embedded select; admins manage
-- rows. Both policies are simple and reference no other table.
CREATE POLICY "promotion_properties: public read"
  ON promotion_properties FOR SELECT
  USING (true);

CREATE POLICY "promotion_properties: admin all"
  ON promotion_properties FOR ALL
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin','admin')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin','admin')
  );
