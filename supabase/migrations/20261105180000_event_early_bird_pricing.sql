-- Date-based (early-bird) event pricing
--
-- Staff want a ticket price that changes on its own depending on when the
-- guest signs up ("$65 if they sign up before Nov 1, $85 after"). The
-- regular member_price / non_member_price stay as the "after" price; this
-- adds one optional early-bird tier on top:
--
--   early_bird_ends_at           the instant early-bird pricing stops
--                                (exclusive). Sign-ups before it get the
--                                early price; sign-ups from it onward get
--                                the regular price.
--   early_bird_member_price      early price for members (NULL = members
--                                pay their regular price throughout)
--   early_bird_non_member_price  early price for everyone else (NULL = same
--                                idea for non-members)
--
-- Which price applies is decided in one place in the app
-- (src/services/events/event-pricing.ts) and snapshotted into
-- event_registrations.price_quoted at sign-up, so a registration keeps the
-- price it was quoted after the cut-off passes.
--
-- No RLS changes: these are plain columns on `events`, covered by the
-- table's existing read/write policies.

ALTER TABLE events ADD COLUMN early_bird_ends_at timestamptz;

ALTER TABLE events ADD COLUMN early_bird_member_price numeric(10,2)
  CHECK (early_bird_member_price IS NULL OR early_bird_member_price >= 0);

ALTER TABLE events ADD COLUMN early_bird_non_member_price numeric(10,2)
  CHECK (early_bird_non_member_price IS NULL OR early_bird_non_member_price >= 0);

-- A cut-off with no early price, or an early price with no cut-off, is a
-- half-set tier: reject it rather than guess what staff meant.
ALTER TABLE events ADD CONSTRAINT event_early_bird_complete CHECK (
  (early_bird_ends_at IS NULL
     AND early_bird_member_price IS NULL
     AND early_bird_non_member_price IS NULL)
  OR
  (early_bird_ends_at IS NOT NULL
     AND (early_bird_member_price IS NOT NULL OR early_bird_non_member_price IS NOT NULL))
);
