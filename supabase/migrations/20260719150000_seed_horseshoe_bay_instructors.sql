-- Seed the real Horseshoe Bay instructor roster (previously hardcoded in
-- app/(public)/horseshoe-bay/education/page.tsx's INSTRUCTORS array, now
-- wired to the live /admin/instructors system instead). Disciplines are
-- mapped to Horseshoe Bay's actual service catalog rather than the
-- mockup's free-text labels — HSB doesn't carry a standalone "Precision
-- Rifle" service (that's Packsaddle's specialty), so Casey Duran's
-- precision-rifle background stays in his bio text but isn't tagged as a
-- bookable discipline here.
--
-- Also deactivates the 3 instructor rows that exist ONLY for Horseshoe Bay
-- and are clearly dev placeholders (PLACEHOLDER Ash Carter / Quinn Rivers /
-- Sam Whitley) so they stop appearing on the live public education page.
-- Deliberately NOT touching "Nick" or "Taz C C" — both are available at
-- all three properties (shared dev/test fixtures), out of scope per this
-- pass's "don't touch Hog Heaven/Packsaddle" instruction.

DO $$
DECLARE
  v_property_id uuid;
  v_pistol_carbine uuid;
  v_sporting_clays uuid;
  v_wobble_deck uuid;
  v_helice uuid;
  v_shooting_deck uuid;
  v_instructor_id uuid;
BEGIN
  SELECT id INTO v_property_id FROM properties WHERE slug = 'horseshoe-bay';

  SELECT id INTO v_pistol_carbine FROM services WHERE property_id = v_property_id AND name = 'Pistol / Carbine Bays';
  SELECT id INTO v_sporting_clays FROM services WHERE property_id = v_property_id AND name = 'Sporting Clays';
  SELECT id INTO v_wobble_deck FROM services WHERE property_id = v_property_id AND name = 'Wobble Deck';
  SELECT id INTO v_helice FROM services WHERE property_id = v_property_id AND name = 'Helice';
  SELECT id INTO v_shooting_deck FROM services WHERE property_id = v_property_id AND name = 'Shooting Deck (5 Stand Etc.)';

  -- Casey Duran — pistol/carbine
  INSERT INTO instructors (property_id, name, bio, is_active, display_order)
  VALUES (v_property_id, 'Casey Duran', 'A retired U.S. Army Special Forces engineer sergeant and Green Beret with over 20 years of service, including nine years in Special Operations and multiple combat deployments. With the 10th Special Forces Group he was Chief Instructor for the Special Forces Advanced Urban Combat Course. Casey has trained military, law enforcement, and partner forces across the globe, and brings that operational and instructional depth straight to the range.', true, 0)
  RETURNING id INTO v_instructor_id;
  INSERT INTO instructor_properties (instructor_id, property_id) VALUES (v_instructor_id, v_property_id);
  INSERT INTO instructor_disciplines (instructor_id, service_id) VALUES (v_instructor_id, v_pistol_carbine);

  -- Adam McCaw — pistol/carbine
  INSERT INTO instructors (property_id, name, bio, is_active, display_order)
  VALUES (v_property_id, 'Adam McCaw', 'A background rooted in both special operations and real-world storytelling, shaped by years of service as a U.S. Army infantryman and Green Beret with multiple deployments. On the range Adam is known for a steady, thoughtful presence and a commitment to practical training. He emphasizes accountability, awareness, and respect for the weight of carrying a firearm.', true, 1)
  RETURNING id INTO v_instructor_id;
  INSERT INTO instructor_properties (instructor_id, property_id) VALUES (v_instructor_id, v_property_id);
  INSERT INTO instructor_disciplines (instructor_id, service_id) VALUES (v_instructor_id, v_pistol_carbine);

  -- John Johnson — pistol/carbine
  INSERT INTO instructors (property_id, name, bio, is_active, display_order)
  VALUES (v_property_id, 'John Johnson', 'A former U.S. Army Ranger with two decades in special operations, intelligence, and protective security, and a USPSA Master Class competitor. John blends real-world experience with modern technique, and works just as happily with first-time gun owners as with seasoned shooters.', true, 2)
  RETURNING id INTO v_instructor_id;
  INSERT INTO instructor_properties (instructor_id, property_id) VALUES (v_instructor_id, v_property_id);
  INSERT INTO instructor_disciplines (instructor_id, service_id) VALUES (v_instructor_id, v_pistol_carbine);

  -- Madison Sharpe — every clay discipline
  INSERT INTO instructors (property_id, name, bio, is_active, display_order)
  VALUES (v_property_id, 'Madison Sharpe', 'A professional sporting clays shooter and shotgun instructor who coaches every clay discipline. A South Carolina native, Madison has won regional, national, and world titles, including the 2024 Ladies World English Sporting Clays Championship.', true, 3)
  RETURNING id INTO v_instructor_id;
  INSERT INTO instructor_properties (instructor_id, property_id) VALUES (v_instructor_id, v_property_id);
  INSERT INTO instructor_disciplines (instructor_id, service_id) VALUES
    (v_instructor_id, v_sporting_clays), (v_instructor_id, v_wobble_deck), (v_instructor_id, v_helice), (v_instructor_id, v_shooting_deck);

  -- Ben Morton — shotgun
  INSERT INTO instructors (property_id, name, bio, is_active, display_order)
  VALUES (v_property_id, 'Ben Morton', NULL, true, 4)
  RETURNING id INTO v_instructor_id;
  INSERT INTO instructor_properties (instructor_id, property_id) VALUES (v_instructor_id, v_property_id);
  INSERT INTO instructor_disciplines (instructor_id, service_id) VALUES
    (v_instructor_id, v_sporting_clays), (v_instructor_id, v_wobble_deck), (v_instructor_id, v_helice), (v_instructor_id, v_shooting_deck);

  -- Randy Covey — shotgun
  INSERT INTO instructors (property_id, name, bio, is_active, display_order)
  VALUES (v_property_id, 'Randy Covey', NULL, true, 5)
  RETURNING id INTO v_instructor_id;
  INSERT INTO instructor_properties (instructor_id, property_id) VALUES (v_instructor_id, v_property_id);
  INSERT INTO instructor_disciplines (instructor_id, service_id) VALUES
    (v_instructor_id, v_sporting_clays), (v_instructor_id, v_wobble_deck), (v_instructor_id, v_helice), (v_instructor_id, v_shooting_deck);

  -- Renee Blaine — shotgun
  INSERT INTO instructors (property_id, name, bio, is_active, display_order)
  VALUES (v_property_id, 'Renee Blaine', NULL, true, 6)
  RETURNING id INTO v_instructor_id;
  INSERT INTO instructor_properties (instructor_id, property_id) VALUES (v_instructor_id, v_property_id);
  INSERT INTO instructor_disciplines (instructor_id, service_id) VALUES
    (v_instructor_id, v_sporting_clays), (v_instructor_id, v_wobble_deck), (v_instructor_id, v_helice), (v_instructor_id, v_shooting_deck);
END $$;

-- Deactivate the Horseshoe-Bay-exclusive placeholder instructors.
UPDATE instructors SET is_active = false
WHERE name IN ('PLACEHOLDER Ash Carter', 'PLACEHOLDER Quinn Rivers', 'PLACEHOLDER Sam Whitley');
