-- App 6: deposit collection — columns + trigger relaxation.
--
-- Pairs with `20260523120000_app_6_bid_enum_refunded.sql`, which must
-- run first so 'refunded' is a valid `bid_status_enum` value by the
-- time this file references it.
--
-- Three changes:
--   1. `bids.paid_at` — stable lifecycle timestamp parallel to
--      `signed_at` / `cancelled_at`. Stamped by the Stripe webhook
--      handler on `checkout.session.completed`.
--   2. `bookings.deposit_checkout_session_id` — idempotency anchor for
--      the Checkout Session (ui_mode='custom'). Distinct from
--      `deposit_payment_intent_id`, which is the post-success PI ID set
--      from `session.payment_intent` by the webhook. Two clean anchors
--      avoid overloading one column with two semantically different
--      Stripe object IDs (`cs_…` vs `pi_…`).
--   3. `sync_booking_from_bid` recreated:
--      - 'paid' now permitted from booking 'awaiting_guest' OR 'signed'
--        (App 6 relaxation — deposit can clear before signature).
--      - 'refunded' arm added — admin Refund flips the bid to refunded;
--        booking goes to 'cancelled' from 'deposit_paid'. Refund of a
--        fulfilled booking is intentionally blocked (no source-state
--        match → trigger raises). Treat post-event refunds as a manual
--        Stripe dashboard action for now.

-- ============================================================
-- bids.paid_at
-- ============================================================

ALTER TABLE bids ADD COLUMN paid_at timestamptz;

-- ============================================================
-- bookings.deposit_checkout_session_id
-- ============================================================

ALTER TABLE bookings ADD COLUMN deposit_checkout_session_id text;

-- UNIQUE partial index — matches the existing idx_bookings_deposit_intent
-- pattern (Phase 2). Prevents two bookings from claiming the same Stripe
-- Checkout Session, which would only happen via a Server Action race.
CREATE UNIQUE INDEX idx_bookings_deposit_session
  ON bookings (deposit_checkout_session_id)
  WHERE deposit_checkout_session_id IS NOT NULL;

-- ============================================================
-- sync_booking_from_bid — recreated
-- ============================================================
-- Recreated in full rather than patched: the RAISE EXCEPTION at the
-- bottom depends on the row-count after the CASE'd UPDATE, and clarity
-- beats a series of ALTER FUNCTION-style surgical edits.

CREATE OR REPLACE FUNCTION sync_booking_from_bid()
RETURNS TRIGGER AS $$
DECLARE
  v_rows int;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'confirmed' THEN
      UPDATE bookings
      SET status = 'awaiting_guest', updated_at = now()
      WHERE id = NEW.booking_id AND status = 'pending_review';

    WHEN 'denied' THEN
      UPDATE bookings
      SET status = 'denied', updated_at = now()
      WHERE id = NEW.booking_id AND status = 'pending_review';

    WHEN 'signed' THEN
      UPDATE bookings
      SET status = 'signed', updated_at = now()
      WHERE id = NEW.booking_id AND status = 'awaiting_guest';

    WHEN 'paid' THEN
      -- App 6 relaxation: deposit can clear before signature. Either
      -- ordering — sign-then-pay or pay-then-sign — reaches deposit_paid.
      UPDATE bookings
      SET status = 'deposit_paid', updated_at = now()
      WHERE id = NEW.booking_id AND status IN ('awaiting_guest', 'signed');

    WHEN 'refunded' THEN
      -- App 6: admin Refund flow. Booking moves to cancelled; the slot
      -- releases so Phase 2's capacity trigger permits re-booking the
      -- time. Refund of a fulfilled booking is blocked here — post-event
      -- financial adjustment is a Stripe-dashboard task, not a
      -- booking-lifecycle event.
      UPDATE bookings
      SET status = 'cancelled', updated_at = now()
      WHERE id = NEW.booking_id AND status = 'deposit_paid';

    WHEN 'expired' THEN
      UPDATE bookings
      SET status = 'expired', updated_at = now()
      WHERE id = NEW.booking_id AND status IN ('awaiting_guest', 'signed');

    ELSE
      RETURN NEW;  -- pending_review on UPDATE — no sync defined
  END CASE;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION
      'sync_booking_from_bid: bid % moved to % but its booking % was not in the expected source state',
      NEW.id, NEW.status, NEW.booking_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
