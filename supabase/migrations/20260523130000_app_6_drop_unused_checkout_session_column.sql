-- App 6: drop the unused bookings.deposit_checkout_session_id column.
--
-- Added in `20260523120100_app_6_deposit_columns_and_trigger.sql` under
-- the assumption that the Stripe integration would use a Checkout
-- Session with ui_mode='custom'. After planning review we pivoted to
-- Pattern A — `paymentIntents.create()` + `<PaymentElement>` — which
-- reuses the existing `bookings.deposit_payment_intent_id` column
-- already added in Phase 2. The session column never carried production
-- data; a clean drop is safe.
--
-- Phase 7-style rationale: the React Stripe library has first-class
-- bindings for PaymentIntent + PaymentElement but no bindings for
-- ui_mode='custom' (which expects an imperative `stripe.initCheckout()`
-- call). For this single-payment, custom-styled DepositSlot, Pattern A
-- is the cheaper, more idiomatic fit.

DROP INDEX IF EXISTS idx_bookings_deposit_session;

ALTER TABLE bookings DROP COLUMN IF EXISTS deposit_checkout_session_id;
