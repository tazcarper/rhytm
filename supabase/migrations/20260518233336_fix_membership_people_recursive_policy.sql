-- Fix infinite-recursion in the member SELECT policy on
-- membership_people.
--
-- Symptom: querying memberships → joining membership_people →
-- "infinite recursion detected in policy for relation memberships".
--
-- Cause: the original policy on membership_people said "you can read
-- this row if its membership_id is in the set of memberships you're
-- on" — but computing "memberships you're on" required SELECTing from
-- membership_people again, which fired the same policy recursively.
-- Postgres detects the loop and aborts.
--
-- Fix: key the policy on `person_id` directly via the `people` table.
-- A member can read junction rows where their own person row is the
-- target. `people` has a self-read policy that doesn't subquery any
-- other table, so the chain terminates: memberships → membership_people
-- (queries people) → people (no subquery).
--
-- Trade-off: the new policy does NOT let a spouse see their partner's
-- junction row on the same shared membership. The /member portal only
-- needs each person's own junction rows, so this is sufficient. A
-- future "who else is on this membership" feature would need a
-- SECURITY DEFINER function or a different policy approach.

DROP POLICY IF EXISTS "membership_people: member read same membership"
  ON membership_people;

CREATE POLICY "membership_people: member read own"
  ON membership_people FOR SELECT
  USING (
    auth_role() = 'member'
    AND person_id IN (
      SELECT id FROM people WHERE user_id = (SELECT auth.uid())
    )
  );
