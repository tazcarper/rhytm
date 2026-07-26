-- property_page_content
--
-- Admin-editable static copy for the new property marketing pages
-- (membership, education, private-events) built in
-- app/(public)/horseshoe-bay/*. One row per (property, page, section) —
-- keyed by known section names, not a generic page-builder, matching the
-- "structured content row per known page section" pattern already used
-- by homepage_hero (a config-in-DB singleton the admin edits at
-- /admin/homepage). Deliberately does NOT cover the 'home' page: the
-- homepage's hero-equivalent content already has its own dedicated
-- system (homepage_hero) — adding a second, overlapping mechanism for
-- the same surface would confuse which one is authoritative.
--
-- Unlike promotions, this is always-live site content (no draft/publish
-- gating) — a page falls back to its own hardcoded copy if no row
-- exists yet, so nothing breaks before an admin has ever touched a
-- given section.
--
-- v1 ships exactly one section_key ('intro') per page — the asymmetric
-- intro block every one of these three pages has (eyebrow copy stays
-- hardcoded per-page; heading/body/CTA/image are what's actually worth
-- editing). Adding more sections later is a data change, not a schema
-- change (section_key is a plain text column, not an enum).

CREATE TABLE property_page_content (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  uuid NOT NULL REFERENCES properties(id),

  page_key     text NOT NULL CHECK (page_key IN ('membership', 'education', 'private_events')),
  section_key  text NOT NULL,

  heading    text,
  body       text,
  image_url  text,
  cta_label  text,
  cta_href   text,

  sort_order  integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (property_id, page_key, section_key)
);

CREATE TRIGGER property_page_content_updated_at
  BEFORE UPDATE ON property_page_content
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE property_page_content ENABLE ROW LEVEL SECURITY;

-- Always-live content — no status/window gating, unlike promotions.
CREATE POLICY "property_page_content: public read"
  ON property_page_content FOR SELECT
  USING (true);

CREATE POLICY "property_page_content: admin all"
  ON property_page_content FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "property_page_content: property_manager write own"
  ON property_page_content FOR ALL
  USING ((SELECT auth_role()) = 'property_manager' AND property_id = (SELECT auth_property_id()))
  WITH CHECK ((SELECT auth_role()) = 'property_manager' AND property_id = (SELECT auth_property_id()));
