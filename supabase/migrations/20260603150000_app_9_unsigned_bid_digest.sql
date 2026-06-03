-- App 9 W2 — consolidated unsigned-bid staff digest.
--
-- A daily digest emails each property's staff inbox the bids that have been
-- confirmed for 48h+ but still aren't signed, so staff can follow up. (Per
-- the 2026-06-01 no-auto-cancel decision we nudge rather than auto-expire —
-- see [[bid-no-auto-cancel]].) Two schema needs:
--
--   1. bids.confirmed_at — the clock the 48h threshold measures from. There
--      was no confirmation timestamp before this; status flips to 'confirmed'
--      but only `expires_at` (now()+7d) recorded the moment. confirmBid now
--      stamps confirmed_at directly; we backfill existing rows from
--      expires_at - 7d.
--   2. reminder_settings knobs — config-in-DB so the threshold + on/off are
--      tunable without a deploy.

-- ---- bids.confirmed_at ----

ALTER TABLE bids ADD COLUMN confirmed_at timestamptz;

COMMENT ON COLUMN bids.confirmed_at IS
  'When the bid was confirmed (pending_review → confirmed). Drives the W2 unsigned-bid staff digest threshold. Stamped by confirmBid; null for bids never confirmed.';

-- Backfill: expires_at was stamped to now()+7d at confirmation, so it dates
-- the confirmation for any bid that ever reached confirmed (or beyond).
UPDATE bids
  SET confirmed_at = expires_at - interval '7 days'
  WHERE confirmed_at IS NULL AND expires_at IS NOT NULL;

-- Partial index for the digest scan (confirmed + unsigned only).
CREATE INDEX idx_bids_unsigned_confirmed
  ON bids (confirmed_at)
  WHERE status = 'confirmed';

-- ---- reminder_settings digest knobs ----

ALTER TABLE reminder_settings
  ADD COLUMN unsigned_digest_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN unsigned_digest_hours   integer NOT NULL DEFAULT 48
    CHECK (unsigned_digest_hours > 0);
