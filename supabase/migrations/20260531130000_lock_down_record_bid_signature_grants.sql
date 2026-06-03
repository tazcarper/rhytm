-- ============================================================
-- App 7 (homegrown waiver) — security fix: lock down record_bid_signature
-- ============================================================
-- The prior migration (20260531120000) did:
--   REVOKE ALL ON FUNCTION record_bid_signature(...) FROM PUBLIC;
--   GRANT EXECUTE ... TO service_role;
-- intending service-role-only execution. A live RLS test (project RLS
-- rule #6) proved the `anon` role could STILL execute the function: it
-- returned the function's own "bid not found" RAISE rather than a
-- permission error.
--
-- WHY: Supabase's default privileges grant EXECUTE on new public-schema
-- functions DIRECTLY to `anon` and `authenticated` — those grants are not
-- part of PUBLIC, so REVOKE ... FROM PUBLIC left them intact.
--
-- IMPACT: record_bid_signature is SECURITY DEFINER and trusts its caller
-- (the signing Server Action validates the bid access code BEFORE calling
-- it). Direct anon access would bypass that gate, allowing a forged
-- signature on a known bid id. This revoke closes that path.
--
-- This also makes a from-scratch migration replay correct, since it runs
-- after the original.

REVOKE ALL ON FUNCTION record_bid_signature(
  uuid, uuid, text, text, text, text, inet, text, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION record_bid_signature(
  uuid, uuid, text, text, text, text, inet, text, uuid
) TO service_role;
