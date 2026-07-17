-- Events
--
-- Specific, dated occasions with a hard capacity cap and member vs.
-- non-member pricing — distinct from `bookings` (continuous time-slot
-- availability against a property-wide concurrency cap) and from
-- `member_adventures` (members-only). Events are open to anyone; a
-- signed-in member with an active membership at the event's property
-- gets member pricing, resolved server-side at registration time (never
-- trust a client-supplied "I'm a member" flag).
--
-- Builds:
--   1. event_status_enum, event_registration_status_enum, event_info_box_type_enum.
--   2. events — the event itself. Capacity + pricing + a `status` kept in
--      sync with registrations, plus `is_template` for the admin
--      "duplicate as a new draft" flow (app-layer clone, not a live link —
--      same snapshot principle as bid_content_library).
--   3. event_registrations — one row per signup. Always carries a contact
--      snapshot (name/email/phone) since most registrants have no
--      `people` row; `person_id` + `is_member_rate` are set only when the
--      registrant is a signed-in, currently-active member.
--   4. event_info_boxes — admin-authorable content blocks ("what to
--      expect", "required gear", etc.) as a child table so admins can
--      add/reorder arbitrary boxes instead of fixed jsonb columns.
--   5. check_event_capacity / sync_event_sold_out /
--      resync_event_sold_out_on_capacity_change triggers — ported from
--      member_adventures' check_adventure_capacity / sync_adventure_sold_out
--      (supabase/migrations/20260518170737_phase_5_adventures.sql), same
--      FOR UPDATE row-lock strategy for race-free capacity enforcement.
--   6. RLS — public read of published/sold_out events, public INSERT-only
--      on registrations (anonymous signup, no self-service read/update in
--      v1), admin/property_manager full access. Cross-table checks (info
--      boxes, property-manager-scoped registrations) go through
--      SECURITY DEFINER selector functions per this repo's RLS rules —
--      never an inline EXISTS.
--
-- Deliberately NOT modeled on the client's own throwaway reference schema
-- (temporary-resources/front-end-beta/_reference/event-builder/supabase-setup.sql),
-- which typed capacity/member_price/non_member_price as `text` and left
-- RLS wide open (it was a single-admin demo tool) — capacity and pricing
-- are numeric here so the DB enforces them, not client-side string parsing.
--
-- No payment integration in this migration (v1 is capacity-tracking
-- signup only, per plan). `price_quoted` is a display/snapshot field.
-- Layering Stripe in later should follow member_adventures'
-- deposit_payment_intent_id / balance_payment_intent_id precedent on
-- event_registrations, added as a follow-on migration, not reworked here.

-- ============================================================
-- Step 1 — Enums
-- ============================================================

CREATE TYPE event_status_enum AS ENUM (
  'draft',      -- invisible to the public
  'published',  -- visible and open for registration
  'sold_out',   -- visible but no new confirmed registrations (capacity full)
  'cancelled',  -- cancelled by staff
  'completed'   -- event happened
);

CREATE TYPE event_registration_status_enum AS ENUM (
  'confirmed',   -- holding a confirmed spot
  'waitlisted',  -- on the waitlist; no spot held
  'cancelled'    -- registrant (or staff) cancelled
);

CREATE TYPE event_info_box_type_enum AS ENUM (
  'description', -- prose block (heading + body)
  'list'         -- bullet list (heading + items)
);

-- ============================================================
-- Step 2 — events
-- ============================================================

CREATE TABLE events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  uuid NOT NULL REFERENCES properties(id),

  title        text NOT NULL,
  summary      text,   -- short blurb for listing cards
  description  text,   -- long-form body for the detail page
  start_at     timestamptz NOT NULL,
  end_at       timestamptz,
  location     text,

  -- Capacity
  max_capacity                  integer NOT NULL CHECK (max_capacity > 0),
  max_guests_per_registration   integer NOT NULL CHECK (max_guests_per_registration > 0),

  -- Pricing. Both nullable — a free event has neither. Values are quoted/
  -- display prices; no charge is taken at registration in v1 (see header).
  member_price      numeric(10,2) CHECK (member_price IS NULL OR member_price >= 0),
  non_member_price  numeric(10,2) CHECK (non_member_price IS NULL OR non_member_price >= 0),

  -- Visible status. Auto-managed by the capacity-based triggers below.
  status  event_status_enum NOT NULL DEFAULT 'draft',

  -- Staff override, same semantics as member_adventures.is_manually_sold_out:
  -- when true, new confirmed registrations are rejected (forcing waitlist)
  -- and the auto-sync triggers leave `status` alone, so a single
  -- cancellation can't silently undo an operator's "we're full at 40, not
  -- 50" call.
  is_manually_sold_out  boolean NOT NULL DEFAULT false,

  -- Template support. A template is just a row with is_template = true —
  -- "new event from template" is an app-layer clone (read this row + its
  -- info boxes, insert a fresh draft with a new id), not a live link.
  is_template  boolean NOT NULL DEFAULT false,

  image_url  text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT event_end_after_start CHECK (end_at IS NULL OR end_at >= start_at),
  -- A single registration can't claim more slots than the whole event has.
  CONSTRAINT event_guests_within_capacity
    CHECK (max_guests_per_registration <= max_capacity)
);

CREATE INDEX idx_events_property_status ON events (property_id, status, start_at);
CREATE INDEX idx_events_template ON events (is_template) WHERE is_template = true;

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- Step 3 — event_registrations
-- ============================================================

CREATE TABLE event_registrations (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id  uuid NOT NULL REFERENCES events(id),

  -- Always-required contact snapshot — the fallback for non-members, and
  -- the "who to email" regardless of member status.
  contact_name   text NOT NULL,
  contact_email  text NOT NULL,
  contact_phone  text,

  -- Set only when the registrant is a signed-in member with an active
  -- membership at the event's property, resolved server-side by the
  -- registration Server Action (mirrors the eligibility check in
  -- app/(public)/adventures/[id]/reserve/actions.ts). Never trust a
  -- client-supplied "is_member" flag for pricing.
  person_id       uuid REFERENCES people(id),
  is_member_rate  boolean NOT NULL DEFAULT false,

  -- Includes the registrant themselves; solo registration is guest_count=1.
  guest_count  integer NOT NULL DEFAULT 1 CHECK (guest_count > 0),
  status       event_registration_status_enum NOT NULL DEFAULT 'confirmed',

  -- Price actually quoted at registration time (snapshot, not
  -- live-recomputed later if the event's prices change) — same reasoning
  -- as bid line-item snapshots elsewhere in this codebase.
  price_quoted  numeric(10,2),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_registrations_event ON event_registrations (event_id, status);
CREATE INDEX idx_event_registrations_email ON event_registrations (contact_email);

CREATE TRIGGER event_registrations_updated_at
  BEFORE UPDATE ON event_registrations
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- Step 4 — event_info_boxes
-- ============================================================

CREATE TABLE event_info_boxes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  box_type    event_info_box_type_enum NOT NULL,
  heading     text NOT NULL,
  body        text,   -- box_type = 'description'
  items       jsonb,  -- box_type = 'list' (array of strings)
  sort_order  integer NOT NULL DEFAULT 0,

  CONSTRAINT event_info_box_shape CHECK (
    (box_type = 'description' AND body IS NOT NULL AND items IS NULL) OR
    (box_type = 'list' AND items IS NOT NULL AND body IS NULL)
  )
);

CREATE INDEX idx_event_info_boxes_event ON event_info_boxes (event_id, sort_order);

-- ============================================================
-- Step 5 — Trigger: capacity enforcement
-- ============================================================
--
-- Three guardrails fire under one row lock on the parent event:
--   (1) Per-registration guest cap.
--   (2) Manual sold-out — rejects confirmed registrations outright.
--       Caller must route to 'waitlisted' instead.
--   (3) Total capacity — sum of guest_count across confirmed
--       registrations cannot exceed max_capacity. The FOR UPDATE lock
--       serializes concurrent inserts so two registrants can't both "see
--       room" before either commits.

CREATE OR REPLACE FUNCTION check_event_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_max_capacity                integer;
  v_max_guests_per_registration integer;
  v_is_manually_sold_out        boolean;
  v_confirmed_count             integer;
BEGIN
  SELECT max_capacity, max_guests_per_registration, is_manually_sold_out
    INTO v_max_capacity, v_max_guests_per_registration, v_is_manually_sold_out
  FROM events
  WHERE id = NEW.event_id
  FOR UPDATE;

  -- (1) Per-registration guest cap.
  IF NEW.status != 'cancelled' AND NEW.guest_count > v_max_guests_per_registration THEN
    RAISE EXCEPTION
      'guest_count % exceeds max_guests_per_registration % for this event',
      NEW.guest_count, v_max_guests_per_registration;
  END IF;

  -- Waitlisted/cancelled don't consume capacity — done after the cap check.
  IF NEW.status != 'confirmed' THEN
    RETURN NEW;
  END IF;

  -- (2) Manual sold-out blocks new confirmed registrations.
  IF v_is_manually_sold_out THEN
    RAISE EXCEPTION
      'event is marked sold-out by staff; new registrations must be waitlisted';
  END IF;

  -- (3) Total capacity.
  SELECT COALESCE(SUM(guest_count), 0) INTO v_confirmed_count
  FROM event_registrations
  WHERE event_id = NEW.event_id
    AND status = 'confirmed'
    AND id IS DISTINCT FROM NEW.id;

  IF v_confirmed_count + NEW.guest_count > v_max_capacity THEN
    RAISE EXCEPTION
      'event is at capacity (% of % spots taken)',
      v_confirmed_count, v_max_capacity;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER event_registrations_check_capacity
  BEFORE INSERT OR UPDATE OF status, guest_count ON event_registrations
  FOR EACH ROW EXECUTE FUNCTION check_event_capacity();

-- ============================================================
-- Step 6 — Trigger: auto-sync event status from confirmed count
-- ============================================================

CREATE OR REPLACE FUNCTION sync_event_sold_out()
RETURNS TRIGGER AS $$
DECLARE
  v_max_capacity          integer;
  v_is_manually_sold_out  boolean;
  v_confirmed_count       integer;
BEGIN
  SELECT max_capacity, is_manually_sold_out
    INTO v_max_capacity, v_is_manually_sold_out
  FROM events WHERE id = NEW.event_id;

  IF v_is_manually_sold_out THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(guest_count), 0) INTO v_confirmed_count
  FROM event_registrations
  WHERE event_id = NEW.event_id AND status = 'confirmed';

  IF v_confirmed_count >= v_max_capacity THEN
    UPDATE events
    SET status = 'sold_out', updated_at = now()
    WHERE id = NEW.event_id AND status = 'published';
  ELSE
    UPDATE events
    SET status = 'published', updated_at = now()
    WHERE id = NEW.event_id AND status = 'sold_out';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER event_registrations_sync_sold_out
  AFTER INSERT OR UPDATE OF status, guest_count ON event_registrations
  FOR EACH ROW EXECUTE FUNCTION sync_event_sold_out();

-- ============================================================
-- Step 6.5 — Trigger: re-sync sold_out when staff edits max_capacity
-- ============================================================

CREATE OR REPLACE FUNCTION resync_event_sold_out_on_capacity_change()
RETURNS TRIGGER AS $$
DECLARE
  v_confirmed_count integer;
BEGIN
  IF NEW.max_capacity IS NOT DISTINCT FROM OLD.max_capacity THEN
    RETURN NEW;
  END IF;

  IF NEW.is_manually_sold_out THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(guest_count), 0) INTO v_confirmed_count
  FROM event_registrations
  WHERE event_id = NEW.id AND status = 'confirmed';

  IF v_confirmed_count >= NEW.max_capacity AND NEW.status = 'published' THEN
    NEW.status := 'sold_out';
  ELSIF v_confirmed_count < NEW.max_capacity AND NEW.status = 'sold_out' THEN
    NEW.status := 'published';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_resync_capacity
  BEFORE UPDATE OF max_capacity ON events
  FOR EACH ROW EXECUTE FUNCTION resync_event_sold_out_on_capacity_change();

-- ============================================================
-- Step 7 — RLS
-- ============================================================

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_info_boxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events: public read published"
  ON events FOR SELECT
  USING (status IN ('published', 'sold_out'));

CREATE POLICY "events: admin all"
  ON events FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "events: property_manager write own property"
  ON events FOR ALL
  USING ((SELECT auth_role()) = 'property_manager' AND property_id = (SELECT auth_property_id()))
  WITH CHECK ((SELECT auth_role()) = 'property_manager' AND property_id = (SELECT auth_property_id()));

-- event_info_boxes has no property_id of its own; its policy has to reach
-- into `events`. That's a cross-table check, so it goes through a
-- SECURITY DEFINER selector rather than an inline EXISTS, per this repo's
-- documented RLS rules (see supabase/migrations/20260518235335_rls_helpers_for_member_access.sql).
CREATE OR REPLACE FUNCTION event_ids_visible_to_public()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM events WHERE status IN ('published', 'sold_out');
$$;

CREATE OR REPLACE FUNCTION event_ids_manageable_by_property_manager()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM events
  WHERE (SELECT auth_role()) = 'property_manager'
    AND property_id = (SELECT auth_property_id());
$$;

CREATE POLICY "event_info_boxes: public read"
  ON event_info_boxes FOR SELECT
  USING (event_id IN (SELECT event_ids_visible_to_public()));

CREATE POLICY "event_info_boxes: admin all"
  ON event_info_boxes FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "event_info_boxes: property_manager write own"
  ON event_info_boxes FOR ALL
  USING (event_id IN (SELECT event_ids_manageable_by_property_manager()))
  WITH CHECK (event_id IN (SELECT event_ids_manageable_by_property_manager()));

-- Registration: public INSERT-only. The registration form is reachable
-- without signing in — no membership required to attend an event. The
-- capacity trigger does the real enforcement; RLS just gates column
-- access. No public SELECT/UPDATE: a registrant can't read the full
-- roster (privacy) or edit their own row from the browser. A "manage my
-- registration" self-service view is out of scope for v1.
CREATE POLICY "event_registrations: public insert"
  ON event_registrations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "event_registrations: admin all"
  ON event_registrations FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "event_registrations: property_manager read/write own"
  ON event_registrations FOR ALL
  USING (event_id IN (SELECT event_ids_manageable_by_property_manager()))
  WITH CHECK (event_id IN (SELECT event_ids_manageable_by_property_manager()));
