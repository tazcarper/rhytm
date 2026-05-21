-- =============================================================
-- Placeholder seed: time_slots + instructors
--
-- BLOCKING ON Q2 (operating hours + instructor headcount per property).
-- Until then we seed each property with the same nominal hours so the
-- App 2 funnel renders end-to-end:
--   - time_slots: 09:00, 11:00, 13:00, 15:00 — every day of week
--   - instructors: 2–3 placeholder names per property
-- All instructor `name` values start with "PLACEHOLDER " so they're
-- sweepable when Q2 lands. time_slots have no description column —
-- a Q2-driven migration will TRUNCATE and reseed.
-- =============================================================

-- ---- time_slots ----
INSERT INTO time_slots (property_id, day_of_week, slot_start, is_active)
SELECT p.id, dow.day_of_week, t.slot_start, true
FROM properties p
CROSS JOIN generate_series(0, 6) AS dow(day_of_week)
CROSS JOIN (VALUES
  (time '09:00'),
  (time '11:00'),
  (time '13:00'),
  (time '15:00')
) AS t(slot_start)
ON CONFLICT (property_id, day_of_week, slot_start) DO NOTHING;

-- ---- instructors ----
INSERT INTO instructors (property_id, name, bio, display_order, is_active)
SELECT p.id, v.name, v.bio, v.display_order, true
FROM properties p
JOIN (VALUES
  ('horseshoe-bay', 'PLACEHOLDER Sam Whitley',   'PLACEHOLDER — wing-shooting instructor',     1),
  ('horseshoe-bay', 'PLACEHOLDER Quinn Rivers',  'PLACEHOLDER — sporting clays instructor',    2),
  ('horseshoe-bay', 'PLACEHOLDER Ash Carter',    'PLACEHOLDER — pistol bay instructor',        3),

  ('hog-heaven',    'PLACEHOLDER Drew Lambert',  'PLACEHOLDER — wing-shooting instructor',     1),
  ('hog-heaven',    'PLACEHOLDER Marlowe Penn',  'PLACEHOLDER — sporting clays instructor',    2),

  ('packsaddle',    'PLACEHOLDER Jordan Vance',  'PLACEHOLDER — precision-rifle instructor',   1),
  ('packsaddle',    'PLACEHOLDER Ellis Marsh',   'PLACEHOLDER — long-range instructor',        2)
) AS v(slug, name, bio, display_order)
  ON p.slug = v.slug;
