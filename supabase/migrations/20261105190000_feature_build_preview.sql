-- ============================================================
-- Feature builds: preview link and test steps on the request
-- ============================================================
--
-- So staff can test a Claude build from the Feature requests page without
-- going to GitHub: the Vercel preview URL (from GitHub's deployment_status
-- webhook) and the plain test steps Claude wrote (from the pull request).
--
-- Policy dependency audit (CLAUDE.md RLS rule 5): no policies change. The
-- existing "admin all" policy covers the new columns; the webhook writes
-- with the service role. No cycles.

ALTER TABLE capability_requests
  ADD COLUMN build_preview_url  text,
  ADD COLUMN build_test_steps   text;

NOTIFY pgrst, 'reload schema';
