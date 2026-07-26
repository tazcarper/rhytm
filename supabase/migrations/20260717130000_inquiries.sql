-- Inquiries
--
-- Backs the (currently unwired) Membership Inquiry and Private Events /
-- Request a Proposal forms in the new front-end designs
-- (temporary-resources/front-end-beta/{property}/{membership,private-events}.html).
-- No direct precedent in this codebase — closest structural analogs are
-- promotions (admin CRUD shape) and the Bids audit trail (chronological
-- event log), neither of which fits whole.
--
-- Builds:
--   1. inquiry_type_enum, inquiry_status_enum, inquiry_event_type_enum.
--   2. inquiries — one row per form submission. Common columns
--      (name/email/phone/message) plus a `details` jsonb column for the
--      type-specific extra fields (how-heard-about-us for membership;
--      event type / desired date / guest count for private events) —
--      jsonb rather than per-field columns because these forms already
--      vary per property in the designs and will keep varying
--      (Open/Closed: a new form field shouldn't need a migration).
--   3. inquiry_events — an audit trail. "Resolve" is a service-layer
--      transaction (UPDATE inquiries.status + INSERT an audit row), not a
--      DB trigger, so the note stays optional/free-text at write time.
--   4. RLS — public INSERT-only (anonymous form submission; no public
--      SELECT, since an inquiry carries PII), staff full access via a
--      SECURITY DEFINER selector for the cross-table inquiry_events check.

-- ============================================================
-- Step 1 — Enums
-- ============================================================

CREATE TYPE inquiry_type_enum AS ENUM (
  'membership',     -- membership.html
  'private_event'   -- private-events.html
);

CREATE TYPE inquiry_status_enum AS ENUM (
  'new',       -- shown in the admin "New" tab
  'resolved'   -- moved to the "Resolved" tab
);

CREATE TYPE inquiry_event_type_enum AS ENUM (
  'note',        -- free-form staff note, no status change
  'contacted',   -- staff reached out
  'denied',      -- inquiry declined
  'resolved'     -- inquiry marked resolved (always paired with the status flip)
);

-- ============================================================
-- Step 2 — inquiries
-- ============================================================

CREATE TABLE inquiries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  uuid NOT NULL REFERENCES properties(id),

  inquiry_type  inquiry_type_enum NOT NULL,
  name          text NOT NULL,
  email         text NOT NULL,
  phone         text,
  message       text,

  -- Type-specific fields. Known shapes (documented, not CHECK-enforced,
  -- since "how did you hear about us" is already inconsistent across
  -- properties in the designs):
  --   membership:     { "heard_about": string | null }
  --   private_event:  { "event_type": string, "desired_date": string,
  --                      "guest_count": number }
  details  jsonb NOT NULL DEFAULT '{}'::jsonb,

  status  inquiry_status_enum NOT NULL DEFAULT 'new',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inquiries_property_status ON inquiries (property_id, status, created_at DESC);

CREATE TRIGGER inquiries_updated_at
  BEFORE UPDATE ON inquiries
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- Step 3 — inquiry_events (audit trail)
-- ============================================================

CREATE TABLE inquiry_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id            uuid NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  event_type            inquiry_event_type_enum NOT NULL,
  note                  text,
  created_by_admin_id   uuid REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inquiry_events_inquiry ON inquiry_events (inquiry_id, created_at);

-- ============================================================
-- Step 4 — RLS
-- ============================================================

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiry_events ENABLE ROW LEVEL SECURITY;

-- Public: anonymous INSERT-only via the form's Server Action. No public
-- SELECT — an inquiry contains PII (email/phone) a stranger shouldn't be
-- able to enumerate.
CREATE POLICY "inquiries: public insert"
  ON inquiries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "inquiries: admin all"
  ON inquiries FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "inquiries: property_manager read/write own"
  ON inquiries FOR ALL
  USING ((SELECT auth_role()) = 'property_manager' AND property_id = (SELECT auth_property_id()))
  WITH CHECK ((SELECT auth_role()) = 'property_manager' AND property_id = (SELECT auth_property_id()));

-- inquiry_events is cross-table from inquiries — SECURITY DEFINER
-- selector, same reasoning as the events migration's info-box policies.
CREATE OR REPLACE FUNCTION inquiry_ids_manageable_by_current_staff()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM inquiries
  WHERE is_admin()
     OR ((SELECT auth_role()) = 'property_manager' AND property_id = (SELECT auth_property_id()));
$$;

CREATE POLICY "inquiry_events: staff all"
  ON inquiry_events FOR ALL
  USING (inquiry_id IN (SELECT inquiry_ids_manageable_by_current_staff()))
  WITH CHECK (inquiry_id IN (SELECT inquiry_ids_manageable_by_current_staff()));
