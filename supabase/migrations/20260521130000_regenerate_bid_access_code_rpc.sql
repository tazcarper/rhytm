-- Admin action: rotate a bid's access code. Used when the original URL
-- has been shared too broadly or the original code is suspected leaked.
-- The slug stays put so the bid's identity doesn't move; only the
-- access_code_hash rotates. The plaintext code is supplied by the
-- caller (generated server-side via crypto.randomBytes) and bcrypt-
-- hashed inside the function so the plaintext never touches the wire
-- as raw SQL.
--
-- SECURITY DEFINER because we need pgcrypto via the extensions schema
-- and we want to enforce staff-role + property-scope checks inline
-- (the function bypasses RLS, so we re-implement the equivalent of
-- Phase 3's `bids: staff update` policy).

CREATE OR REPLACE FUNCTION regenerate_bid_access_code(
  p_bid_id uuid,
  p_code   text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role        text;
  v_property_id uuid;
  v_authorized  boolean;
  v_updated_id  uuid;
BEGIN
  v_role := (SELECT auth.jwt() -> 'app_metadata' ->> 'role');

  IF v_role NOT IN ('super_admin', 'admin', 'property_manager') THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'property_manager' THEN
    v_property_id := (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid);
    SELECT EXISTS (
      SELECT 1
      FROM bids bd
      JOIN bookings b ON b.id = bd.booking_id
      WHERE bd.id = p_bid_id
        AND b.property_id = v_property_id
    ) INTO v_authorized;
    IF NOT v_authorized THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE bids
  SET access_code_hash = extensions.crypt(p_code, extensions.gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = p_bid_id
  RETURNING id INTO v_updated_id;

  IF v_updated_id IS NULL THEN
    RAISE EXCEPTION 'bid_not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_updated_id;
END;
$$;

REVOKE ALL ON FUNCTION regenerate_bid_access_code(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION regenerate_bid_access_code(uuid, text) TO authenticated;
