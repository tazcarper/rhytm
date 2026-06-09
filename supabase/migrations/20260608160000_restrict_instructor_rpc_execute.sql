-- Lock down the admin-only instructor RPCs to service_role (review fix).
--
-- save_instructor_profile (20260608140000) and save_instructor_schedule
-- (20260608150000) each did `REVOKE ALL ... FROM public; GRANT EXECUTE TO
-- service_role`, intending "service_role only". But Supabase ships an
-- ALTER DEFAULT PRIVILEGES that GRANTs EXECUTE on every new public function to
-- anon AND authenticated *explicitly* at CREATE time — and `REVOKE ... FROM
-- public` does not remove an explicit per-role grant. So both functions were
-- left executable by anon + authenticated (confirmed via pg_proc.proacl).
--
-- Both are SECURITY INVOKER and every write inside is RLS-guarded, so this was a
-- defense-in-depth gap, not an exploitable hole today. But these are admin-only
-- operations — called solely by the service-role admin actions after
-- requireInstructorManager authorizes — and an explicit anon/authenticated
-- grant would become a real privilege-escalation hole if either function were
-- ever switched to SECURITY DEFINER. Revoke the explicit grants; service_role
-- keeps its own EXECUTE.

REVOKE EXECUTE ON FUNCTION save_instructor_profile(
  uuid, text, text, text, boolean, integer, uuid[], uuid[]
) FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION save_instructor_schedule(uuid, jsonb)
  FROM anon, authenticated;
