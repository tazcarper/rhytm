-- Generalize property_page_content beyond each page's single 'intro' block.
--
-- v1 only covered the asymmetric intro section of membership/education/
-- private_events. The client has since asked for admin-dashboard editing
-- across every one of the 9 new Horseshoe Bay pages, which surfaces two gaps
-- this migration closes:
--
--   1. page_key was missing 'home', 'events', 'adventures' — the three pages
--      that had zero admin-editable coverage (home has its own homepage_hero
--      system for the OLD `/` homepage, but the NEW property homepage at
--      `/horseshoe-bay` is a different surface with no overlap).
--
--   2. Most of the remaining hardcoded content isn't a single heading/body/
--      cta/image block — it's a repeating list of cards (benefit tiles,
--      amenity tiles, occasion cards, program cards, onboarding steps,
--      gallery images, pricing figures). `items` is a loosely-typed jsonb
--      array for exactly this shape. Each element is an object drawn from a
--      common, optional field set — {title, body, imageUrl, bullets,
--      linkLabel, linkHref} — and a given section only ever populates the
--      subset it needs. Validated at the Zod boundary in
--      src/services/admin/property-page-content.ts, not in SQL.
--
-- A section row is still either single-block (heading/body/image/cta) OR
-- items-based (items array) — never both — decided by the admin UI's
-- per-section config (src/constants/admin/property-page-sections.ts), not
-- enforced here.

ALTER TABLE property_page_content
  DROP CONSTRAINT property_page_content_page_key_check;

ALTER TABLE property_page_content
  ADD CONSTRAINT property_page_content_page_key_check
  CHECK (page_key IN ('home', 'membership', 'education', 'private_events', 'events', 'adventures'));

ALTER TABLE property_page_content
  ADD COLUMN items jsonb;
