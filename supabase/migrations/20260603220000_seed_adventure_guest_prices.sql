-- =============================================================
-- Placeholder per-guest fees, so the reserve total visibly increments
-- per additional guest (and the card/detail price label shows
-- "$X · $Y / additional guest"). Founders' ("Included") and the World
-- Championship ("—") keep a flat/null guest_price via their priceLabel
-- overrides. Idempotent; guarded to placeholder rows. Removed with the
-- seed: DELETE … WHERE details->>'placeholder'='true'.
-- =============================================================

UPDATE member_adventures a
SET guest_price = v.gp
FROM (VALUES
  ('Argentina Dove · Córdoba',            1500.00),
  ('Sonora Whitetail · Late Season',      2200.00),
  ('Texas Hill Country Quail · January',   750.00)
) AS v(title, gp)
WHERE a.title = v.title
  AND a.details->>'placeholder' = 'true';
