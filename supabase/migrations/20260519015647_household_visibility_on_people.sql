-- Household visibility — let a member read the `people` rows of other
-- humans who share an active membership with them. Implements the
-- "who else is on my membership?" UX (spouse seeing primary, primary
-- seeing dependents, etc.).
--
-- Follows the SECURITY DEFINER selector pattern (see CLAUDE.md "RLS
-- Rules" + agents/supabase_auth_rls_agent.md) so the cross-table
-- traversal doesn't reintroduce a policy cycle. The chain
-- people → membership_people → memberships could close back onto
-- people if any membership-side policy traversed people directly;
-- moving the lookup into a SECURITY DEFINER function makes it opaque
-- to the planner.
--
-- Security:
--   - Function reads `current_person_id()` (own JWT) — caller can't
--     pass another user's id.
--   - Filters by `mp.status = 'active'` on BOTH sides of the join, so
--     ex-spouses (junction set to 'inactive') don't reveal each
--     other's `people` rows.
--   - Outer policy still requires `auth_role() = 'member'`.

CREATE OR REPLACE FUNCTION current_household_person_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Distinct person_ids on any membership where the current person
  -- has an active junction. Includes the current person themselves
  -- (harmless — already covered by `people: self read`, OR'd).
  SELECT DISTINCT mp.person_id
  FROM membership_people mp
  WHERE mp.status = 'active'
    AND mp.membership_id IN (
      SELECT mp2.membership_id
      FROM membership_people mp2
      WHERE mp2.person_id = (SELECT current_person_id())
        AND mp2.status = 'active'
    );
$$;

CREATE POLICY "people: member read household"
  ON people FOR SELECT
  USING (
    auth_role() = 'member'
    AND id IN (SELECT current_household_person_ids())
  );
