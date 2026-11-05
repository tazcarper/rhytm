-- ============================================================
-- Feature requests: "Report a problem" fixes
-- ============================================================
--
-- Staff can report that a feature already live on the site is broken. The
-- report is stored as a capability request that points at the request it
-- fixes, and goes through the same Build it → test site → Approve flow.
-- fixes_request_id is null for ordinary feature requests, and also for a
-- report where staff weren't sure which feature it was.
--
-- is_fix marks a report even when fixes_request_id is null.
--
-- Policy dependency audit (CLAUDE.md RLS rule 5): no policies change. The
-- existing "admin all" policy covers the new columns, and the new
-- reference points at the same table. open_capability_requests keeps its
-- SECURITY DEFINER shape and grants (CREATE OR REPLACE keeps them). No cycles.

ALTER TABLE capability_requests
  ADD COLUMN is_fix boolean NOT NULL DEFAULT false,
  ADD COLUMN fixes_request_id uuid REFERENCES capability_requests(id) ON DELETE SET NULL;

CREATE INDEX idx_capability_requests_fixes ON capability_requests (fixes_request_id);

-- Same as 20261105150000, minus problem reports: the helper matches new
-- asks against open feature requests, and a fix isn't one.
CREATE OR REPLACE FUNCTION open_capability_requests()
RETURNS TABLE (id uuid, summary text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT request.id, request.summary
  FROM capability_requests request
  WHERE (SELECT auth_role()) IN ('super_admin', 'admin', 'property_manager')
    AND request.duplicate_of IS NULL
    AND NOT request.is_fix
    AND request.status IN ('new', 'reviewing', 'planned')
  ORDER BY request.created_at DESC
  LIMIT 50;
$$;

NOTIFY pgrst, 'reload schema';
