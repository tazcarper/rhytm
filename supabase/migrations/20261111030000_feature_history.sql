-- ============================================================
-- Feature history: "Add more" and "Undo this feature"
-- ============================================================
--
-- A published feature can be extended later ("Add more") or taken off the
-- site ("Undo this feature"), each through its own Claude build. The
-- build_* columns only describe the latest build, so these record the
-- rest (Taz, 2026-11-10):
--
--   published_builds   every pull request that went live for this
--                      feature, oldest first: [{ prNumber, prUrl,
--                      issueNumber, mergedAt, kind }]. Undo reverts all
--                      of them.
--   build_kind         what the current build is: the first build, an
--                      add-more, or an undo.
--   more_requested_at  staff asked to add more and it isn't live yet. The
--                      feature shows under Active again but stays Built,
--                      so events using it aren't held up.
--   removed_at         an undo went live; the feature is off the site.
--
-- Additive only. Policy dependency audit (CLAUDE.md RLS rule 5): no
-- policies change; the existing "admin all" policy covers the new
-- columns and the webhook writes with the service role.

ALTER TABLE capability_requests
  ADD COLUMN IF NOT EXISTS published_builds  jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS build_kind        text NOT NULL DEFAULT 'build'
    CHECK (build_kind IN ('build', 'add_more', 'undo')),
  ADD COLUMN IF NOT EXISTS more_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_at        timestamptz;

NOTIFY pgrst, 'reload schema';
