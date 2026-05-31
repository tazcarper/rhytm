-- Phase 1 of the "include bid URL in admin-confirmation email" change.
--
-- Goal: make the bid URL recoverable server-side after creation so
-- admin-triggered emails (App 9 bid-confirmed-ready, future App 8
-- deposit follow-ups) can link the guest back to their bid page
-- without forcing them to scroll back to the original
-- "we're preparing your bid" email.
--
-- The bid URL is `/bids/<slug>/<code>`. The DB has always stored only
-- `access_code_hash = bcrypt(code)`; the plaintext was discarded after
-- the create request returned. Bcrypt is one-way, so plaintext was
-- unrecoverable. This migration adds `access_code_plaintext` so the
-- code is stored alongside the hash. Subsequent migrations in this
-- phase update the two write paths (create_public_booking,
-- regenerate_bid_access_code) to populate it.
--
-- Security analysis — why no extra grants are needed:
--
--   - Anon role: bids has NO SELECT policy granting anon access (see
--     phase_3_bids.sql). The only anon read path is the SECURITY DEFINER
--     `validate_bid_access_code(slug, code)` function. The caller of
--     that function ALREADY KNOWS `code` (they passed it in), so any
--     value of `access_code_plaintext` returned in the row is a no-op
--     information disclosure.
--   - Authenticated members/partners: RLS restricts them to their own
--     bid rows. Reading the plaintext of THEIR OWN bid is harmless —
--     they already have the URL.
--   - Authenticated staff (admin/property_manager): full read per
--     existing policies. They already have admin tooling for the URL.
--
-- Therefore: no column-level REVOKE, no view layer. If a future RLS
-- change adds anon read access to bids, revisit this assumption.
--
-- Existing rows: plaintext is NULL. The Inngest handler that consumes
-- this column treats NULL as "no URL available" and falls back to the
-- existing "use your original email" copy.

ALTER TABLE bids
  ADD COLUMN access_code_plaintext text;

COMMENT ON COLUMN bids.access_code_plaintext IS
  'Plaintext access code captured at create/regenerate time so server-side '
  'admin flows (confirmation email, etc.) can rebuild the bid URL. '
  'Validation still goes through access_code_hash (bcrypt). Confidentiality '
  'relies on the bids table''s existing row-level policies — see '
  '20260530170000_add_access_code_plaintext_to_bids.sql for the analysis.';
