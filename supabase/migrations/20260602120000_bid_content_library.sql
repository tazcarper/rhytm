-- =============================================================
-- Bid Content Library — FAQ & Gear templates (App build: bid-content-library)
--
-- Reusable FAQ / gear-list content that auto-fills onto new bids based on
-- a booking's property, disciplines (services), and booking type. Plan:
-- plans/bid-content-library.md.
--
-- CORE PRINCIPLE — snapshot, not reference. Bids keep storing `faq` /
-- `gear_list` as JSONB snapshots on the bid row (Phase 3). This library is
-- only a SOURCE we copy from at compose time. Editing a template later must
-- NEVER mutate an already-composed bid — same reasoning as the frozen
-- guest_name snapshot. The resolver here is the single copy-from-source.
--
-- Two parallel structures (FAQ, gear), each with typed columns and its own
-- scope table — no shared `kind` discriminator, no nullable payload. The
-- four template axes ('global','property','service','booking_type') map to
-- the schema that already exists: properties, services (per-property
-- discipline rows), and booking_type_enum.
-- =============================================================

-- ============================================================
-- Step 1 — FAQ library
-- ============================================================

CREATE TABLE bid_faq_templates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  question      text        NOT NULL,
  answer        text        NOT NULL,
  dedupe_key    text        NOT NULL,
  display_order integer     NOT NULL DEFAULT 0,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN bid_faq_templates.dedupe_key IS
  'Stable key (e.g. cancellation, eye-ear). Two templates sharing a key are '
  'the same logical item at different scopes; the resolver keeps only the '
  'most specific scope per key.';

CREATE TABLE bid_faq_template_scopes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid NOT NULL REFERENCES bid_faq_templates(id) ON DELETE CASCADE,
  scope_type   text NOT NULL CHECK (scope_type IN ('global','property','service','booking_type')),
  property_id  uuid REFERENCES properties(id),
  service_id   uuid REFERENCES services(id),
  booking_type booking_type_enum,
  -- Exactly the column matching scope_type is non-null; the others are null.
  CONSTRAINT bid_faq_scope_shape CHECK (
    CASE scope_type
      WHEN 'global'       THEN property_id IS NULL     AND service_id IS NULL     AND booking_type IS NULL
      WHEN 'property'     THEN property_id IS NOT NULL  AND service_id IS NULL     AND booking_type IS NULL
      WHEN 'service'      THEN property_id IS NULL      AND service_id IS NOT NULL AND booking_type IS NULL
      WHEN 'booking_type' THEN property_id IS NULL      AND service_id IS NULL     AND booking_type IS NOT NULL
    END
  )
);

CREATE INDEX idx_faq_scopes_template  ON bid_faq_template_scopes (template_id);
CREATE INDEX idx_faq_scopes_property  ON bid_faq_template_scopes (property_id)  WHERE property_id IS NOT NULL;
CREATE INDEX idx_faq_scopes_service   ON bid_faq_template_scopes (service_id)   WHERE service_id  IS NOT NULL;
CREATE INDEX idx_faq_scopes_btype     ON bid_faq_template_scopes (booking_type) WHERE booking_type IS NOT NULL;

CREATE TRIGGER bid_faq_templates_updated_at
  BEFORE UPDATE ON bid_faq_templates
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- RLS on immediately so the table is never reachable without a policy.
ALTER TABLE bid_faq_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_faq_template_scopes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Step 2 — Gear library (own clean columns, own scope table)
-- ============================================================

CREATE TABLE bid_gear_templates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  description   text,
  dedupe_key    text        NOT NULL,
  display_order integer     NOT NULL DEFAULT 0,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN bid_gear_templates.dedupe_key IS
  'Stable key (e.g. eye-ear, shotgun). Two templates sharing a key are the '
  'same logical item at different scopes; the resolver keeps only the most '
  'specific scope per key.';

CREATE TABLE bid_gear_template_scopes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid NOT NULL REFERENCES bid_gear_templates(id) ON DELETE CASCADE,
  scope_type   text NOT NULL CHECK (scope_type IN ('global','property','service','booking_type')),
  property_id  uuid REFERENCES properties(id),
  service_id   uuid REFERENCES services(id),
  booking_type booking_type_enum,
  CONSTRAINT bid_gear_scope_shape CHECK (
    CASE scope_type
      WHEN 'global'       THEN property_id IS NULL     AND service_id IS NULL     AND booking_type IS NULL
      WHEN 'property'     THEN property_id IS NOT NULL  AND service_id IS NULL     AND booking_type IS NULL
      WHEN 'service'      THEN property_id IS NULL      AND service_id IS NOT NULL AND booking_type IS NULL
      WHEN 'booking_type' THEN property_id IS NULL      AND service_id IS NULL     AND booking_type IS NOT NULL
    END
  )
);

CREATE INDEX idx_gear_scopes_template  ON bid_gear_template_scopes (template_id);
CREATE INDEX idx_gear_scopes_property  ON bid_gear_template_scopes (property_id)  WHERE property_id IS NOT NULL;
CREATE INDEX idx_gear_scopes_service   ON bid_gear_template_scopes (service_id)   WHERE service_id  IS NOT NULL;
CREATE INDEX idx_gear_scopes_btype     ON bid_gear_template_scopes (booking_type) WHERE booking_type IS NOT NULL;

CREATE TRIGGER bid_gear_templates_updated_at
  BEFORE UPDATE ON bid_gear_templates
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- RLS on immediately so the table is never reachable without a policy.
ALTER TABLE bid_gear_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_gear_template_scopes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Step 3 — RLS policies: staff-only, full access; no anon / member / partner.
--
-- No cross-table subqueries in any USING clause -> no policy-cycle risk.
-- is_staff() is SECURITY INVOKER and already wraps auth.jwt() in (SELECT ...).
-- The creation path (create_public_booking, service_role) and the resolver
-- (SECURITY DEFINER, below) both bypass RLS, so these policies only gate the
-- admin management UI and any direct authenticated reads. RLS itself was
-- enabled inline with each CREATE TABLE above.
-- ============================================================

CREATE POLICY "bid_faq_templates: staff all"
  ON bid_faq_templates FOR ALL
  USING (is_staff()) WITH CHECK (is_staff());

CREATE POLICY "bid_faq_template_scopes: staff all"
  ON bid_faq_template_scopes FOR ALL
  USING (is_staff()) WITH CHECK (is_staff());

CREATE POLICY "bid_gear_templates: staff all"
  ON bid_gear_templates FOR ALL
  USING (is_staff()) WITH CHECK (is_staff());

CREATE POLICY "bid_gear_template_scopes: staff all"
  ON bid_gear_template_scopes FOR ALL
  USING (is_staff()) WITH CHECK (is_staff());

-- ============================================================
-- Step 4 — resolve_bid_content(): the single copy-from-source.
--
-- Given a booking's property, its discipline (service) ids, and its booking
-- type, returns the assembled FAQ and gear JSONB snapshots — already deduped,
-- override-resolved, and ordered — in the exact shapes the bids row stores
-- (faq: [{question, answer}], gear_list: [{name, description?}]).
--
-- A template MATCHES when it has any scope row that is global, OR property =
-- booking.property_id, OR service in the booking's discipline ids, OR
-- booking_type = booking.booking_type. Among a template's matching scopes we
-- take its most specific one; then across templates sharing a dedupe_key we
-- keep the single most specific, breaking ties by display_order then created.
-- Precedence: service (3) > booking_type (2) > property (1) > global (0).
--
-- SECURITY DEFINER: bypasses RLS on the four template tables. SAFE — it reads
-- only is_active rows and returns assembled public-facing copy; it writes
-- nothing and exposes no row identifiers. EXECUTE is granted to service_role
-- only here (the create_public_booking creation path). The staff-facing
-- "Re-pull from library" RPC is added in a later build step.
-- ============================================================

CREATE OR REPLACE FUNCTION resolve_bid_content(
  p_property_id  uuid,
  p_service_ids  uuid[],
  p_booking_type booking_type_enum
)
RETURNS TABLE (faq jsonb, gear jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH faq_matched AS (
    SELECT t.id, t.question, t.answer, t.dedupe_key, t.display_order, t.created_at,
           max(CASE s.scope_type
                 WHEN 'service'      THEN 3
                 WHEN 'booking_type' THEN 2
                 WHEN 'property'     THEN 1
                 ELSE 0
               END) AS precedence
    FROM bid_faq_templates t
    JOIN bid_faq_template_scopes s ON s.template_id = t.id
    WHERE t.is_active
      AND (
        s.scope_type = 'global'
        OR (s.scope_type = 'property'     AND s.property_id  = p_property_id)
        OR (s.scope_type = 'service'      AND s.service_id   = ANY (p_service_ids))
        OR (s.scope_type = 'booking_type' AND s.booking_type = p_booking_type)
      )
    GROUP BY t.id, t.question, t.answer, t.dedupe_key, t.display_order, t.created_at
  ),
  faq_deduped AS (
    SELECT DISTINCT ON (dedupe_key) question, answer, display_order, created_at
    FROM faq_matched
    ORDER BY dedupe_key, precedence DESC, display_order ASC, created_at ASC
  ),
  gear_matched AS (
    SELECT t.id, t.name, t.description, t.dedupe_key, t.display_order, t.created_at,
           max(CASE s.scope_type
                 WHEN 'service'      THEN 3
                 WHEN 'booking_type' THEN 2
                 WHEN 'property'     THEN 1
                 ELSE 0
               END) AS precedence
    FROM bid_gear_templates t
    JOIN bid_gear_template_scopes s ON s.template_id = t.id
    WHERE t.is_active
      AND (
        s.scope_type = 'global'
        OR (s.scope_type = 'property'     AND s.property_id  = p_property_id)
        OR (s.scope_type = 'service'      AND s.service_id   = ANY (p_service_ids))
        OR (s.scope_type = 'booking_type' AND s.booking_type = p_booking_type)
      )
    GROUP BY t.id, t.name, t.description, t.dedupe_key, t.display_order, t.created_at
  ),
  gear_deduped AS (
    SELECT DISTINCT ON (dedupe_key) name, description, display_order, created_at
    FROM gear_matched
    ORDER BY dedupe_key, precedence DESC, display_order ASC, created_at ASC
  )
  SELECT
    (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object('question', question, 'answer', answer)
          ORDER BY display_order ASC, created_at ASC
        ),
        '[]'::jsonb
      )
      FROM faq_deduped
    ) AS faq,
    (
      SELECT coalesce(
        jsonb_agg(
          CASE
            WHEN description IS NOT NULL AND description <> ''
              THEN jsonb_build_object('name', name, 'description', description)
            ELSE jsonb_build_object('name', name)
          END
          ORDER BY display_order ASC, created_at ASC
        ),
        '[]'::jsonb
      )
      FROM gear_deduped
    ) AS gear;
$$;

REVOKE ALL ON FUNCTION resolve_bid_content(uuid, uuid[], booking_type_enum) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_bid_content(uuid, uuid[], booking_type_enum) TO service_role;

-- ============================================================
-- Step 5 — Wire the resolver into create_public_booking.
--
-- Reproduces the latest 17-arg definition (20260530170100) verbatim, adding
-- two lines: resolve the library content for this booking, then write it onto
-- the new bid row alongside the access code. The write is a one-time snapshot
-- at creation; later template edits never touch this bid. Everything stays in
-- the one PL/pgSQL transaction, so a resolver failure rolls back the booking.
-- ============================================================

CREATE OR REPLACE FUNCTION create_public_booking(
  p_property_id      uuid,
  p_booking_type     booking_type_enum,
  p_audience_type    audience_type_enum,
  p_date             date,
  p_slot_start       time,
  p_duration_hours   integer,
  p_instructor_id    uuid,
  p_guest_name       text,
  p_guest_email      text,
  p_guest_phone      text,
  p_guest_count      integer,
  p_guest_notes      text,
  p_estimated_price  numeric,
  p_discipline_ids   uuid[],
  p_add_ons          jsonb,
  p_access_code      text,
  p_member_user_id   uuid DEFAULT NULL
)
RETURNS TABLE (booking_id uuid, bid_id uuid, bid_slug text)
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_instructor_id uuid := p_instructor_id;
  v_start_time    timestamptz;
  v_booking_id    uuid;
  v_bid_id        uuid;
  v_bid_slug      text;
  v_faq           jsonb;
  v_gear          jsonb;
BEGIN
  v_start_time := (p_date + p_slot_start) AT TIME ZONE 'America/Chicago';

  IF p_booking_type = 'private_lesson' AND v_instructor_id IS NULL THEN
    SELECT id INTO v_instructor_id
    FROM instructors
    WHERE property_id = p_property_id
      AND is_active = true
    ORDER BY display_order
    LIMIT 1;

    IF v_instructor_id IS NULL THEN
      RAISE EXCEPTION 'No active instructors available for this property'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO bookings (
    property_id,
    booking_type,
    start_time,
    duration_hours,
    instructor_id,
    guest_name,
    guest_email,
    guest_phone,
    guest_count,
    guest_notes,
    audience_type,
    estimated_price,
    member_user_id
  ) VALUES (
    p_property_id,
    p_booking_type,
    v_start_time,
    p_duration_hours,
    v_instructor_id,
    p_guest_name,
    p_guest_email,
    p_guest_phone,
    p_guest_count,
    NULLIF(p_guest_notes, ''),
    p_audience_type,
    p_estimated_price,
    p_member_user_id
  )
  RETURNING id INTO v_booking_id;

  IF p_discipline_ids IS NOT NULL AND array_length(p_discipline_ids, 1) > 0 THEN
    INSERT INTO booking_disciplines (booking_id, service_id)
    SELECT v_booking_id, unnest(p_discipline_ids);
  END IF;

  IF p_add_ons IS NOT NULL AND jsonb_array_length(p_add_ons) > 0 THEN
    INSERT INTO booking_add_ons (
      booking_id, service_id, add_on_id, quantity, unit_price_at_booking
    )
    SELECT
      v_booking_id,
      (a->>'service_id')::uuid,
      (a->>'add_on_id')::uuid,
      (a->>'quantity')::integer,
      ao.price
    FROM jsonb_array_elements(p_add_ons) AS a
    JOIN add_ons ao ON ao.id = (a->>'add_on_id')::uuid;
  END IF;

  -- Auto-fill FAQ + gear from the content library (snapshot at creation).
  SELECT faq, gear INTO v_faq, v_gear
  FROM resolve_bid_content(p_property_id, p_discipline_ids, p_booking_type);

  INSERT INTO bids (booking_id, access_code_hash, access_code_plaintext, faq, gear_list)
  VALUES (
    v_booking_id,
    extensions.crypt(p_access_code, extensions.gen_salt('bf')),
    p_access_code,
    coalesce(v_faq, '[]'::jsonb),
    coalesce(v_gear, '[]'::jsonb)
  )
  RETURNING id, slug INTO v_bid_id, v_bid_slug;

  RETURN QUERY SELECT v_booking_id, v_bid_id, v_bid_slug;
END;
$$;

REVOKE ALL ON FUNCTION create_public_booking(
  uuid, booking_type_enum, audience_type_enum, date, time, integer, uuid,
  text, text, text, integer, text, numeric, uuid[], jsonb, text, uuid
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION create_public_booking(
  uuid, booking_type_enum, audience_type_enum, date, time, integer, uuid,
  text, text, text, integer, text, numeric, uuid[], jsonb, text, uuid
) TO service_role;
