-- App 4 — member-editable display name
--
-- Adds people.display_name: an APP-ONLY display override the member sets
-- on /member/profile. It is how this application addresses the person in
-- the top bar, the member identity strip, and on their bookings. It does
-- NOT touch the Supabase Auth identity (e.g. a Google-provided name) —
-- that stays exactly as the auth provider supplied it. Reads prefer
-- display_name, then first_name, then the email local-part.

ALTER TABLE people ADD COLUMN IF NOT EXISTS display_name text;

-- Members have no UPDATE policy on people (only "people: admin write").
-- Rather than open a broad row UPDATE — which would also let the client
-- edit first_name / last_name — expose a NARROW SECURITY DEFINER setter
-- that writes ONLY display_name on the caller's own row.
--
-- Why SECURITY DEFINER + auth.uid() rather than an RLS UPDATE policy:
--   * RLS cannot restrict which columns an UPDATE touches; a column-
--     scoped function can.
--   * The function is opaque to the planner and references a single
--     table, so it introduces no policy dependency cycle (RLS rule #2).
--   * SET search_path = public per RLS rule #4. It bypasses RLS by
--     design but scopes every write to (SELECT auth.uid()), so a member
--     can only ever edit their own row.
CREATE OR REPLACE FUNCTION public.set_my_display_name(new_display_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Empty / whitespace clears the override (reads fall back to first_name).
  trimmed text := nullif(btrim(new_display_name), '');
BEGIN
  IF trimmed IS NOT NULL AND length(trimmed) > 80 THEN
    RAISE EXCEPTION 'display_name must be 80 characters or fewer';
  END IF;

  UPDATE people
     SET display_name = trimmed
   WHERE user_id = (SELECT auth.uid());
END;
$$;

-- Anon cannot call it; authenticated callers can, but the function
-- scopes the write to their own row.
REVOKE ALL ON FUNCTION public.set_my_display_name(text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_my_display_name(text) TO authenticated;
