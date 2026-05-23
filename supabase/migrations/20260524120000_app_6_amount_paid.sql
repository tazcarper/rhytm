-- App 6 (Path A): track the actual amount the customer paid.
--
-- Phase 2's `bookings.deposit_amount` is the *minimum* the customer
-- must pay to confirm the booking. With Path A, the customer can pay
-- any amount in `[deposit_amount, confirmed_price]` — the deposit is
-- the floor, the quote is the ceiling, the leftover settles offline
-- at the property.
--
-- `amount_paid` is the source-of-truth for "what did they actually
-- pay." Written by the Stripe webhook handler on
-- `payment_intent.succeeded` (and re-written if a fresh PI is created
-- after amount-drift). Defaults to 0 so the column is non-NULL and
-- math + display code don't need NULL guards.
--
-- Backfill: existing paid bookings (Phase 2 + 6.1-6.6 fixed-deposit
-- world) had no flexibility — they paid exactly `deposit_amount`. We
-- backfill from `deposit_amount` for any booking with a Stripe PI
-- already recorded.

ALTER TABLE bookings
  ADD COLUMN amount_paid numeric(10,2) NOT NULL DEFAULT 0;

UPDATE bookings
SET amount_paid = deposit_amount
WHERE deposit_payment_intent_id IS NOT NULL
  AND deposit_amount IS NOT NULL;

COMMENT ON COLUMN bookings.amount_paid IS
  'Actual amount paid by the customer via Stripe. May be between '
  'deposit_amount (the required minimum) and confirmed_price (the '
  'quoted full amount). The difference settles offline at the '
  'property. Written by the App 6 webhook handler.';
