-- ============================================================
-- App 7 (homegrown waiver) — Phase 7: atomic template save
-- ============================================================
-- Backs the admin waiver template editor. Deactivates the property's
-- current active template and inserts a new version in ONE transaction, so
-- the partial unique index (one active per property) is never violated and
-- a property is never left with zero active templates (which would break
-- signing).
--
-- SECURITY INVOKER (not DEFINER): the function runs as the calling admin,
-- so the existing waiver_templates RLS policies gate it —
-- "admin insert" / "admin update" allow only super_admin / admin. A
-- non-admin caller's INSERT is rejected by RLS and the whole call errors.
-- created_by is stamped from the caller's auth.uid().

CREATE OR REPLACE FUNCTION save_waiver_template(
  p_property_id  uuid,
  p_title        text,
  p_body         text,
  p_consent_text text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_next_version int;
  v_new_id       uuid;
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1
    INTO v_next_version
    FROM waiver_templates
   WHERE property_id = p_property_id;

  -- Deactivate the current active version FIRST so the single-active
  -- partial unique index is satisfied when the new row is inserted.
  UPDATE waiver_templates
     SET is_active = false
   WHERE property_id = p_property_id
     AND is_active;

  INSERT INTO waiver_templates (
    property_id, version, title, body, consent_text, is_active, created_by
  ) VALUES (
    p_property_id, v_next_version, p_title, p_body, p_consent_text, true,
    (SELECT auth.uid())
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION save_waiver_template(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_waiver_template(uuid, text, text, text) TO authenticated;
