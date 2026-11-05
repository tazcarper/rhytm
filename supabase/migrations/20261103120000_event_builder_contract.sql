-- ============================================================
-- Event builder prototype — the "thin contract" beside events
-- ============================================================
--
-- Adds three child tables that extend an event without changing the
-- existing `events` row shape (the current editor and public pages keep
-- working untouched):
--
--   event_ticket_types  — named ticket tiers ("Adult $50", "Kids $10")
--   event_gear_items    — gear a guest needs, and the ways to cover it
--                         (bring your own / rent / buy / included)
--   event_questions     — questions asked of each guest at sign-up
--
-- Plus two tables for the AI event helper:
--
--   ai_draft_sessions   — one helper conversation (serverless functions
--                         keep no memory between requests)
--   capability_requests — "the builder can't do this yet" requests the
--                         helper collects for the developer to review
--
-- RLS follows the event_info_boxes precedent: the child tables have no
-- property_id of their own, so cross-table checks go through the existing
-- SECURITY DEFINER selectors event_ids_visible_to_public() and
-- event_ids_manageable_by_property_manager() (defined in
-- 20260717120000_events.sql) instead of inline EXISTS subqueries.
--
-- Policy dependency audit (CLAUDE.md RLS rule 5): the new child-table
-- policies reference `events` only through those SECURITY DEFINER
-- functions, which are opaque to the planner; no policy on `events`
-- references any new table. ai_draft_sessions and capability_requests
-- reference no other table. No cycles.

-- ------------------------------------------------------------
-- Ticket types
-- ------------------------------------------------------------

CREATE TABLE event_ticket_types (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name         text NOT NULL CHECK (length(trim(name)) > 0),
  price        numeric(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  description  text,
  sort_order   integer NOT NULL DEFAULT 0
);

CREATE INDEX idx_event_ticket_types_event ON event_ticket_types (event_id, sort_order);

-- ------------------------------------------------------------
-- Gear items
-- ------------------------------------------------------------
--
-- One row per piece of gear. The four "ways to cover it" are independent
-- columns rather than one enum, because a business usually offers more
-- than one at once (bring your own OR rent for $5). A row must offer at
-- least one way, or a required item would be impossible to satisfy.

CREATE TABLE event_gear_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name               text NOT NULL CHECK (length(trim(name)) > 0),
  is_required        boolean NOT NULL DEFAULT false,
  included           boolean NOT NULL DEFAULT false,
  bring_own_allowed  boolean NOT NULL DEFAULT false,
  rent_price         numeric(10, 2) CHECK (rent_price IS NULL OR rent_price >= 0),
  buy_price          numeric(10, 2) CHECK (buy_price IS NULL OR buy_price >= 0),
  notes              text,
  sort_order         integer NOT NULL DEFAULT 0,

  CONSTRAINT event_gear_item_has_a_way CHECK (
    included OR bring_own_allowed OR rent_price IS NOT NULL OR buy_price IS NOT NULL
  )
);

CREATE INDEX idx_event_gear_items_event ON event_gear_items (event_id, sort_order);

-- ------------------------------------------------------------
-- Guest questions
-- ------------------------------------------------------------

CREATE TABLE event_questions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  label        text NOT NULL CHECK (length(trim(label)) > 0),
  kind         text NOT NULL CHECK (kind IN ('short_text', 'yes_no', 'choice')),
  options      jsonb,   -- kind = 'choice': array of strings
  is_required  boolean NOT NULL DEFAULT false,
  sort_order   integer NOT NULL DEFAULT 0,

  CONSTRAINT event_question_options_shape CHECK (
    (kind = 'choice' AND options IS NOT NULL AND jsonb_typeof(options) = 'array') OR
    (kind <> 'choice' AND options IS NULL)
  )
);

CREATE INDEX idx_event_questions_event ON event_questions (event_id, sort_order);

-- ------------------------------------------------------------
-- RLS — child tables (mirrors event_info_boxes)
-- ------------------------------------------------------------

ALTER TABLE event_ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_gear_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_ticket_types: public read"
  ON event_ticket_types FOR SELECT
  USING (event_id IN (SELECT event_ids_visible_to_public()));
CREATE POLICY "event_ticket_types: admin all"
  ON event_ticket_types FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "event_ticket_types: property_manager write own"
  ON event_ticket_types FOR ALL
  USING (event_id IN (SELECT event_ids_manageable_by_property_manager()))
  WITH CHECK (event_id IN (SELECT event_ids_manageable_by_property_manager()));

CREATE POLICY "event_gear_items: public read"
  ON event_gear_items FOR SELECT
  USING (event_id IN (SELECT event_ids_visible_to_public()));
CREATE POLICY "event_gear_items: admin all"
  ON event_gear_items FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "event_gear_items: property_manager write own"
  ON event_gear_items FOR ALL
  USING (event_id IN (SELECT event_ids_manageable_by_property_manager()))
  WITH CHECK (event_id IN (SELECT event_ids_manageable_by_property_manager()));

CREATE POLICY "event_questions: public read"
  ON event_questions FOR SELECT
  USING (event_id IN (SELECT event_ids_visible_to_public()));
CREATE POLICY "event_questions: admin all"
  ON event_questions FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "event_questions: property_manager write own"
  ON event_questions FOR ALL
  USING (event_id IN (SELECT event_ids_manageable_by_property_manager()))
  WITH CHECK (event_id IN (SELECT event_ids_manageable_by_property_manager()));

-- ------------------------------------------------------------
-- AI helper sessions
-- ------------------------------------------------------------
--
-- `messages` holds the Claude conversation exactly as sent and received
-- (append-only — earlier turns are never edited, which the model's
-- thinking blocks require). Token counters let us see real usage per
-- person before tuning the spend cap.

CREATE TABLE ai_draft_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id    uuid REFERENCES properties(id) ON DELETE SET NULL,
  event_id       uuid REFERENCES events(id) ON DELETE SET NULL,
  messages       jsonb NOT NULL DEFAULT '[]'::jsonb,
  turn_count     integer NOT NULL DEFAULT 0,
  input_tokens   integer NOT NULL DEFAULT 0,
  output_tokens  integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_draft_sessions_user ON ai_draft_sessions (user_id, created_at DESC);

ALTER TABLE ai_draft_sessions ENABLE ROW LEVEL SECURITY;

-- Helper users are admins and property managers (pilot decision,
-- 2026-11-03). Each person sees only their own conversations.
CREATE POLICY "ai_draft_sessions: own rows for helper roles"
  ON ai_draft_sessions FOR ALL
  USING (
    user_id = (SELECT auth.uid())
    AND (SELECT auth_role()) IN ('super_admin', 'admin', 'property_manager')
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (SELECT auth_role()) IN ('super_admin', 'admin', 'property_manager')
  );

-- ------------------------------------------------------------
-- Capability requests ("the builder can't do this yet")
-- ------------------------------------------------------------
--
-- Collected by the helper, reviewed by a developer. Frequent requests are
-- the pilot's warning sign: the developer should ask the business what's
-- missing and make it a default or template.

CREATE TABLE capability_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by  uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  property_id   uuid REFERENCES properties(id) ON DELETE SET NULL,
  event_id      uuid REFERENCES events(id) ON DELETE SET NULL,
  owner_words   text NOT NULL,
  summary       text NOT NULL,
  status        text NOT NULL DEFAULT 'new'
                CHECK (status IN ('new', 'reviewing', 'planned', 'built', 'declined')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_capability_requests_created ON capability_requests (created_at DESC);

ALTER TABLE capability_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "capability_requests: admin all"
  ON capability_requests FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "capability_requests: property_manager insert own"
  ON capability_requests FOR INSERT
  WITH CHECK (
    (SELECT auth_role()) = 'property_manager'
    AND requested_by = (SELECT auth.uid())
  );

CREATE POLICY "capability_requests: property_manager read own"
  ON capability_requests FOR SELECT
  USING (
    (SELECT auth_role()) = 'property_manager'
    AND requested_by = (SELECT auth.uid())
  );
