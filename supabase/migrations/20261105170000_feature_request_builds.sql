-- ============================================================
-- "Build it": Claude builds a feature request on a branch
-- ============================================================
--
-- The admin presses Build it on a feature request. The app opens a GitHub
-- issue for it, the Claude GitHub Action builds the feature and a pull
-- request opens (with a Vercel preview). A GitHub webhook then moves the
-- request along: PR opened → Planned, PR merged → Built.
--
-- These columns record the issue and pull request for each request, so the
-- Feature requests page can link to them and the webhook can find the
-- request from the issue number.
--
-- Run after 20261104193000 and 20261105150000.
--
-- Policy dependency audit (CLAUDE.md RLS rule 5): no policies change. The
-- existing "admin all" policy covers the new columns; the webhook writes
-- with the service role. No cycles.

ALTER TABLE capability_requests
  ADD COLUMN build_issue_number  integer,
  ADD COLUMN build_issue_url     text,
  ADD COLUMN build_requested_at  timestamptz,
  ADD COLUMN build_pr_number     integer,
  ADD COLUMN build_pr_url        text,
  ADD COLUMN build_pr_state      text
    CHECK (build_pr_state IS NULL OR build_pr_state IN ('open', 'merged', 'closed'));

CREATE UNIQUE INDEX idx_capability_requests_build_issue
  ON capability_requests (build_issue_number)
  WHERE build_issue_number IS NOT NULL;

-- So PostgREST sees the new columns straight away.
NOTIFY pgrst, 'reload schema';
