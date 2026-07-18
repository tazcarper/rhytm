-- Club Life is the ninth+one property page: a hero, an upcoming-events
-- strip (reads the real events table, no override needed), a "Join the
-- Members' Group" CTA band, and an Instagram section (handle/follow link
-- plus up to 5 photos). Widens page_key to admit it, same pattern as the
-- 20260719120000 migration that added home/events/adventures.

ALTER TABLE property_page_content
  DROP CONSTRAINT property_page_content_page_key_check;

ALTER TABLE property_page_content
  ADD CONSTRAINT property_page_content_page_key_check
  CHECK (page_key IN (
    'home', 'membership', 'education', 'private_events', 'events',
    'adventures', 'club_life', 'basics', 'layout'
  ));
