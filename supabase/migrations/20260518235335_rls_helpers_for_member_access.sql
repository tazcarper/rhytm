-- Comprehensive RLS refactor: replace inline cross-table subqueries in
-- member-facing policies with SECURITY DEFINER helper functions.
--
-- WHY THIS REFACTOR EXISTS
-- ─────────────────────────────────────────────────────────────────
-- The original member-facing policies on `memberships`,
-- `membership_people`, `member_adventure_rsvps`, and `member_adventures`
-- all contained inline subqueries that traversed multiple tables —
-- typically `membership_people → people` or `membership_people →
-- memberships → people`.
--
-- This created an RLS-policy dependency graph with cycles:
--
--   memberships.member_read       → membership_people, people
--   membership_people.member_read → people
--   membership_people.staff_read  → memberships          (← closes cycle)
--   people.staff_read             → membership_people, memberships
--
-- PostgreSQL evaluates ALL applicable policies for a command as an OR.
-- Even when a particular user role would never trigger the cyclic
-- branch at runtime (e.g., a member-role user won't actually take the
-- `auth_role() = 'property_manager'` branch), the planner detects the
-- structural cycle and refuses with "infinite recursion detected in
-- policy for relation X."
--
-- THE FIX
-- ─────────────────────────────────────────────────────────────────
-- Move the cross-table traversal into SECURITY DEFINER functions.
-- Inside those functions, RLS is bypassed (functions are owned by
-- `postgres`, which is the table owner — table owners bypass RLS by
-- default; we have not applied FORCE ROW LEVEL SECURITY). The functions
-- are opaque to the planner, so the policy dependency graph no longer
-- shows the cross-table arrows that closed the cycles.
--
-- This is the canonical Supabase pattern for cross-table RLS — using
-- SECURITY DEFINER selector functions is documented as the preferred
-- approach precisely because inline policy joins both create recursion
-- risk AND scale poorly.
--
-- SECURITY MODEL
-- ─────────────────────────────────────────────────────────────────
-- Each function reads `auth.uid()` from the JWT and returns IDs for
-- ONLY that caller's row(s). A caller cannot pass an arbitrary user_id
-- to query someone else's data. The outer policy still enforces
-- `auth_role()`, so non-members can't reach these functions through the
-- member-facing policies.
--
-- All helpers are:
--   - SECURITY DEFINER (runs as function owner, bypasses RLS)
--   - STABLE          (consistent within a single statement)
--   - SET search_path = public  (defends against search_path attacks)

-- ============================================================
-- Helper functions
-- ============================================================

-- The `people.id` for the current authenticated user, or NULL if none.
-- The signed-in user can only ever map to one person row (people.user_id
-- is UNIQUE).
CREATE OR REPLACE FUNCTION current_person_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM people WHERE user_id = (SELECT auth.uid());
$$;

-- All membership_ids the current person is on with an ACTIVE junction
-- row, regardless of the membership's own status. Use for SELECT
-- policies where lapsed-membership history should remain visible to
-- the member.
CREATE OR REPLACE FUNCTION current_member_membership_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT mp.membership_id
  FROM membership_people mp
  WHERE mp.person_id = (SELECT current_person_id())
    AND mp.status = 'active';
$$;

-- Strictly active: junction `active` AND membership `active`. Use for
-- INSERT policies / new actions — can't take out new RSVPs etc. under
-- a lapsed or suspended membership.
CREATE OR REPLACE FUNCTION current_member_active_membership_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT mp.membership_id
  FROM membership_people mp
  JOIN memberships m ON m.id = mp.membership_id
  WHERE mp.person_id = (SELECT current_person_id())
    AND mp.status = 'active'
    AND m.status = 'active';
$$;

-- Distinct property_ids the current person has an active membership at.
-- For policies that scope by property (member_adventures visibility).
CREATE OR REPLACE FUNCTION current_member_active_property_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT m.property_id
  FROM membership_people mp
  JOIN memberships m ON m.id = mp.membership_id
  WHERE mp.person_id = (SELECT current_person_id())
    AND mp.status = 'active'
    AND m.status = 'active';
$$;

-- ============================================================
-- Replace member-facing policies
-- ============================================================

-- ---- memberships ----
DROP POLICY IF EXISTS "memberships: member read" ON memberships;

CREATE POLICY "memberships: member read"
  ON memberships FOR SELECT
  USING (
    auth_role() = 'member'
    AND id IN (SELECT current_member_membership_ids())
  );

-- ---- membership_people ----
-- Restored "see junction rows for memberships you're on" semantics —
-- the previous fix had narrowed this to "own person_id only" because
-- the broader version was recursive. With the helper function, the
-- household-visibility behavior comes back: Sarah sees John's spouse
-- row on their shared membership, and vice versa.
DROP POLICY IF EXISTS "membership_people: member read own" ON membership_people;
DROP POLICY IF EXISTS "membership_people: member read same membership" ON membership_people;

CREATE POLICY "membership_people: member read same membership"
  ON membership_people FOR SELECT
  USING (
    auth_role() = 'member'
    AND membership_id IN (SELECT current_member_membership_ids())
  );

-- ---- member_adventure_rsvps ----
DROP POLICY IF EXISTS "rsvps: member read own" ON member_adventure_rsvps;
DROP POLICY IF EXISTS "rsvps: member insert own" ON member_adventure_rsvps;

CREATE POLICY "rsvps: member read own"
  ON member_adventure_rsvps FOR SELECT
  USING (
    auth_role() = 'member'
    AND membership_id IN (SELECT current_member_membership_ids())
  );

CREATE POLICY "rsvps: member insert own"
  ON member_adventure_rsvps FOR INSERT
  WITH CHECK (
    auth_role() = 'member'
    AND membership_id IN (SELECT current_member_active_membership_ids())
  );

-- ---- member_adventures ----
DROP POLICY IF EXISTS "adventures: member read published" ON member_adventures;

CREATE POLICY "adventures: member read published"
  ON member_adventures FOR SELECT
  USING (
    auth_role() = 'member'
    AND status IN ('published', 'sold_out')
    AND property_id IN (SELECT current_member_active_property_ids())
  );

-- ============================================================
-- Note: STAFF policies (property_manager, membership_coordinator,
-- admin) that contain inline cross-table subqueries are KEPT AS-IS.
-- After the changes above, the dependency graph no longer cycles:
--   - memberships.member_read → opaque function (no chain visible)
--   - membership_people.* staff policies → memberships (no back-arrow)
--   - people.staff policies → already use staff_visible_person_ids()
-- Staff policies traverse one direction only, so their inline EXISTS
-- subqueries stay readable and audit-friendly.
-- ============================================================
