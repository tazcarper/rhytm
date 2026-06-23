-- ============================================================
-- Staff-facing notes on bookings (Phase C of the request-estimate →
-- bid integration; see plan/request-estimate-bid-integration.md §7/§8).
--
-- The /request-estimate front door captures context that is for STAFF,
-- not the guest: host intent + "verify membership" (membership is taken
-- on trust, §3.5), the non-pricing advisory flags (RSO ratio, instructor
-- escalation, 9+ Private Event / 72-hr notice, summer heat — §8), the
-- backup date, and staff phone-intake notes. None of this can live in
-- guest_notes, which is rendered to the guest on the public bid page
-- (bids/[slug]/[code]/page.tsx). Phase B deferred these for lack of a
-- channel; this migration adds it.
--
--   staff_notes    — host intent, verify-membership, advisories, internal
--                    phone-intake notes. Staff-only.
--   schedule_notes — scheduling context for the slot-lock action (§7):
--                    backup date, the provisional-slot reminder.
--
-- Both are plain nullable text, populated by the submit action right after
-- create_public_booking (stamped like created_by_admin_id — the RPC
-- signature is unchanged, plan §6 hard constraint).
--
-- RLS: no new policy. bookings already has its row policies; these are
-- just two more columns under them (no policy references another table, so
-- no dependency cycle — CLAUDE.md rule 5 satisfied trivially). They are
-- STAFF-ONLY by omission: the public bid read (get-bid.ts) column-projects
-- to a customer-safe allowlist and does NOT select these, so they never
-- reach the guest. Do not add them to that allowlist.
-- ============================================================

ALTER TABLE bookings
  ADD COLUMN staff_notes    text,
  ADD COLUMN schedule_notes text;

COMMENT ON COLUMN bookings.staff_notes IS
  'Staff-only intake context (host intent, verify-membership, non-pricing advisories, phone-intake notes). Never shown to the guest — excluded from the get-bid customer-safe projection.';
COMMENT ON COLUMN bookings.schedule_notes IS
  'Staff-only scheduling context for the slot-lock action (backup date, provisional-slot reminder). Never shown to the guest.';
