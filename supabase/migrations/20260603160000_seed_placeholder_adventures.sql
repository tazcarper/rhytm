-- =============================================================
-- Placeholder seed: member_adventures
--
-- The five trips from the HBSC members'-entrance reference
-- (docs/reference/Members' Entrance · Horseshoe Bay Sporting Club.html),
-- so the /member/adventures listing renders realistic content before
-- the client's real adventures catalog lands. All on horseshoe-bay.
--
-- Every row carries details.placeholder = true. Remove the whole set
-- with one query when the real catalog arrives:
--   DELETE FROM member_adventures WHERE details->>'placeholder' = 'true';
--
-- Display fields the reference shows but the table has no column for
-- (category, destination location, duration label) live in `details`
-- jsonb and are read via a typed, tolerant AdventureDetails parser in
-- src/services/members/adventures.ts. datesLabel / priceLabel /
-- capacityLabel / badge / comingSoon are display overrides used where a
-- NOT NULL column (start_date, price) can't express the reference state
-- (e.g. "Dates to be announced", "Included", "Coming Soon"). When real
-- adventures replace these, the overrides simply aren't set and the UI
-- derives everything from real columns + RSVP data.
--
-- Members only see these once they hold an ACTIVE horseshoe-bay
-- membership (the "adventures: member read published" RLS policy). Use
-- /dev to create a test member + membership to view them.
--
-- NOT EXISTS guard on (property_id, title) keeps the seed idempotent if
-- ever re-applied. NULL columns are cast in the SELECT so the all-NULL
-- VALUES columns don't fall back to `text`.
-- =============================================================

INSERT INTO member_adventures (
  property_id, title, description, start_date, end_date,
  max_capacity, max_guests_per_rsvp,
  price, guest_price, deposit_amount,
  status, is_manually_sold_out, details
)
SELECT
  p.id, v.title, v.description, v.start_date::date, v.end_date::date,
  v.max_capacity, v.max_guests_per_rsvp,
  v.price::numeric(10,2), v.guest_price::numeric(10,2), v.deposit_amount::numeric(10,2),
  v.status::adventure_status_enum, v.is_manually_sold_out, v.details::jsonb
FROM properties p
JOIN (VALUES
  (
    'horseshoe-bay',
    'Argentina Dove · Córdoba',
    'The mythic high-volume hunt — five days at an estancia in the Córdoba foothills.',
    '2026-12-04', '2026-12-09', 8, 2,
    6850.00, NULL, NULL,
    'published', false,
    '{"category":"Wingshooting","location":"Córdoba, Argentina","durationLabel":"5 nights / 4 hunting days","badge":"Filling Fast","capacityLabel":"3 of 8 reserved","placeholder":true}'
  ),
  (
    'horseshoe-bay',
    'Founders'' Retreat · Pedernales',
    'An invitation-only weekend for the inaugural Founder class.',
    '2026-10-23', '2026-10-25', 30, 2,
    0.00, NULL, NULL,
    'published', false,
    '{"category":"Member Retreat","location":"Pedernales River, TX","durationLabel":"2 nights","badge":"Now Booking","priceLabel":"Included","capacityLabel":"18 of 30 reserved","placeholder":true}'
  ),
  (
    'horseshoe-bay',
    'Texas Hill Country Quail · January',
    'Three days on a fourth-generation ranch outside Brady — wild birds, classic dog work.',
    '2027-01-15', '2027-01-18', 6, 2,
    2950.00, NULL, NULL,
    'published', false,
    '{"category":"Wingshooting","location":"Brady, Texas","durationLabel":"3 nights / 2 hunting days","capacityLabel":"1 of 6 reserved","placeholder":true}'
  ),
  (
    'horseshoe-bay',
    'Sonora Whitetail · Late Season',
    'Trophy whitetail at a managed concession in northern Mexico.',
    '2027-01-08', '2027-01-13', 4, 1,
    9800.00, NULL, NULL,
    'sold_out', true,
    '{"category":"Big Game","location":"Sonora, Mexico","badge":"Waitlist Only","capacityLabel":"4 of 4 reserved","placeholder":true}'
  ),
  (
    'horseshoe-bay',
    'World Sporting Clays Championship · Spring',
    'Members'' travel cohort to the World — coaching, evening tables, a shared experience.',
    '2027-04-01', '2027-04-05', 12, 1,
    0.00, NULL, NULL,
    'published', false,
    '{"category":"Sporting Clays Travel","location":"TBD","durationLabel":"4 nights","datesLabel":"Dates to be announced","priceLabel":"—","badge":"Coming Soon","comingSoon":true,"placeholder":true}'
  )
) AS v(
  slug, title, description, start_date, end_date,
  max_capacity, max_guests_per_rsvp,
  price, guest_price, deposit_amount,
  status, is_manually_sold_out, details
)
  ON p.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1 FROM member_adventures existing
  WHERE existing.property_id = p.id
    AND existing.title = v.title
);
