-- Break the people ↔ memberships RLS cycle.
--
-- After the split, the staff-scoped read policies on `people`
-- (property_manager + membership_coordinator) traversed through
-- membership_people → memberships → property_id. Independently the
-- member-scoped policy on `memberships` traversed people via the
-- junction. Postgres detects the structural cycle at plan time and
-- fails any query that touches both with "infinite recursion detected
-- in policy for relation memberships" — even when the user's role
-- means the recursive branch would never be taken at runtime.
--
-- Fix: replace the recursive subquery on `people` with a SECURITY
-- DEFINER helper function. The function runs as its owner (postgres),
-- which is the table owner, so RLS doesn't apply to queries inside
-- the function (the standard table-owner bypass — we have NOT applied
-- FORCE ROW LEVEL SECURITY to these tables). The traversal happens
-- once inside the function, returns a set of person_ids, and the
-- outer policy gates access via `auth_role()` + IN check. Chain
-- terminates inside the function instead of re-entering memberships
-- RLS, so the planner sees no cycle.
--
-- Security: the function reads `auth_property_id()` from the caller's
-- JWT, so a property_manager only ever gets people from their own
-- property. The outer policy enforces `auth_role()`, so non-staff
-- can't call into this path at all.

CREATE OR REPLACE FUNCTION staff_visible_person_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT mp.person_id
  FROM membership_people mp
  JOIN memberships m ON m.id = mp.membership_id
  WHERE mp.status = 'active'
    AND m.property_id = auth_property_id();
$$;

-- Replace the recursive staff policies.
DROP POLICY IF EXISTS "people: property_manager read" ON people;
DROP POLICY IF EXISTS "people: membership_coordinator read" ON people;

CREATE POLICY "people: property_manager read"
  ON people FOR SELECT
  USING (
    auth_role() = 'property_manager'
    AND id IN (SELECT staff_visible_person_ids())
  );

CREATE POLICY "people: membership_coordinator read"
  ON people FOR SELECT
  USING (
    auth_role() = 'membership_coordinator'
    AND id IN (SELECT staff_visible_person_ids())
  );
