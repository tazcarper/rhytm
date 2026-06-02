-- =============================================================
-- repull_bid_content(p_bid_id) — staff-facing wrapper over resolve_bid_content.
--
-- The bid editor's "Re-pull from library" / "Add from library" controls need
-- the resolved FAQ + gear for an EXISTING bid. resolve_bid_content() itself is
-- granted to service_role only (the creation path); this wrapper exposes the
-- same result to authenticated staff, looking up the bid's property, its
-- disciplines, and its booking type so the client doesn't have to.
--
-- It RESOLVES ONLY — it never writes. The editor merges the result into its
-- local draft; saving still goes through the existing updateBidContent path,
-- which writes the frozen JSONB snapshot. So the snapshot-not-reference
-- principle holds: re-pulling is an explicit, reviewable staff action.
--
-- SECURITY DEFINER so it can read the template tables (and call the
-- service_role-granted resolver as its owner). Authz mirrors
-- regenerate_bid_access_code: any staff role may re-pull, and a
-- property_manager only for bids at their own property.
-- =============================================================

CREATE OR REPLACE FUNCTION repull_bid_content(p_bid_id uuid)
RETURNS TABLE (faq jsonb, gear jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id    uuid;
  v_property_id   uuid;
  v_booking_type  booking_type_enum;
  v_service_ids   uuid[];
BEGIN
  IF NOT is_staff() THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT b.id, b.property_id, b.booking_type
    INTO v_booking_id, v_property_id, v_booking_type
  FROM bids bd
  JOIN bookings b ON b.id = bd.booking_id
  WHERE bd.id = p_bid_id;

  IF v_booking_id IS NULL THEN
    RAISE EXCEPTION 'bid_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Property managers may only re-pull for bids at their own property.
  IF auth_role() = 'property_manager'
     AND v_property_id IS DISTINCT FROM auth_property_id() THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(service_id)
    INTO v_service_ids
  FROM booking_disciplines
  WHERE booking_id = v_booking_id;

  RETURN QUERY
  SELECT r.faq, r.gear
  FROM resolve_bid_content(
    v_property_id,
    coalesce(v_service_ids, ARRAY[]::uuid[]),
    v_booking_type
  ) AS r;
END;
$$;

REVOKE ALL ON FUNCTION repull_bid_content(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION repull_bid_content(uuid) TO authenticated;
