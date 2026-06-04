-- =============================================================
-- Adventures full-payment checkout (Q14 = full payment at RSVP).
--
-- Adds a `pending_payment` RSVP state for the hold-then-pay model: a
-- member's reservation holds a capacity slot the moment checkout starts
-- (status='pending_payment'), the Stripe PaymentIntent is collected, and
-- the webhook flips it to 'confirmed'. Abandoned holds are released by a
-- scheduled sweep.
--
-- This enum value MUST be added in its own migration (committed) before
-- the triggers/queries that reference it run — Postgres forbids using a
-- new enum value in the same transaction that added it.
-- =============================================================

ALTER TYPE rsvp_status_enum ADD VALUE IF NOT EXISTS 'pending_payment';
