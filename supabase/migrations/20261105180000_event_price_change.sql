-- ============================================================
-- Date-based tiered pricing for events
-- ============================================================
--
-- An event can change price on a date, e.g. $65 before December 1 and $85
-- from then on. member_price / non_member_price stay the price BEFORE the
-- change; the new *_after columns hold the price FROM price_change_on
-- (a calendar date in the club's timezone, America/Chicago, inclusive).
--
-- A NULL *_after means that audience's price does not change. The
-- application picks the price in force (src/services/events/effective-price.ts);
-- nothing here is a trigger, and no RLS change is needed (same table, same
-- policies).

ALTER TABLE events
  ADD COLUMN price_change_on          date,
  ADD COLUMN member_price_after       numeric(10,2) CHECK (member_price_after IS NULL OR member_price_after >= 0),
  ADD COLUMN non_member_price_after   numeric(10,2) CHECK (non_member_price_after IS NULL OR non_member_price_after >= 0);

-- A new price needs a date to start on.
ALTER TABLE events ADD CONSTRAINT event_price_change_has_date
  CHECK (
    price_change_on IS NOT NULL
    OR (member_price_after IS NULL AND non_member_price_after IS NULL)
  );
