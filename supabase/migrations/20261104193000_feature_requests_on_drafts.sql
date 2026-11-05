-- ============================================================
-- Link the helper's feature requests to the drafts they hold up
-- ============================================================
--
-- When the AI helper can't build part of an event, it sends the developer
-- a feature request (capability_requests) and drafts the rest. This links
-- each request to the draft event(s) it belongs to, so the events list and
-- the event page can say "Waiting on a feature" until it's built.
--
--   capability_requests.session_id — the helper conversation it came from,
--                                    so a draft saved later in the same
--                                    conversation picks it up
--   capability_request_events      — request ↔ event (a repeating event
--                                    links every date)
--
-- Property managers can't read other people's requests or update any, so
-- linking and reading go through two SECURITY DEFINER functions that check
-- who's asking and which events they manage.
--
-- Policy dependency audit (CLAUDE.md RLS rule 5): capability_request_events
-- has one policy, is_admin(), which references no table. The functions are
-- opaque to the planner. No cycles.

ALTER TABLE capability_requests
  ADD COLUMN session_id uuid REFERENCES ai_draft_sessions(id) ON DELETE SET NULL;

CREATE INDEX idx_capability_requests_session ON capability_requests (session_id);

CREATE TABLE capability_request_events (
  request_id  uuid NOT NULL REFERENCES capability_requests(id) ON DELETE CASCADE,
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  PRIMARY KEY (request_id, event_id)
);

CREATE INDEX idx_capability_request_events_event ON capability_request_events (event_id);

ALTER TABLE capability_request_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "capability_request_events: admin all"
  ON capability_request_events FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Links the caller's own requests from one helper conversation to events
-- the caller can edit. Bypasses RLS on capability_request_events (property
-- managers have no policy there); the WHERE clause is the access check.
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
  RETURN linked;
END;
$$;

-- The open or built (not declined) requests linked to the given events,
-- limited to events the caller can edit. Bypasses RLS on
-- capability_requests so a property manager sees requests a colleague
-- made for their property's drafts.
CREATE OR REPLACE FUNCTION feature_requests_for_events(p_event_ids uuid[])
RETURNS TABLE (event_id uuid, request_id uuid, summary text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT link.event_id, request.id, request.summary, request.status
  FROM capability_request_events link
  JOIN capability_requests request ON request.id = link.request_id
  WHERE link.event_id = ANY (p_event_ids)
    AND request.status <> 'declined'
    AND (
      (SELECT is_admin())
      OR link.event_id IN (SELECT event_ids_manageable_by_property_manager())
    )
  ORDER BY request.created_at;
$$;

REVOKE ALL ON FUNCTION link_capability_requests_to_events(uuid, uuid[]) FROM public, anon;
REVOKE ALL ON FUNCTION feature_requests_for_events(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION link_capability_requests_to_events(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION feature_requests_for_events(uuid[]) TO authenticated;
