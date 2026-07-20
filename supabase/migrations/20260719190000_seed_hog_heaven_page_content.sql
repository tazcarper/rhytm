-- Seeds Hog Heaven's property_page_content + basics/layout rows, mirroring
-- the parity 20260719140000 migration did for Horseshoe Bay: transcribed
-- verbatim from the current hardcoded DEFAULT_* content in
-- app/(public)/hog-heaven/*, so an admin opening the "Marketing pages"
-- editors for Hog Heaven sees real current copy instead of empty inputs
-- that only start working after the first save.
--
-- ON CONFLICT DO NOTHING throughout: idempotent, never clobbers a row an
-- admin may already have touched.
--
-- Deliberately NOT seeded here, matching real gaps already flagged in
-- plan/frontend/hog-heaven-remaining-pages.md:
--   - adventures/intro — Hog Heaven's /adventures page is a static
--     "Coming Soon" state per an explicit product decision and never reads
--     property_page_content at all; seeding a row here would be dead data
--     an admin could edit with zero visible effect.
--   - membership/pricing — Hog Heaven's four family tiers + corporate tier
--     don't fit that section's shape (title=number, body=label); still
--     static page content, same tradeoff already documented in
--     app/(public)/hog-heaven/membership/page.tsx.
--   - education's "Hog Heaven PT" band — static for the same "doesn't fit
--     single/items shape" reason, documented in education/page.tsx.
--   - club_life (community/instagram/instagram-photos) — Horseshoe Bay's
--     own club_life sections aren't seeded yet either (see the parity
--     migration); matching that, not exceeding it, so both properties are
--     in the same state until a follow-up pass covers both.
--   - FAQ — its own table, property_faq_entries; no content exists to
--     seed (see the FAQ page's own code comment).

-- ============================================================ basics ====

INSERT INTO property_page_content (property_id, page_key, section_key, image_url)
SELECT id, 'basics', 'logo',
  '/properties/hog-heaven/hogheaven_logo_primary_horizontal_on-light.png'
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, body)
SELECT id, 'basics', 'address',
  '24905 Ranch Rd 12
Dripping Springs, TX 78620'
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, items)
SELECT id, 'basics', 'contact-info', jsonb_build_array(
  jsonb_build_object('title', 'Email', 'body', 'shoot@hogheavensportingclub.com'),
  jsonb_build_object('title', 'Phone', 'body', '(512) 987-6938')
)
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, items)
SELECT id, 'basics', 'office-hours', jsonb_build_array(
  jsonb_build_object('title', 'Mon', 'body', 'Closed'),
  jsonb_build_object('title', 'Tue–Sat', 'body', '10 AM – 4 PM'),
  jsonb_build_object('title', 'Sun', 'body', 'Closed')
)
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, items)
SELECT id, 'basics', 'social-links', jsonb_build_array(
  jsonb_build_object('title', 'Instagram', 'linkHref', 'https://www.instagram.com/hogheavensporting/'),
  jsonb_build_object('title', 'Facebook', 'linkHref', 'https://www.facebook.com/hogheavensporting/')
)
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

-- ============================================================ layout ====

INSERT INTO property_page_content (property_id, page_key, section_key, heading, body)
SELECT id, 'layout', 'footer',
  'Newsletter',
  'Receive regular updates and club news.'
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

-- ============================================================== home ====

INSERT INTO property_page_content (property_id, page_key, section_key, heading, body)
SELECT id, 'home', 'intro',
  'The Country Club Dripping Springs Deserves',
  'Set against the Texas Hill Country, Hog Heaven is a sporting club, outdoor education facility, event venue, and nature preserve. Over 120 acres of pristine Hill Country, anchored by a 15-acre stocked lake, thirty minutes from Austin. Fishing, archery, sporting clays, and pistol, taught by best-in-class instructors, plus a full calendar of social events. We connect accessible outdoor activities with great community.

Hog Heaven Sporting Club is a place to learn new skills, master your craft, and gather in community. But most of all, for those of us who feel the outdoors as part of our soul and our identity, this is a little slice of heaven, right in your own backyard.'
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, items)
SELECT id, 'home', 'find-your-way', jsonb_build_array(
  jsonb_build_object('title', 'Club Life', 'linkHref', '/hog-heaven/club-life', 'imageUrl', '/properties/hog-heaven/wayin-club-life.jpg'),
  jsonb_build_object('title', 'Adventure', 'linkHref', '/hog-heaven/adventures', 'imageUrl', '/properties/hog-heaven/wayin-adventure.jpg'),
  jsonb_build_object('title', 'Education', 'linkHref', '/hog-heaven/education', 'imageUrl', '/properties/hog-heaven/wayin-education.jpg'),
  jsonb_build_object('title', 'Calendar', 'linkHref', '/hog-heaven/events', 'imageUrl', '/properties/hog-heaven/wayin-events-calendar.jpg')
)
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, items)
SELECT id, 'home', 'amenities', jsonb_build_array(
  jsonb_build_object(
    'title', 'Shotgun',
    'body', 'Sporting clays course wrapping around the lake, plus skeet, trap, and 5-stand.',
    'bullets', jsonb_build_array('12 sporting clays stations', '4 trap and skeet fields', '5 station super sporting course', 'Two 5-stands'),
    'imageUrl', '/properties/hog-heaven/facility-shotgun.jpg'
  ),
  jsonb_build_object(
    'title', 'Pistol & Carbine',
    'body', 'Nine outdoor bays with interactive steel and paper targets, and instruction at every level.',
    'bullets', jsonb_build_array('9 pistol and carbine bays', 'Interactive steel and paper targets', 'Lessons from working pros'),
    'imageUrl', '/properties/hog-heaven/facility-pistol.jpg'
  ),
  jsonb_build_object(
    'title', 'Archery & The Lake',
    'body', 'A 3D archery gallery and a spring-fed lake stocked and structured for real fishing.',
    'bullets', jsonb_build_array('3D gallery with Texas native and big game targets', '15-acre stocked lake, 200+ underwater habitat structures', 'Bass, bluegill, and catfish'),
    'imageUrl', '/properties/hog-heaven/facility-archery.jpg'
  )
)
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, heading, body)
SELECT id, 'home', 'campaign-quote',
  'A little slice of heaven. Just minutes away.',
  'Healthy people and strong community, built around the outdoors.'
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, heading, body, cta_label, cta_href)
SELECT id, 'home', 'join-cta',
  'Join the Club',
  'An immersive sporting and lifestyle experience less than 30 minutes from Austin, for people passionate about their craft, their community, and the outdoors.',
  'Explore Membership', '/hog-heaven/membership'
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

-- ==================================================== private_events ====

INSERT INTO property_page_content (property_id, page_key, section_key, heading, body, cta_label, cta_href)
SELECT id, 'private_events', 'intro',
  'Book Your Event',
  'Looking for a one-of-a-kind event venue in the Texas Hill Country? Hog Heaven Sporting Club in Dripping Springs is the right place for private events of all sizes. We have hosted everyone from small businesses to names like Red Bull Racing, Ducks Unlimited, and Texas Parks and Wildlife.

Whether you are planning a corporate shoot, a fundraiser, or a team-building day, we are here to make it go well. Guests can enjoy sporting clays, skeet and trap, fishing, and our pistol range, all in a stunning outdoor setting. Afterward, your group can gather on the pavilion or the Party Bridge for refreshments, dinner, and live entertainment. Our team helps with catering, entertainment, and anything else you need.',
  'Submit Event Inquiry', '#inquiry'
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, items)
SELECT id, 'private_events', 'occasions', jsonb_build_array(
  jsonb_build_object('title', 'Corporate & Team Building', 'body', 'Company shoots, retreats, board meetings, and leadership days. Take the clays course, the skeet and trap fields, the 5-stand, and the pistol bays, or bring the whole office out for a day in the field.'),
  jsonb_build_object('title', 'Charity & Fundraising Shoots', 'body', 'We host many charity clay shoots each year, and we are a natural fit for your non-profit''s fundraising event.'),
  jsonb_build_object('title', 'Private Parties & Gatherings', 'body', 'Birthdays, bachelor and bridal parties, dinners on the Party Bridge, reunions, and much more.'),
  jsonb_build_object('title', 'Weddings & Wedding Parties', 'body', 'Hog Heaven offers several picturesque settings for your ceremony, your reception, and the days around them.')
)
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, items)
SELECT id, 'private_events', 'services', jsonb_build_array(
  jsonb_build_object('title', 'The Range', 'body', 'Sporting clays, skeet and trap, 5-stand, and the pistol bays. Instructors and gear for every skill level, first-timers included.', 'bullets', jsonb_build_array('Capacity and layout vary by space — our team will walk you through the options', 'Sporting clays, skeet and trap, 5-stand', 'Pistol bays and fishing on the lake')),
  jsonb_build_object('title', 'Food & Drink', 'body', 'Catering on the pavilion or dinner out on the Party Bridge, with refreshments through the day and live entertainment if you want it.', 'bullets', jsonb_build_array('Instruction and gear for every level', 'Catering on the pavilion', 'Dinner on the Party Bridge')),
  jsonb_build_object('title', 'The Details', 'body', 'Planning, coordination, and on-site staff. We have hosted everyone from small businesses to Red Bull Racing, Ducks Unlimited, and Texas Parks and Wildlife.', 'bullets', jsonb_build_array('Live entertainment on request', 'Planning and coordination', 'On-site staff all day'))
)
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, heading, body, items)
SELECT id, 'private_events', 'setting-gallery',
  '120+ Acres To Play With',
  'The clays course, the skeet and trap fields, the pistol bays, and the lake. When the shooting is done, the pavilion and the Party Bridge are waiting for refreshments, dinner, and live entertainment.',
  jsonb_build_array(jsonb_build_object(), jsonb_build_object(), jsonb_build_object())
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

-- ========================================================= education ====

INSERT INTO property_page_content (property_id, page_key, section_key, heading, body, cta_label, cta_href)
SELECT id, 'education', 'intro',
  'Learn From The Pros',
  'Hog Heaven offers pistol, carbine, and shotgun training led by a cadre of seasoned professionals. Our instructors range from national champions to combat veterans with decades of experience. Whoever you train with, they share the same emphasis: progress, safety, and camaraderie.

For a more personalized experience, private lessons are also available. Whether you are just getting started or refining technique you have spent years building, one on one instruction is a fast way to build confidence and sharpen your skills.',
  'Meet the Instructors', '#instructors'
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, items)
SELECT id, 'education', 'programs', jsonb_build_array(
  jsonb_build_object('title', 'Shotgun', 'body', 'Sporting clays, skeet, and trap. Learn to read a target, build a mount and swing you can repeat, and get better in good company.', 'linkHref', '/hog-heaven/events'),
  jsonb_build_object('title', 'Pistol', 'body', 'Pistol and carbine, from your first safe reps to real working skill. Fundamentals taught patiently, then pressure added on purpose.', 'linkHref', '/hog-heaven/events'),
  jsonb_build_object('title', 'Outdoor Skills', 'body', 'The skills that live off the range. Hunting prep, emergency skills, and the practical know-how that makes a day outdoors go well.', 'linkHref', '/hog-heaven/events')
)
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, heading, cta_label, cta_href)
SELECT id, 'education', 'cta',
  'Come often. Not long.',
  'Join the Club', '/hog-heaven/membership'
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

-- ============================================================ events ====

INSERT INTO property_page_content (property_id, page_key, section_key, body)
SELECT id, 'events', 'included-band',
  'Most of what fills this calendar: leagues, classes, and social events, comes free with your membership.'
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, heading, body, cta_label, cta_href)
SELECT id, 'events', 'members-cta',
  'First Access',
  'Members receive early registration access and member-only invitations to everything on the calendar.',
  'Become a Member', '/hog-heaven/membership'
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

-- ======================================================== membership ====

INSERT INTO property_page_content (property_id, page_key, section_key, heading, body, cta_label, cta_href)
SELECT id, 'membership', 'intro',
  'Join the Club',
  'Hog Heaven is the destination for those who demand excellence in their outdoor pursuits. Built around an unwavering commitment to craft and community, the club is designed for members who want their passion for the outdoors woven into daily life, not saved for the rare free weekend.

Set against the natural beauty of the Texas Hill Country, Hog Heaven is where we meet, practice our craft, and push ourselves to grow. It is where families connect and community thrives.

Sporting club memberships are intentionally limited. Not only to protect our facility and landscape, but to preserve the integrity of why we are here: to grow and connect in nature.',
  'Request Membership Info', '#inquiry'
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, items)
SELECT id, 'membership', 'benefits', jsonb_build_array(
  jsonb_build_object('title', 'Every Discipline', 'body', 'Shotgun, pistol, archery, and the stocked lake, all included with membership. Golf cart rentals too.'),
  jsonb_build_object('title', 'Access On Your Schedule', 'body', '8 AM to 8 PM, seven days a week. Bring guests whenever you like for a $50 day fee.'),
  jsonb_build_object('title', 'Training Included', 'body', 'Hog Heaven PT comes with premier plans. Private lessons and training classes at member pricing.'),
  jsonb_build_object('title', 'Retail Discounts', 'body', '$.39 clay targets, plus discounts on ammo, retail, and private events.')
)
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, items)
SELECT id, 'membership', 'amenities', jsonb_build_array(
  jsonb_build_object(
    'title', 'Shotgun',
    'body', 'Sporting clays course wrapping around the lake, plus skeet, trap, and 5-stand.',
    'bullets', jsonb_build_array('12 sporting clays stations', '4 trap and skeet fields', '5 station super sporting course', 'Two 5-stands')
  ),
  jsonb_build_object(
    'title', 'Pistol & Carbine',
    'body', 'Nine outdoor bays with interactive steel and paper targets, and instruction at every level.',
    'bullets', jsonb_build_array('9 pistol and carbine bays', 'Interactive steel and paper targets', 'Lessons from working pros')
  ),
  jsonb_build_object(
    'title', 'Archery & The Lake',
    'body', 'A 3D archery gallery and a spring-fed lake stocked and structured for real fishing.',
    'bullets', jsonb_build_array('3D gallery with Texas native and big game targets', '15-acre stocked lake, 200+ underwater habitat structures', 'Bass, bluegill, and catfish')
  )
)
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, heading, body, items)
SELECT id, 'membership', 'club-spotlight',
  'The Party Bridge',
  'An event bridge over the lake. Dinners, gatherings, and the kind of evenings people talk about later.',
  jsonb_build_array(jsonb_build_object(), jsonb_build_object(), jsonb_build_object())
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, items)
SELECT id, 'membership', 'onboarding-steps', jsonb_build_array(
  jsonb_build_object('title', 'Safety and the Rules', 'body', 'Firearm handling standards, range etiquette, and what is and is not allowed where.'),
  jsonb_build_object('title', 'A Walk of the Property', 'body', 'Where everything is, how to check in, and how the day actually works.'),
  jsonb_build_object('title', 'Your Access', 'body', 'Gate access, your account, and everything you need to come back on your own.')
)
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;

INSERT INTO property_page_content (property_id, page_key, section_key, heading, body)
SELECT id, 'membership', 'ambassador',
  'Georgia Stone',
  'Skip the form. Georgia will walk you through the club in person, at a time that suits you.

Membership Director'
FROM properties WHERE slug = 'hog-heaven'
ON CONFLICT (property_id, page_key, section_key) DO NOTHING;
