-- Optional free-form text the staff can attach to a confirmed quote
-- to explain the adjustment ("Holiday weekend rate", "Happy hour
-- discount", "Group of 10+ surcharge"). Rendered to the guest on the
-- bid page next to the confirmed_price.
--
-- Lives on `bids` rather than `bookings` because it's part of the bid
-- authoring surface (alongside schedule_notes, gear_list, faq) — staff
-- write it; the booking row holds the numeric data. Markdown-rendered
-- in App 3.4.

ALTER TABLE bids
  ADD COLUMN quote_note text;
