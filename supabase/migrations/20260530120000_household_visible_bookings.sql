-- App 4, sub-phase 4.1 — Household-visible bookings.
--
-- Lets a member see every booking made by anyone on a membership they
-- share. Mirrors the household pattern already in place on `people`
-- (see 20260519015647_household_visibility_on_people.sql).
--
-- Approach: a new SECURITY DEFINER helper resolves the household's
-- auth user_ids, and the bookings member-read policy is rewritten to
-- key on that helper instead of `auth.uid()`.
--
-- Scope intentionally narrow: this migration only touches `bookings`.
-- `booking_disciplines`, `booking_add_ons`, and `bids` keep their
-- `member_user_id = auth.uid()` policies. The /member/bookings v1 card
-- only reads columns on `bookings` itself plus joins to `properties`
-- and `instructors` (both already readable). The "view bid" link is
-- hidden in the UI for non-mine rows, so the spouse not reading the
-- other spouse's `bids` row is by design — bid signing + access codes
-- stay scoped to the original booker.
--
-- RLS cycle audit:
--   - current_household_user_ids() reads `people` and calls
--     current_household_person_ids().
--   - current_household_person_ids() reads `membership_people` and
--     `memberships`.
--   - None of `people`, `membership_people`, or `memberships` policies
--     reference `bookings`.
--   - The new bookings policy calls a SECURITY DEFINER helper —
--     opaque to the planner; no dependency arrow added.
--   → No cycle.

-- ============================================================
-- Step 1 — Helper: current_household_user_ids()
-- ============================================================
--
-- Returns the distinct auth.users.id of every person in the caller's
-- household (everyone on a membership the caller shares, plus the
-- caller themselves — current_household_person_ids() already includes
-- the caller). Filters out people whose `people.user_id` is NULL
-- (invited-but-not-yet-linked household members can't have bookings
-- attributed to them, so excluding them is correct).
--
-- Security:
--   - Reads identity through current_household_person_ids() which
--     in turn reads current_person_id() — caller can't pass another
--     user's id.
--   - SECURITY DEFINER + STABLE + SET search_path = public — matches
--     the convention used by every other member-access selector
--     (see plan/supabase/phase-7-rls.md §4.2).
--   - Outer policy still requires `auth_role() = 'member'`.

CREATE OR REPLACE FUNCTION current_household_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT p.user_id
  FROM people p
  WHERE p.id IN (SELECT current_household_person_ids())
    AND p.user_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION current_household_user_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_household_user_ids() TO authenticated;

COMMENT ON FUNCTION current_household_user_ids() IS
  'Household auth user_ids for the current member. Used by the bookings '
  'member-read RLS policy to extend visibility from the booker alone to '
  'every spouse/primary/dependent on a shared membership. Owned by postgres, '
  'so reads bypass RLS — see CLAUDE.md "RLS Rules" rule 4.';

-- ============================================================
-- Step 2 — Replace bookings: member read own → household read
-- ============================================================

DROP POLICY IF EXISTS "bookings: member read own" ON bookings;

CREATE POLICY "bookings: member household read"
  ON bookings FOR SELECT
  USING (
    auth_role() = 'member'
    AND member_user_id IN (SELECT current_household_user_ids())
  );
