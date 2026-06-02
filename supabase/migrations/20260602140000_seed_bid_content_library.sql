-- =============================================================
-- Placeholder seed: bid content library (FAQ + gear templates + scopes)
--
-- Realistic starter content so a brand-new bid auto-fills sensible FAQ and
-- gear. Answers/items are short on purpose — admins trim, not rewrite.
--
-- Scopes are keyed to the REAL placeholder catalog from
-- 20260520120000_seed_placeholder_services_addons.sql (NOT the names the
-- bid-content-library plan assumed, which never existed in the DB):
--   horseshoe-bay : Sporting Clays, Helice, Wobble Deck, Pistol Bays
--   hog-heaven    : Wing Shooting, Sporting Clays, Game Hunt
--   packsaddle    : Precision Rifle, Long Range, Suppressor Demo
-- "Sporting Clays" exists at two clubs (two service rows); the service-scope
-- inserts below tag every matching row by name, as intended.
--
-- dedupe_key is shared across scopes so a more specific scope overrides a
-- general one sharing the key (see `cancellation` and `eye-ear`).
--
-- Synthetic UUIDs (f… for FAQ, 9… for gear) let the scope inserts reference
-- each template without RETURNING plumbing. Properties resolve by slug,
-- services by name — so if the placeholder catalog was changed, missing names
-- simply yield fewer service scopes. The trailing catch-all DELETE removes any
-- template that ended up with zero scopes (would never appear on a bid).
-- Delete this file's rows when the real catalog + copy arrive.
-- =============================================================

-- ============================================================
-- FAQ templates
-- ============================================================

INSERT INTO bid_faq_templates (id, question, answer, dedupe_key, display_order) VALUES
  -- Global (ride along on every bid)
  ('f0000000-0000-0000-0000-000000000001', 'What''s your cancellation policy?', 'Full refund up to 7 days out; 50% within 7 days; no refund inside 24 hours.', 'cancellation', 1),
  ('f0000000-0000-0000-0000-000000000002', 'Do I need an ID?', 'Yes — a valid government photo ID for every shooter, every visit.', 'id-required', 2),
  ('f0000000-0000-0000-0000-000000000003', 'Do I need experience?', 'None at all. Every session starts with a safety brief and our instructors meet you at your level.', 'experience', 3),
  ('f0000000-0000-0000-0000-000000000004', 'Can minors shoot?', 'Yes, with a parent or guardian present and a signed waiver. Minimum age varies by discipline — ask if unsure.', 'minors', 4),
  ('f0000000-0000-0000-0000-000000000005', 'Is there a waiver?', 'Yes. Every participant signs a liability waiver on arrival; we''ll text you a link to complete it ahead of time.', 'waiver', 5),
  ('f0000000-0000-0000-0000-000000000006', 'When should I arrive?', '15 minutes early so we can check you in, fit gear, and run the safety brief without cutting into range time.', 'arrival', 6),
  ('f0000000-0000-0000-0000-000000000007', 'How does payment work?', 'Your deposit is taken when you sign this bid; the balance is due on the day.', 'payment', 7),

  -- Per-property
  ('f0000000-0000-0000-0000-000000000008', 'Where exactly are you?', 'In the Texas Hill Country near Horseshoe Bay; detailed driving directions and a gate code are texted the day before.', 'directions', 20),
  ('f0000000-0000-0000-0000-000000000009', 'How do we get around the course?', 'Each squad gets a golf cart; the sporting clays course is cart-path connected across all stations.', 'course-transport', 21),
  ('f0000000-0000-0000-0000-00000000000a', 'Is there food and a place to relax?', 'Yes — the lodge has restrooms, AC, and a porch; catering can be arranged for groups.', 'lodge', 22),
  ('f0000000-0000-0000-0000-00000000000b', 'Are dogs involved?', 'On wing shooting outings our trained pointing dogs work the field with you; you''re welcome to bring your own steady gun dog.', 'dogs', 23),
  ('f0000000-0000-0000-0000-00000000000c', 'What''s your cancellation policy?', 'The rifle range is reserved one group at a time, so we require 48-hour notice for any refund.', 'cancellation', 1),
  ('f0000000-0000-0000-0000-00000000000d', 'How far out can we shoot?', 'Steel and paper from 100 yards out past 1,000, with known-distance positions for working up a ballistic solution.', 'distances', 24),
  ('f0000000-0000-0000-0000-00000000000e', 'What makes precision here challenging?', 'Open high-desert positions with real wind and mirage — exactly what makes the long shots rewarding. Spotting scopes provided.', 'altitude-wind', 25),

  -- Per-booking-type
  ('f0000000-0000-0000-0000-00000000000f', 'How is a private lesson run?', 'One instructor, one or two shooters, paced entirely to you, with on-the-spot coaching and drills you can take home.', 'lesson-format', 30),
  ('f0000000-0000-0000-0000-000000000010', 'Can you feed our group?', 'Yes — BBQ or boxed lunches for parties of 6+; tell us headcount and any dietary needs when you confirm.', 'catering', 31),
  ('f0000000-0000-0000-0000-000000000011', 'How do large groups work?', 'We split you into squads with a dedicated instructor each, rotate stations, and can run a friendly scored competition with prizes.', 'group-format', 32),
  ('f0000000-0000-0000-0000-000000000012', 'Is a visit instructed or on my own?', 'A Plan-a-Visit is range time at your own pace; add an instructor anytime if you''d like coaching.', 'self-guided', 33),

  -- Per-discipline (service)
  ('f0000000-0000-0000-0000-000000000013', 'Is ammunition included?', 'Two boxes of 12ga target loads per shooter are included; more is available at the pro shop.', 'ammo', 40),
  ('f0000000-0000-0000-0000-000000000014', 'Is ammunition included?', 'Field loads appropriate to the birds are included; let us know if you prefer a specific shot size.', 'ammo', 40),
  ('f0000000-0000-0000-0000-000000000015', 'Is ammunition included?', 'Match-grade .308 / 6.5 Creedmoor is provided. Bringing your own load? Clear it with us first for safety and barrel care.', 'ammo', 40),
  ('f0000000-0000-0000-0000-000000000016', 'What''s the course like?', '12–15 stations of varied presentations — crossers, teal, rabbits — walked as a squad over roughly 90 minutes.', 'course-format', 41),
  ('f0000000-0000-0000-0000-000000000017', 'What gauges can I shoot?', '12 and 20ga rentals are on hand; sub-gauge (28/.410) by request for the experienced crowd.', 'gauge-options', 42),
  ('f0000000-0000-0000-0000-000000000018', 'What birds are we hunting?', 'Released quail and chukar over pointing dogs; seasonal pheasant on request. A Texas hunting license is required and can be bought online.', 'birds', 43),
  ('f0000000-0000-0000-0000-000000000019', 'What does a game hunt involve?', 'A guided half-day in the field with dogs and a guide; we handle cleaning and packaging of your harvest.', 'game-hunt', 44),
  ('f0000000-0000-0000-0000-00000000001a', 'Do I need a scope or gear?', 'No. Rifles come glassed with quality optics, bipod, and rear bag; we coach you through the dope.', 'optics-provided', 45),
  ('f0000000-0000-0000-0000-00000000001b', 'How do the pistol bays work?', 'Supervised one-on-one in a private bay; rental handguns and ammunition are available, or bring your own.', 'pistol-format', 46),
  ('f0000000-0000-0000-0000-00000000001c', 'What is the suppressor demo?', 'A guided chance to shoot suppressed rifles and pistols and feel how much they tame report and recoil. All NFA items stay on site.', 'suppressor', 47),
  ('f0000000-0000-0000-0000-00000000001d', 'What is helice?', 'Live-simulating targets that fly unpredictably off a spinning rotor — fast, addictive, and unlike anything on the clays course.', 'helice', 48);

-- ---- FAQ scopes: global / property / booking_type ----
INSERT INTO bid_faq_template_scopes (template_id, scope_type, property_id, booking_type)
SELECT 'f0000000-0000-0000-0000-000000000001'::uuid, 'global', NULL, NULL
UNION ALL SELECT 'f0000000-0000-0000-0000-000000000002'::uuid, 'global', NULL, NULL
UNION ALL SELECT 'f0000000-0000-0000-0000-000000000003'::uuid, 'global', NULL, NULL
UNION ALL SELECT 'f0000000-0000-0000-0000-000000000004'::uuid, 'global', NULL, NULL
UNION ALL SELECT 'f0000000-0000-0000-0000-000000000005'::uuid, 'global', NULL, NULL
UNION ALL SELECT 'f0000000-0000-0000-0000-000000000006'::uuid, 'global', NULL, NULL
UNION ALL SELECT 'f0000000-0000-0000-0000-000000000007'::uuid, 'global', NULL, NULL
UNION ALL SELECT 'f0000000-0000-0000-0000-000000000008'::uuid, 'property', (SELECT id FROM properties WHERE slug = 'horseshoe-bay'), NULL
UNION ALL SELECT 'f0000000-0000-0000-0000-000000000009'::uuid, 'property', (SELECT id FROM properties WHERE slug = 'horseshoe-bay'), NULL
UNION ALL SELECT 'f0000000-0000-0000-0000-00000000000a'::uuid, 'property', (SELECT id FROM properties WHERE slug = 'hog-heaven'), NULL
UNION ALL SELECT 'f0000000-0000-0000-0000-00000000000b'::uuid, 'property', (SELECT id FROM properties WHERE slug = 'hog-heaven'), NULL
UNION ALL SELECT 'f0000000-0000-0000-0000-00000000000c'::uuid, 'property', (SELECT id FROM properties WHERE slug = 'packsaddle'), NULL
UNION ALL SELECT 'f0000000-0000-0000-0000-00000000000d'::uuid, 'property', (SELECT id FROM properties WHERE slug = 'packsaddle'), NULL
UNION ALL SELECT 'f0000000-0000-0000-0000-00000000000e'::uuid, 'property', (SELECT id FROM properties WHERE slug = 'packsaddle'), NULL
UNION ALL SELECT 'f0000000-0000-0000-0000-00000000000f'::uuid, 'booking_type', NULL, 'private_lesson'::booking_type_enum
UNION ALL SELECT 'f0000000-0000-0000-0000-000000000010'::uuid, 'booking_type', NULL, 'host_an_occasion'::booking_type_enum
UNION ALL SELECT 'f0000000-0000-0000-0000-000000000011'::uuid, 'booking_type', NULL, 'host_an_occasion'::booking_type_enum
UNION ALL SELECT 'f0000000-0000-0000-0000-000000000012'::uuid, 'booking_type', NULL, 'plan_a_visit'::booking_type_enum;

-- ---- FAQ scopes: service (one row per matching service name) ----
INSERT INTO bid_faq_template_scopes (template_id, scope_type, service_id)
SELECT 'f0000000-0000-0000-0000-000000000013'::uuid, 'service', id FROM services WHERE name IN ('Sporting Clays', 'Helice', 'Wobble Deck')
UNION ALL SELECT 'f0000000-0000-0000-0000-000000000014'::uuid, 'service', id FROM services WHERE name = 'Wing Shooting'
UNION ALL SELECT 'f0000000-0000-0000-0000-000000000015'::uuid, 'service', id FROM services WHERE name IN ('Precision Rifle', 'Long Range')
UNION ALL SELECT 'f0000000-0000-0000-0000-000000000016'::uuid, 'service', id FROM services WHERE name = 'Sporting Clays'
UNION ALL SELECT 'f0000000-0000-0000-0000-000000000017'::uuid, 'service', id FROM services WHERE name = 'Sporting Clays'
UNION ALL SELECT 'f0000000-0000-0000-0000-000000000018'::uuid, 'service', id FROM services WHERE name = 'Wing Shooting'
UNION ALL SELECT 'f0000000-0000-0000-0000-000000000019'::uuid, 'service', id FROM services WHERE name = 'Game Hunt'
UNION ALL SELECT 'f0000000-0000-0000-0000-00000000001a'::uuid, 'service', id FROM services WHERE name IN ('Precision Rifle', 'Long Range')
UNION ALL SELECT 'f0000000-0000-0000-0000-00000000001b'::uuid, 'service', id FROM services WHERE name = 'Pistol Bays'
UNION ALL SELECT 'f0000000-0000-0000-0000-00000000001c'::uuid, 'service', id FROM services WHERE name = 'Suppressor Demo'
UNION ALL SELECT 'f0000000-0000-0000-0000-00000000001d'::uuid, 'service', id FROM services WHERE name = 'Helice';

-- ============================================================
-- Gear templates
-- ============================================================

INSERT INTO bid_gear_templates (id, name, description, dedupe_key, display_order) VALUES
  -- Global
  ('90000000-0000-0000-0000-000000000001', 'Eye & ear protection', 'Provided on site, or bring your own.', 'eye-ear', 1),
  ('90000000-0000-0000-0000-000000000002', 'Closed-toe shoes', 'No open-toe footwear on any range; flat, stable soles are best.', 'shoes', 2),
  ('90000000-0000-0000-0000-000000000003', 'Weather-appropriate clothing', 'We shoot rain or shine; dress for the forecast and layer for the morning.', 'weather-clothing', 3),
  ('90000000-0000-0000-0000-000000000004', 'Water bottle', 'Stay hydrated, especially in summer. Refill stations are on site.', 'water', 4),

  -- Per-property
  ('90000000-0000-0000-0000-000000000005', 'Electronic ear protection', 'Required on the rifle line so you can hear range commands; loaners available.', 'eye-ear', 1),
  ('90000000-0000-0000-0000-000000000006', 'Sun protection', 'Hat, sunglasses, and sunscreen; the high-desert positions have little shade.', 'sun', 20),
  ('90000000-0000-0000-0000-000000000007', 'Light jacket (optional)', 'Several stations sit in shaded creek bottoms that stay cool in the morning.', 'field-layer', 21),
  ('90000000-0000-0000-0000-000000000008', 'Field clothing & boots', 'Earth tones and broken-in boots for walking upland cover.', 'field-clothing', 22),

  -- Per-discipline (service)
  ('90000000-0000-0000-0000-000000000009', 'Shotgun (12 or 20ga)', 'Bring your own or rent a fitted gun for $40.', 'shotgun', 40),
  ('90000000-0000-0000-0000-00000000000a', 'Shooting vest or shell pouch (optional)', 'Handy for carrying shells between stations; loaners at the pro shop.', 'shooting-vest', 41),
  ('90000000-0000-0000-0000-00000000000b', 'Field shotgun & blaze orange', 'A 12 or 20ga field gun; a blaze-orange cap or vest is required in the field.', 'field-shotgun', 42),
  ('90000000-0000-0000-0000-00000000000c', 'Rifle — provided', 'Match rifle, optics, bipod, and rear bag are all supplied; bring your own only after clearing it with us.', 'rifle-provided', 43),
  ('90000000-0000-0000-0000-00000000000d', 'Notebook or phone (optional)', 'For recording dope; we''ll help you build a come-up chart you can keep.', 'data-book', 44),
  ('90000000-0000-0000-0000-00000000000e', 'License & broken-in boots', 'A Texas hunting license (buy online) and comfortable boots for time in the field.', 'hunt-gear', 45),

  -- Per-booking-type
  ('90000000-0000-0000-0000-00000000000f', 'Your own firearm (optional)', 'If you own the gun you''ll compete or hunt with, bring it so we can coach on your actual setup and fit.', 'byo-gun', 30),
  ('90000000-0000-0000-0000-000000000010', 'Nothing extra to bring', 'We handle all firearms, ammo, safety gear, and station setup for your group; just bring your crew.', 'group-nothing-extra', 31);

-- ---- Gear scopes: global / property / booking_type ----
INSERT INTO bid_gear_template_scopes (template_id, scope_type, property_id, booking_type)
SELECT '90000000-0000-0000-0000-000000000001'::uuid, 'global', NULL, NULL
UNION ALL SELECT '90000000-0000-0000-0000-000000000002'::uuid, 'global', NULL, NULL
UNION ALL SELECT '90000000-0000-0000-0000-000000000003'::uuid, 'global', NULL, NULL
UNION ALL SELECT '90000000-0000-0000-0000-000000000004'::uuid, 'global', NULL, NULL
UNION ALL SELECT '90000000-0000-0000-0000-000000000005'::uuid, 'property', (SELECT id FROM properties WHERE slug = 'packsaddle'), NULL
UNION ALL SELECT '90000000-0000-0000-0000-000000000006'::uuid, 'property', (SELECT id FROM properties WHERE slug = 'packsaddle'), NULL
UNION ALL SELECT '90000000-0000-0000-0000-000000000007'::uuid, 'property', (SELECT id FROM properties WHERE slug = 'horseshoe-bay'), NULL
UNION ALL SELECT '90000000-0000-0000-0000-000000000008'::uuid, 'property', (SELECT id FROM properties WHERE slug = 'hog-heaven'), NULL
UNION ALL SELECT '90000000-0000-0000-0000-00000000000f'::uuid, 'booking_type', NULL, 'private_lesson'::booking_type_enum
UNION ALL SELECT '90000000-0000-0000-0000-000000000010'::uuid, 'booking_type', NULL, 'host_an_occasion'::booking_type_enum;

-- ---- Gear scopes: service ----
INSERT INTO bid_gear_template_scopes (template_id, scope_type, service_id)
SELECT '90000000-0000-0000-0000-000000000009'::uuid, 'service', id FROM services WHERE name IN ('Sporting Clays', 'Helice', 'Wobble Deck')
UNION ALL SELECT '90000000-0000-0000-0000-00000000000a'::uuid, 'service', id FROM services WHERE name = 'Sporting Clays'
UNION ALL SELECT '90000000-0000-0000-0000-00000000000b'::uuid, 'service', id FROM services WHERE name = 'Wing Shooting'
UNION ALL SELECT '90000000-0000-0000-0000-00000000000c'::uuid, 'service', id FROM services WHERE name IN ('Precision Rifle', 'Long Range')
UNION ALL SELECT '90000000-0000-0000-0000-00000000000d'::uuid, 'service', id FROM services WHERE name IN ('Precision Rifle', 'Long Range')
UNION ALL SELECT '90000000-0000-0000-0000-00000000000e'::uuid, 'service', id FROM services WHERE name = 'Game Hunt';

-- ============================================================
-- Catch-all: drop any template that wound up scope-less (its target
-- property/service names weren't present), so the library has no dead rows.
-- ============================================================

DELETE FROM bid_faq_templates t
WHERE NOT EXISTS (
  SELECT 1 FROM bid_faq_template_scopes s WHERE s.template_id = t.id
);

DELETE FROM bid_gear_templates t
WHERE NOT EXISTS (
  SELECT 1 FROM bid_gear_template_scopes s WHERE s.template_id = t.id
);
