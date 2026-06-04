-- =============================================================
-- Placeholder hero + gallery images for the 5 reference adventures.
--
-- The schema has no image column (per the details-jsonb decision), so
-- images live in details.heroImage (full-screen detail hero + card) +
-- details.gallery (the detail-page gallery). These are Lorem Picsum
-- stock URLs (always-valid, clearly placeholder) so the homepage,
-- /adventures index, and /adventures/[id] detail pages render rich
-- imagery before the client supplies real photos. Plain <img> /
-- background-image, so no next.config image-domain setup is needed.
--
-- Idempotent: `details || '{…}'::jsonb` merges/overwrites the image keys
-- (re-running sets the same values). Guarded to placeholder rows +
-- matched by title. Remove with the seed: DELETE … WHERE details->>'placeholder'='true'.
-- =============================================================

UPDATE member_adventures a
SET details = a.details || v.img::jsonb
FROM (VALUES
  (
    'Argentina Dove · Córdoba',
    '{"heroImage":"https://picsum.photos/seed/argentina-dove/2000/1200","gallery":["https://picsum.photos/seed/cordoba-a/1200/800","https://picsum.photos/seed/cordoba-b/1200/800","https://picsum.photos/seed/cordoba-c/1200/800","https://picsum.photos/seed/cordoba-d/1200/800","https://picsum.photos/seed/cordoba-e/1200/800","https://picsum.photos/seed/cordoba-f/1200/800"]}'
  ),
  (
    'Founders'' Retreat · Pedernales',
    '{"heroImage":"https://picsum.photos/seed/founders-retreat/2000/1200","gallery":["https://picsum.photos/seed/pedernales-a/1200/800","https://picsum.photos/seed/pedernales-b/1200/800","https://picsum.photos/seed/pedernales-c/1200/800","https://picsum.photos/seed/pedernales-d/1200/800","https://picsum.photos/seed/pedernales-e/1200/800","https://picsum.photos/seed/pedernales-f/1200/800"]}'
  ),
  (
    'Texas Hill Country Quail · January',
    '{"heroImage":"https://picsum.photos/seed/texas-quail/2000/1200","gallery":["https://picsum.photos/seed/brady-a/1200/800","https://picsum.photos/seed/brady-b/1200/800","https://picsum.photos/seed/brady-c/1200/800","https://picsum.photos/seed/brady-d/1200/800","https://picsum.photos/seed/brady-e/1200/800","https://picsum.photos/seed/brady-f/1200/800"]}'
  ),
  (
    'Sonora Whitetail · Late Season',
    '{"heroImage":"https://picsum.photos/seed/sonora-whitetail/2000/1200","gallery":["https://picsum.photos/seed/sonora-a/1200/800","https://picsum.photos/seed/sonora-b/1200/800","https://picsum.photos/seed/sonora-c/1200/800","https://picsum.photos/seed/sonora-d/1200/800","https://picsum.photos/seed/sonora-e/1200/800","https://picsum.photos/seed/sonora-f/1200/800"]}'
  ),
  (
    'World Sporting Clays Championship · Spring',
    '{"heroImage":"https://picsum.photos/seed/world-clays/2000/1200","gallery":["https://picsum.photos/seed/clays-a/1200/800","https://picsum.photos/seed/clays-b/1200/800","https://picsum.photos/seed/clays-c/1200/800","https://picsum.photos/seed/clays-d/1200/800","https://picsum.photos/seed/clays-e/1200/800","https://picsum.photos/seed/clays-f/1200/800"]}'
  )
) AS v(title, img)
WHERE a.title = v.title
  AND a.details->>'placeholder' = 'true';
