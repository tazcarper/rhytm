-- =============================================================
-- Editable Homepage Hero (example feature: editable-homepage-hero)
--
-- Moves the umbrella homepage hero (the big banner at app/page.tsx)
-- out of hardcoded JSX and into one admin-editable DB row, so staff
-- can change the eyebrow, headline, lead paragraph, the two call-to-
-- action buttons, and a background image without a code change or
-- deploy. Same "Config in DB" reasoning as the per-property taglines
-- added in App 3.9 (see properties.tagline).
--
-- SINGLETON. There is exactly one umbrella homepage, so this is a
-- one-row table pinned to id = 1 by a CHECK constraint. Readers use
-- `.eq("id", 1).maybeSingle()`; there is never more than one row.
--
-- RLS: public reads (the hero is shown to anonymous visitors); only
-- admin / super_admin write (site-wide marketing content, not a
-- per-property manager concern — mirrors `properties: admin write`).
-- No cross-table references in any policy -> no policy-cycle risk.
-- =============================================================

CREATE TABLE homepage_hero (
  -- Singleton pin: the table holds exactly one row.
  id                   smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  eyebrow              text,        -- small label above the title (e.g. "Est. 2026")
  title                text        NOT NULL,
  lead                 text,        -- supporting paragraph under the title

  -- Optional background image. A plain URL (no upload pipeline) keeps
  -- this testable on a local stack with no Vercel Blob token. Null =>
  -- the renderer keeps the existing gradient background.
  image_url            text,

  -- Primary call-to-action button (label + destination).
  primary_cta_label    text,
  primary_cta_href     text,

  -- Secondary call-to-action button (label + destination).
  secondary_cta_label  text,
  secondary_cta_href   text,

  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE homepage_hero IS
  'Singleton (id = 1): the admin-editable hero banner on the umbrella '
  'home page. Edited from /admin/homepage; rendered by app/page.tsx.';

CREATE TRIGGER homepage_hero_updated_at
  BEFORE UPDATE ON homepage_hero
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- RLS on immediately so the table is never reachable without a policy.
ALTER TABLE homepage_hero ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) may read the hero.
CREATE POLICY "homepage_hero: public read"
  ON homepage_hero FOR SELECT
  USING (true);

-- Only admin / super_admin may create or edit it. auth.jwt() is wrapped
-- in (SELECT …) so it evaluates once per query (InitPlan), per the
-- project RLS rules.
CREATE POLICY "homepage_hero: admin write"
  ON homepage_hero FOR ALL
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
  );

-- Seed the single row with the copy that previously lived hardcoded in
-- app/page.tsx, so the homepage looks identical the moment this ships.
INSERT INTO homepage_hero (
  id, eyebrow, title, lead,
  primary_cta_label, primary_cta_href,
  secondary_cta_label, secondary_cta_href
) VALUES (
  1,
  'Est. 2026',
  'Your day in the Texas Hill Country starts here.',
  'Sporting clays, private instruction, and unforgettable gatherings across three storied properties — reserved online in minutes.',
  'Plan your visit', '/book',
  'Members'' Entrance', '/login'
);
