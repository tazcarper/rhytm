-- =============================================================
-- Placeholder seed: services + add_ons + service_add_ons
--
-- BLOCKING ON Q4 (full discipline + add-on catalog per property).
-- HSB has a partially-known catalog from existing materials; Hog
-- Heaven and Packsaddle are pure placeholders so the App 2 public
-- booking funnel can be exercised end-to-end before Q4 lands.
--
-- Every row's description starts with "PLACEHOLDER —" so an admin
-- sweep can find and replace them in one migration when the real
-- catalog arrives. Delete this file or its rows then.
--
-- Trigger check_service_add_on_property enforces that joined
-- service+add_on share a property_id — the joins below honor that.
-- =============================================================

-- ---- services ----
INSERT INTO services (property_id, name, description, display_order, is_active)
SELECT p.id, v.name, v.description, v.display_order, true
FROM properties p
JOIN (VALUES
  ('horseshoe-bay', 'Sporting Clays',     'PLACEHOLDER — traditional sporting clays course',        1),
  ('horseshoe-bay', 'Helice',             'PLACEHOLDER — European-style helice',                    2),
  ('horseshoe-bay', 'Wobble Deck',        'PLACEHOLDER — wobble-deck trap layout',                  3),
  ('horseshoe-bay', 'Pistol Bays',        'PLACEHOLDER — supervised pistol bays',                   4),

  ('hog-heaven',    'Wing Shooting',      'PLACEHOLDER — guided wing shooting',                     1),
  ('hog-heaven',    'Sporting Clays',     'PLACEHOLDER — sporting clays course',                    2),
  ('hog-heaven',    'Game Hunt',          'PLACEHOLDER — half-day game hunt',                       3),

  ('packsaddle',    'Precision Rifle',    'PLACEHOLDER — precision rifle range',                    1),
  ('packsaddle',    'Long Range',         'PLACEHOLDER — long-range shooting',                      2),
  ('packsaddle',    'Suppressor Demo',    'PLACEHOLDER — suppressor demo session',                  3)
) AS v(slug, name, description, display_order)
  ON p.slug = v.slug;

-- ---- add_ons ----
INSERT INTO add_ons (property_id, name, description, price, display_order, is_active)
SELECT p.id, v.name, v.description, v.price, v.display_order, true
FROM properties p
JOIN (VALUES
  ('horseshoe-bay', 'Ammunition Pack',    'PLACEHOLDER — one box of shells',                         75.00, 1),
  ('horseshoe-bay', 'Drink Cart',         'PLACEHOLDER — beverages on the course',                   50.00, 2),
  ('horseshoe-bay', 'Instructor Upgrade', 'PLACEHOLDER — dedicated instructor for the session',     100.00, 3),

  ('hog-heaven',    'Ammunition Pack',    'PLACEHOLDER — shells included',                           90.00, 1),
  ('hog-heaven',    'Drink Cart',         'PLACEHOLDER — beverages on the property',                 50.00, 2),

  ('packsaddle',    'Target Package',     'PLACEHOLDER — premium target pack',                       40.00, 1),
  ('packsaddle',    'Range Fee',          'PLACEHOLDER — additional bench time',                     25.00, 2)
) AS v(slug, name, description, price, display_order)
  ON p.slug = v.slug;

-- ---- service_add_ons ----
-- Every placeholder add-on is available for every placeholder service in the
-- same property. The check_service_add_on_property trigger enforces matching
-- property_id; the join below honors that. ON CONFLICT is belt-and-braces if
-- this migration is ever re-run after partial application.
INSERT INTO service_add_ons (service_id, add_on_id)
SELECT s.id, a.id
FROM services s
JOIN add_ons a ON a.property_id = s.property_id
WHERE s.description LIKE 'PLACEHOLDER%'
  AND a.description LIKE 'PLACEHOLDER%'
ON CONFLICT (service_id, add_on_id) DO NOTHING;
