-- =============================================================
-- Seed discipline card photos for the booking funnel
-- (feature: booking "Choose Your Discipline" redesign;
--  follows 20260618140000_service_image.sql which added services.image_url)
-- =============================================================
-- The placeholder services seeded in 20260520120000 have NULL image_url, so the
-- redesigned discipline cards render the branded monogram placeholder. This
-- seeds on-brand, free-licence (Unsplash) heritage photography, self-hosted
-- under public/images/disciplines so the funnel renders real imagery out of the box:
--
--   Sporting Clays — a shooter tracking a clay over an open field
--   Wing Shooting  — a pointer working a field in a hunting collar
--   Game Hunt      — a red deer stag glimpsed through woodland
--
-- Stored as a site-relative path; AdventureImage renders non-whitelisted /
-- relative srcs via a plain <img>, so no next/image remotePattern is needed.
--
-- IDEMPOTENT + NON-DESTRUCTIVE: each update is guarded by `image_url is null`,
-- so it only fills empty cards and never overwrites a photo an admin uploaded
-- through /admin. Matched by service name, so it covers every property that
-- offers the discipline.

update services set image_url = '/images/disciplines/sporting-clays.jpg'
  where name = 'Sporting Clays' and image_url is null;

update services set image_url = '/images/disciplines/wing-shooting.jpg'
  where name = 'Wing Shooting' and image_url is null;

update services set image_url = '/images/disciplines/game-hunt.jpg'
  where name = 'Game Hunt' and image_url is null;
