-- Seed every remaining hardcoded content block across the 9 Horseshoe Bay
-- pages into property_page_content, transcribed verbatim from the current
-- hardcoded arrays/JSX in app/(public)/horseshoe-bay/*. This makes the
-- database the actual source of truth admins edit against — an admin
-- opening the new "Marketing pages" editors sees the real current copy
-- (and can add/remove/reorder cards), rather than an empty table that only
-- starts working after the first save.
--
-- ON CONFLICT DO NOTHING throughout: idempotent, and never clobbers a row an
-- admin may have already touched between this migration being written and
-- applied.
--
-- Deliberately NOT seeded here: education's instructor roster (wired to the
-- real instructors/instructor_properties system instead — see
-- src/services/public/instructors.ts) and the FAQ page (its own table,
-- property_faq_entries — see the companion seed migration).

-- ============================================================ home ======

INSERT INTO property_page_content (property_id, page_key, section_key, heading, body)
SELECT id, 'home', 'intro',
  'A New Standard in Shooting Sports',
  'Horseshoe Bay Sporting Club is a premier private shooting destination designed exclusively for the Club at Horseshoe Bay members and their families. We offer curated shooting experiences and personalized instruction in a safe, welcoming environment that honors shooting tradition while delivering elevated hospitality.

More than a range, we are where members hone their craft, celebrate the outdoors, and create meaningful connections across generations: the new third place for the Horseshoe Bay community.'
FROM properties WHERE slug = 'horseshoe-bay'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, items)
SELECT id, 'home', 'find-your-way', jsonb_build_array(
  jsonb_build_object('title', 'Club Life', 'linkHref', '/horseshoe-bay/club-life', 'imageUrl', '/properties/horseshoe-bay/wayin-club-life.jpg'),
  jsonb_build_object('title', 'Adventure', 'linkHref', '/horseshoe-bay/adventures', 'imageUrl', '/properties/horseshoe-bay/wayin-adventure.jpg'),
  jsonb_build_object('title', 'Education', 'linkHref', '/horseshoe-bay/education', 'imageUrl', '/properties/horseshoe-bay/wayin-education.jpg'),
  jsonb_build_object('title', 'Calendar', 'linkHref', '/horseshoe-bay/events', 'imageUrl', '/properties/horseshoe-bay/wayin-events-calendar.jpg')
)
FROM properties WHERE slug = 'horseshoe-bay'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, items)
SELECT id, 'home', 'amenities', jsonb_build_array(
  jsonb_build_object(
    'title', 'Shotgun Range',
    'body', 'Sporting clays course with Hill Country views, plus three shooting decks.',
    'bullets', jsonb_build_array('12-station sporting clays course', '5-Stand and Flurry decks', 'Helice ring'),
    'imageUrl', '/properties/horseshoe-bay/facility-1.jpg'
  ),
  jsonb_build_object(
    'title', 'Pistol Range',
    'body', 'Safe, supervised sessions for shooters of all experience levels.',
    'bullets', jsonb_build_array('One 50-yard pistol bay', 'Three 25-yard pistol bays', 'Covered pavilion with group seating'),
    'imageUrl', '/properties/horseshoe-bay/facility-2.jpg'
  ),
  jsonb_build_object(
    'title', 'Members'' Lounge',
    'body', 'Unwind in the clubhouse or Trophy Room after your time on the range.',
    'bullets', jsonb_build_array('Clubhouse with retail and food & beverage', 'Trophy Room with game tables and lounge area', 'The Last Shot bar: craft cocktails, six days a week'),
    'imageUrl', '/properties/horseshoe-bay/facility-3.jpg'
  )
)
FROM properties WHERE slug = 'horseshoe-bay'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, heading, body)
SELECT id, 'home', 'campaign-quote',
  'Where skill and community meet tradition',
  'Excellence on, and off, the range.'
FROM properties WHERE slug = 'horseshoe-bay'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, heading, body, cta_label, cta_href)
SELECT id, 'home', 'join-cta',
  'Join the Club',
  'We are now welcoming members of the Club at Horseshoe Bay to join us on the range. Membership secures your place at the heart of the club, and invites you and your family to shape the future of our community.',
  'Learn More', '/horseshoe-bay/membership'
FROM properties WHERE slug = 'horseshoe-bay'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

-- ====================================================== membership =====

INSERT INTO property_page_content (property_id, page_key, section_key, items)
SELECT id, 'membership', 'pricing', jsonb_build_array(
  jsonb_build_object('title', '$2,950', 'body', 'Initiation'),
  jsonb_build_object('title', '$295', 'body', 'Per Month')
)
FROM properties WHERE slug = 'horseshoe-bay'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, items)
SELECT id, 'membership', 'benefits', jsonb_build_array(
  jsonb_build_object('title', 'Curated Shooting Experiences', 'body', 'Sporting clays, 5-Stand, pistol, and more. All included for members and their guests.'),
  jsonb_build_object('title', 'Personalized Instruction', 'body', 'Expert coaching for every discipline and every experience level.'),
  jsonb_build_object('title', 'The Last Shot Bar', 'body', 'Craft cocktails and cold beer in the Trophy Room, six days a week.'),
  jsonb_build_object('title', 'Refined Hospitality', 'body', 'Elevated hospitality that exceeds resort-level expectations.')
)
FROM properties WHERE slug = 'horseshoe-bay'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, items)
SELECT id, 'membership', 'amenities', jsonb_build_array(
  jsonb_build_object(
    'title', 'Shotgun Range',
    'body', 'Sporting clays course with Hill Country views, plus three shooting decks.',
    'bullets', jsonb_build_array('12-station sporting clays course', '5-Stand and Flurry decks', 'Helice ring'),
    'imageUrl', '/properties/horseshoe-bay/facility-1.jpg'
  ),
  jsonb_build_object(
    'title', 'Pistol Range',
    'body', 'Safe, supervised sessions for shooters of all experience levels.',
    'bullets', jsonb_build_array('One 50-yard pistol bay', 'Three 25-yard pistol bays', 'Covered pavilion with group seating'),
    'imageUrl', '/properties/horseshoe-bay/facility-2.jpg'
  ),
  jsonb_build_object(
    'title', 'Members'' Lounge',
    'body', 'Unwind in the clubhouse or Trophy Room after your time on the range.',
    'bullets', jsonb_build_array('Clubhouse with retail and food & beverage', 'Trophy Room with game tables and lounge area', 'The Last Shot bar: craft cocktails, six days a week'),
    'imageUrl', '/properties/horseshoe-bay/facility-3.jpg'
  )
)
FROM properties WHERE slug = 'horseshoe-bay'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, heading, body, items)
SELECT id, 'membership', 'club-spotlight',
  'The Last Shot Bar',
  'Nestled inside the Trophy Room, The Last Shot Bar is where members unwind with craft cocktails and cold beer after time on the range. Six days a week, this is your place to decompress, connect, and drink well.',
  jsonb_build_array(
    jsonb_build_object('imageUrl', '/properties/horseshoe-bay/img/clublife-1.jpg'),
    jsonb_build_object('imageUrl', '/properties/horseshoe-bay/img/clublife-2.jpg'),
    jsonb_build_object('imageUrl', '/properties/horseshoe-bay/img/clublife-3.jpg')
  )
FROM properties WHERE slug = 'horseshoe-bay'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, items)
SELECT id, 'membership', 'onboarding-steps', jsonb_build_array(
  jsonb_build_object('title', 'Safety and the Rules', 'body', 'Firearm handling standards, range etiquette, and what is and is not allowed where.'),
  jsonb_build_object('title', 'A Walk of the Property', 'body', 'Where everything is, how to check in, and how the day actually works.'),
  jsonb_build_object('title', 'Your Access', 'body', 'Gate access, your account, and everything you need to come back on your own.')
)
FROM properties WHERE slug = 'horseshoe-bay'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, heading, body, image_url)
SELECT id, 'membership', 'ambassador',
  'Cuatro Smith',
  'Skip the form. Cuatro will walk you through the club in person, at a time that suits you.

Membership Ambassador',
  '/properties/horseshoe-bay/img/cuatro-smith.jpg'
FROM properties WHERE slug = 'horseshoe-bay'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

-- ==================================================== private_events ===

INSERT INTO property_page_content (property_id, page_key, section_key, items)
SELECT id, 'private_events', 'occasions', jsonb_build_array(
  jsonb_build_object('title', 'Corporate & Group Shoots', 'body', 'Bring your company to the sporting clays course, the shooting decks, and the pistol bays, with instructors on hand for every skill level.', 'imageUrl', '/properties/horseshoe-bay/host-corporate-group-shoots.jpg'),
  jsonb_build_object('title', 'Charity & Fundraising Shoots', 'body', 'A memorable setting for a non-profit clay shoot, with our team behind your cause.', 'imageUrl', '/properties/horseshoe-bay/host-charity-fundraising-shoots.jpg'),
  jsonb_build_object('title', 'Retreats & Meetings', 'body', 'Utilizes our private conference room and meeting spaces, with time on the range to open or close the day.', 'imageUrl', '/properties/horseshoe-bay/host-retreats-meetings.jpg'),
  jsonb_build_object('title', 'Private Parties & Celebrations', 'body', 'The Trophy Room, The Last Shot bar, and the shaded patio make natural homes for celebration.', 'imageUrl', '/properties/horseshoe-bay/host-private-parties-celebrations.jpg')
)
FROM properties WHERE slug = 'horseshoe-bay'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, items)
SELECT id, 'private_events', 'services', jsonb_build_array(
  jsonb_build_object('title', 'The Range', 'body', 'Guided shooting for every skill level, instruction and gear included.', 'bullets', jsonb_build_array('Sporting clays and 5-Stand', 'Pistol bays', 'All skill levels')),
  jsonb_build_object('title', 'The Clubhouse', 'body', 'Lounge, Trophy Room, and The Last Shot bar for gathering before and after.', 'bullets', jsonb_build_array('Food and beverage', 'The Last Shot bar', 'Deck over the course')),
  jsonb_build_object('title', 'The Details', 'body', 'We handle the logistics so your group just shows up.', 'bullets', jsonb_build_array('Planning and coordination', 'On-site staff', 'Custom to your group'))
)
FROM properties WHERE slug = 'horseshoe-bay'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, heading, body, items)
SELECT id, 'private_events', 'setting-gallery',
  '150+ Acres Of Rolling Hill Country',
  'Book time on the sporting clays course, flurry deck, and pistol bays. Afterward, meet in the clubhouse and Trophy Room to celebrate, network, or simply relax.',
  jsonb_build_array(
    jsonb_build_object('imageUrl', '/properties/horseshoe-bay/img/venue-1.jpg'),
    jsonb_build_object('imageUrl', '/properties/horseshoe-bay/img/venue-2.jpg'),
    jsonb_build_object('imageUrl', '/properties/horseshoe-bay/img/venue-3.jpg')
  )
FROM properties WHERE slug = 'horseshoe-bay'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

-- ========================================================= education ===

INSERT INTO property_page_content (property_id, page_key, section_key, items)
SELECT id, 'education', 'programs', jsonb_build_array(
  jsonb_build_object('title', 'Shotgun Classes', 'body', 'Sporting clays, 5-stand, and more. From intro clinics to advanced sessions, you''ll learn to read targets and build a mount & swing that will have you breaking clays.', 'linkHref', '/horseshoe-bay/events'),
  jsonb_build_object('title', 'Pistol Classes', 'body', 'Safe and fun training on the pistol bays, for shooters at every experience level. Fundamentals taught patiently, then built on.', 'linkHref', '/horseshoe-bay/events'),
  jsonb_build_object('title', 'Private Lessons', 'body', 'One-on-one instruction in shotgun and pistol, tailored to your level and your interests, led by professionals with decades of experience.', 'linkHref', '#instructors')
)
FROM properties WHERE slug = 'horseshoe-bay'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, heading, cta_label, cta_href)
SELECT id, 'education', 'cta',
  'Book your session.',
  'Join the Club', '/horseshoe-bay/membership'
FROM properties WHERE slug = 'horseshoe-bay'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

-- ============================================================ events ===

INSERT INTO property_page_content (property_id, page_key, section_key, body)
SELECT id, 'events', 'included-band',
  'Most of what fills this calendar: leagues, classes, and social events, comes free with your membership.'
FROM properties WHERE slug = 'horseshoe-bay'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, heading, body, cta_label, cta_href)
SELECT id, 'events', 'members-cta',
  'Members Get First Access',
  'Members receive early access to registrations and member-only invitations to everything on the calendar.',
  'Become a Member', '/horseshoe-bay/membership'
FROM properties WHERE slug = 'horseshoe-bay'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

-- ========================================================= adventures ==

INSERT INTO property_page_content (property_id, page_key, section_key, heading, body)
SELECT id, 'adventures', 'intro',
  'Where We''re Going Next',
  'Curated journeys and signature experiences — a members'' privilege. Open to wander; reserved to book.'
FROM properties WHERE slug = 'horseshoe-bay'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;
