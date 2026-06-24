-- Fix: confirming an estimate bid failed with
--   "sync_booking_from_bid: bid % moved to confirmed but its booking % was
--    not in the expected source state"
--
-- Cause: sync_booking_from_bid() (the bid→booking lifecycle mirror) assumed a
-- bid reaches 'confirmed' only from the /book direct-confirm path, where the
-- booking is still 'pending_review'. The /request-estimate flow (plan §7)
-- LOCKS the slot first — lock_booking_slot() advances the booking
-- pending_review → awaiting_guest — and only then confirms the bid. By the time
-- this trigger fires, the booking is already 'awaiting_guest', so the
-- WHERE … status = 'pending_review' update matched 0 rows and the function
-- raised.
--
-- Fix: the 'confirmed' branch now accepts EITHER source state and lands the
-- booking at 'awaiting_guest' idempotently:
--   - pending_review  (/book direct confirm)            → advances it
--   - awaiting_guest  (/request-estimate lock-then-confirm) → no-op, still matches
-- Every other branch is unchanged from the prior definition.

CREATE OR REPLACE FUNCTION public.sync_booking_from_bid()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_rows int;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'confirmed' THEN
      -- Accept both confirm paths (see migration header). pending_review is the
      -- /book direct confirm; awaiting_guest is the estimate lock-then-confirm,
      -- where lock_booking_slot already advanced the booking.
      UPDATE bookings
      SET status = 'awaiting_guest', updated_at = now()
      WHERE id = NEW.booking_id AND status IN ('pending_review', 'awaiting_guest');

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
      -- releases (Phase 2's capacity trigger will then permit re-booking
      -- of the time. Refund of a fulfilled booking is blocked here —
      -- post-event financial adjustment is a Stripe-dashboard task, not
      -- a booking-lifecycle event.
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
$function$;
