-- =============================================================
-- Per-adventure payment mode + the inquire "requested" RSVP state.
--
-- payment_mode drives the public reserve flow:
--   instant  — full payment at RSVP (current behavior)
--   deposit  — pay deposit_amount now; balance settled with the concierge
--   inquire  — "request to reserve"; concierge follows up (no online payment)
--
-- `requested` is the inquire lead state. The capacity triggers count only
-- confirmed + pending_payment, so a `requested` RSVP correctly does NOT
-- hold a slot — staff confirm availability with the outfitter, then
-- convert it to a paid/confirmed hold.
-- =============================================================

ALTER TYPE rsvp_status_enum ADD VALUE IF NOT EXISTS 'requested';

ALTER TABLE member_adventures
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'instant';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'member_adventures_payment_mode_check'
  ) THEN
    ALTER TABLE member_adventures
      ADD CONSTRAINT member_adventures_payment_mode_check
      CHECK (payment_mode IN ('instant', 'deposit', 'inquire'));
  END IF;
END $$;

-- Placeholder demo spread so each bookable mode is exercisable:
--   Argentina Dove → instant (default)   Texas Quail → deposit
--   Founders' Retreat → inquire (invitation-only).
UPDATE member_adventures SET payment_mode = 'deposit', deposit_amount = 1000.00
  WHERE title = 'Texas Hill Country Quail · January' AND details->>'placeholder' = 'true';
UPDATE member_adventures SET payment_mode = 'inquire'
  WHERE title = 'Founders'' Retreat · Pedernales' AND details->>'placeholder' = 'true';
