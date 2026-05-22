-- =============================================================
-- Adds three admin-editable columns to `properties` for the App 3.9
-- Property Settings surface:
--
-- - tagline       — short editorial copy shown on the umbrella home
--                   page (one sentence per property). Pre-3.9 these
--                   strings lived as TS constants in app/page.tsx;
--                   moving them to the DB lets staff edit without a
--                   deploy. See CLAUDE.md "Config in DB" rule.
-- - support_email — public contact email for this property. Nullable;
--                   no consumer wired yet (lands in a later phase).
-- - support_phone — public contact phone for this property. Nullable;
--                   same deal.
--
-- All three are nullable text — empty values are valid (renderer
-- treats null/empty as "not set" and renders nothing).
-- =============================================================

ALTER TABLE properties
  ADD COLUMN tagline       text,
  ADD COLUMN support_email text,
  ADD COLUMN support_phone text;

COMMENT ON COLUMN properties.tagline IS
  'Short editorial tagline shown on the umbrella home page. Admin-editable from /admin/properties.';
COMMENT ON COLUMN properties.support_email IS
  'Public-facing support email for this property. Admin-editable.';
COMMENT ON COLUMN properties.support_phone IS
  'Public-facing support phone for this property. Admin-editable.';

-- Seed the existing taglines lifted from app/page.tsx PROPERTY_COPY.
-- New properties added later start with NULL tagline until staff fills
-- one in via the admin surface.
UPDATE properties SET tagline = 'A members-only sporting club on the lake — clays, helice, instruction, and the quiet kind of hospitality.'
  WHERE slug = 'horseshoe-bay';
UPDATE properties SET tagline = 'Wing-shooting and wedding weekends on six hundred acres, paired with Camp Lucy when the occasion asks for it.'
  WHERE slug = 'hog-heaven';
UPDATE properties SET tagline = 'Precision rifle, suppressed and unhurried — coaching for marksmen who want range time without a crowd.'
  WHERE slug = 'packsaddle';
