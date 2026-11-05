-- ============================================================
-- One feature request per feature, however many events ask for it
-- ============================================================
--
-- When the AI helper is asked for something already on the developer's
-- list, it files the new ask as a duplicate of the open request instead of
-- a second request. A duplicate keeps the staff member's own words and its
-- drafts, but its status follows the original: marking the original Built
-- unlocks every draft waiting on it. Admins can also mark a request as the
-- same as another from the Feature requests page.
--
-- Also: link_capability_requests_to_events now fills in a request's club
-- from the draft it's linked to, when the helper didn't know it yet.
--
-- Policy dependency audit (CLAUDE.md RLS rule 5): no policies change. The
-- functions are SECURITY DEFINER (opaque to the planner). No cycles.

ALTER TABLE capability_requests
  ADD COLUMN duplicate_of uuid REFERENCES capability_requests(id) ON DELETE SET NULL,
  ADD CONSTRAINT capability_request_not_own_duplicate CHECK (duplicate_of IS NULL OR duplicate_of <> id);

CREATE INDEX idx_capability_requests_duplicate_of ON capability_requests (duplicate_of);

-- The open requests (not duplicates, not built or declined), so the helper
-- can tell whether a new ask is already on the list. Bypasses RLS because
-- a property manager can otherwise only read their own requests; returns
-- only the id and summary, and only to the helper's roles.
CREATE OR REPLACE FUNCTION open_capability_requests()
RETURNS TABLE (id uuid, summary text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT request.id, request.summary
  FROM capability_requests request
  WHERE (SELECT auth_role()) IN ('super_admin', 'admin', 'property_manager')
    AND request.duplicate_of IS NULL
    AND request.status IN ('new', 'reviewing', 'planned')
  ORDER BY request.created_at DESC
  LIMIT 50;
$$;

-- Same as before, plus: a linked request with no club takes the draft's.
CREATE OR REPLACE FUNCTION link_capability_requests_to_events(p_session_id uuid, p_event_ids uuid[])
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  linked integer;
BEGIN
  INSERT INTO capability_request_events (request_id, event_id)
  SELECT request.id, target.event_id
  FROM capability_requests request
  CROSS JOIN unnest(p_event_ids) AS target(event_id)
  WHERE request.session_id = p_session_id
    AND request.requested_by = (SELECT auth.uid())
    AND (
      (SELECT is_admin())
      OR target.event_id IN (SELECT event_ids_manageable_by_property_manager())
    )
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS linked = ROW_COUNT;

  UPDATE capability_requests request
  SET property_id = event.property_id
  FROM events event
  WHERE request.session_id = p_session_id
    AND request.requested_by = (SELECT auth.uid())
    AND request.property_id IS NULL
    AND event.id = p_event_ids[1];

  RETURN linked;
END;
$$;

-- Same as before, but a duplicate reports its original's id, summary and
-- status, so the event pages follow the original.
CREATE OR REPLACE FUNCTION feature_requests_for_events(p_event_ids uuid[])
RETURNS TABLE (event_id uuid, request_id uuid, summary text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (link.event_id, original.id)
    link.event_id, original.id, original.summary, original.status
  FROM capability_request_events link
  JOIN capability_requests request ON request.id = link.request_id
  JOIN capability_requests original ON original.id = COALESCE(request.duplicate_of, request.id)
  WHERE link.event_id = ANY (p_event_ids)
    AND original.status <> 'declined'
    AND (
      (SELECT is_admin())
      OR link.event_id IN (SELECT event_ids_manageable_by_property_manager())
    )
  ORDER BY link.event_id, original.id;
$$;

REVOKE ALL ON FUNCTION open_capability_requests() FROM public, anon;
GRANT EXECUTE ON FUNCTION open_capability_requests() TO authenticated;
