-- Phase 3: Bids
--
-- The customer-facing artifact of a booking. Created together with the
-- booking in one transaction at checkout — there is never a booking
-- without a bid. The bid carries the permanent URL the guest receives,
-- the access code that gates the page, and the workflow status that
-- drives Dropbox Sign and Stripe.
--
-- Live status updates on the public bid page use HTTP polling against
-- a service-role Route Handler, not Supabase Realtime — see
-- plan/supabase/phase-3-bids.md Step 9.
--
-- Public bid page authorization: slug identifies the bid; the access
-- code (6-char alphanumeric) is the secret. The Server Action generates
-- the plaintext, hashes it with bcrypt via pgcrypto's
-- extensions.crypt(code, extensions.gen_salt('bf')), and stores only
-- the hash. validate_bid_access_code() is SECURITY DEFINER so the
-- anonymous public page can call it without RLS read access to bids.

-- ============================================================
-- Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Status enum
-- ============================================================

CREATE TYPE bid_status_enum AS ENUM (
  'pending_review',  -- created at checkout, staff notified
  'confirmed',       -- staff approved, guest can sign + pay
  'denied',          -- staff rejected, booking slot released
  'signed',          -- waiver signed via Dropbox Sign
  'paid',            -- deposit received via Stripe
  'expired'          -- confirmed/signed but timed out without completion
);

-- ============================================================
-- Slug generation function
-- ============================================================
-- Runs inside the database to keep race-handling in one place.
-- Loops until a unique slug is found; the surrounding UNIQUE constraint
-- on bids.slug is the final safety net if two callers race.

CREATE OR REPLACE FUNCTION generate_bid_slug(
  p_guest_name text,
  p_start_time timestamptz
)
RETURNS text AS $$
DECLARE
  v_base      text;
  v_candidate text;
  v_suffix    integer := 0;
  v_taken     boolean;
BEGIN
  -- Normalize: lowercase, replace non-alphanumeric runs with a hyphen, trim edges
  v_base := lower(regexp_replace(p_guest_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := trim(both '-' from v_base);

  -- Append booking date (YYYY-MM-DD, in session timezone — Supabase defaults to UTC)
  v_base := v_base || '-' || to_char(p_start_time, 'YYYY-MM-DD');

  v_candidate := v_base;

  LOOP
    SELECT EXISTS (SELECT 1 FROM bids WHERE slug = v_candidate) INTO v_taken;
    EXIT WHEN NOT v_taken;
    v_suffix    := v_suffix + 1;
    v_candidate := v_base || '-' || v_suffix;
  END LOOP;

  RETURN v_candidate;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- bids table
-- ============================================================

CREATE TABLE bids (
  id                uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        uuid   NOT NULL UNIQUE REFERENCES bookings(id),
  slug              text   NOT NULL UNIQUE,
  status            bid_status_enum NOT NULL DEFAULT 'pending_review',

  -- Guest-facing access code (bcrypt hash; plaintext is shown once at
  -- confirmation and emailed). Server Action generates the plaintext,
  -- hashes it with extensions.crypt(code, gen_salt('bf')), inserts the
  -- hash here. The plaintext is never stored. Lost codes require regen.
  access_code_hash  text   NOT NULL,

  -- Content assembled by staff before confirming
  staff_notes       text,
  schedule_notes    text,
  gear_list         jsonb  NOT NULL DEFAULT '[]'::jsonb,
  faq               jsonb  NOT NULL DEFAULT '[]'::jsonb,

  -- E-sign
  dropbox_sign_envelope_id text,
  signed_at                timestamptz,

  -- Expiry (set when status transitions pending_review → confirmed)
  expires_at        timestamptz,

  -- Cancellation and denial
  cancelled_at             timestamptz,
  denial_reason            text,
  refund_amount            numeric(10,2),
  refund_payment_intent_id text,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Access code validation function
-- ============================================================
-- SECURITY DEFINER so the anonymous bid page (which has no RLS read
-- access to bids) can call it without exposing the table. Always runs
-- the bcrypt verify against a dummy hash when no bid matches the slug,
-- so timing does not leak slug existence. Granted to anon + authenticated
-- + service_role.

CREATE OR REPLACE FUNCTION validate_bid_access_code(
  p_slug text,
  p_code text
)
RETURNS SETOF bids
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM extensions.crypt(p_code, '$2a$10$DummyDummyDummyDummyDuOJ8wzGqdtu1.JBxa/h8.7s5dyZqr5h.W');

  RETURN QUERY
  SELECT * FROM bids
  WHERE slug = p_slug
    AND access_code_hash = extensions.crypt(p_code, access_code_hash);
END;
$$;

REVOKE ALL ON FUNCTION validate_bid_access_code(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validate_bid_access_code(text, text) TO anon, authenticated, service_role;

-- ============================================================
-- Trigger: auto-generate slug on insert
-- ============================================================
-- If the application passes an explicit slug (staff override), use it.
-- Otherwise derive from the parent booking's guest_name and start_time.

CREATE OR REPLACE FUNCTION set_bid_slug()
RETURNS TRIGGER AS $$
DECLARE
  v_booking bookings%ROWTYPE;
BEGIN
  IF NEW.slug IS NULL OR trim(NEW.slug) = '' THEN
    SELECT * INTO v_booking FROM bookings WHERE id = NEW.booking_id;
    NEW.slug := generate_bid_slug(v_booking.guest_name, v_booking.start_time);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bids_set_slug
  BEFORE INSERT ON bids
  FOR EACH ROW EXECUTE FUNCTION set_bid_slug();

-- ============================================================
-- Trigger: set expires_at on confirmation
-- ============================================================
-- Only the pending_review → confirmed transition arms the expiry clock.
-- Guarding against OLD.status explicitly prevents weird transitions
-- (e.g., paid → confirmed) from silently re-setting expires_at.

CREATE OR REPLACE FUNCTION set_bid_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status = 'pending_review' THEN
    NEW.expires_at := now() + interval '7 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bids_set_expiry
  BEFORE UPDATE OF status ON bids
  FOR EACH ROW EXECUTE FUNCTION set_bid_expiry();

-- ============================================================
-- Trigger: sync booking status when bid status changes
-- ============================================================
-- Bid status is the source of truth for the workflow. The trigger maps
-- bid status transitions to the parent booking's status. RAISEs if the
-- booking is not in the expected source state — silent no-op would
-- cause bid/booking drift that's much harder to debug than a clear
-- error at the offending UPDATE.

CREATE OR REPLACE FUNCTION sync_booking_from_bid()
RETURNS TRIGGER AS $$
DECLARE
  v_rows int;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'confirmed' THEN
      UPDATE bookings
      SET status = 'awaiting_guest', updated_at = now()
      WHERE id = NEW.booking_id AND status = 'pending_review';

    WHEN 'denied' THEN
      UPDATE bookings
      SET status = 'denied', updated_at = now()
      WHERE id = NEW.booking_id AND status = 'pending_review';

    WHEN 'signed' THEN
      UPDATE bookings
      SET status = 'signed', updated_at = now()
      WHERE id = NEW.booking_id AND status = 'awaiting_guest';

    WHEN 'paid' THEN
      UPDATE bookings
      SET status = 'deposit_paid', updated_at = now()
      WHERE id = NEW.booking_id AND status = 'signed';

    WHEN 'expired' THEN
      UPDATE bookings
      SET status = 'expired', updated_at = now()
      WHERE id = NEW.booking_id AND status IN ('awaiting_guest', 'signed');

    ELSE
      RETURN NEW;  -- pending_review on UPDATE — no sync defined
  END CASE;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION
      'sync_booking_from_bid: bid % moved to % but its booking % was not in the expected source state',
      NEW.id, NEW.status, NEW.booking_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bids_sync_booking_status
  AFTER UPDATE OF status ON bids
  FOR EACH ROW EXECUTE FUNCTION sync_booking_from_bid();

-- ============================================================
-- updated_at trigger
-- ============================================================

CREATE TRIGGER bids_updated_at
  BEFORE UPDATE ON bids
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- Indexes
-- ============================================================
-- Note: UNIQUE on slug at the column level already creates the slug
-- lookup index (as bids_slug_key). No explicit slug index needed.

-- Inngest expiry workflow: find bids that have passed their deadline
CREATE INDEX idx_bids_expiry
  ON bids (expires_at)
  WHERE expires_at IS NOT NULL AND status IN ('confirmed', 'signed');

-- Dropbox Sign webhook: find bid by envelope ID.
-- UNIQUE so a single envelope can't be attached to two bids if a
-- webhook double-fires or the Inngest worker retries.
CREATE UNIQUE INDEX idx_bids_dropbox
  ON bids (dropbox_sign_envelope_id)
  WHERE dropbox_sign_envelope_id IS NOT NULL;

-- Stripe refund intent: same idempotency rationale as payment intent
-- indexes on bookings in Phase 2.
CREATE UNIQUE INDEX idx_bids_refund_intent
  ON bids (refund_payment_intent_id)
  WHERE refund_payment_intent_id IS NOT NULL;

-- Admin list: bids by status recency
CREATE INDEX idx_bids_status_created ON bids (status, created_at DESC);

-- ============================================================
-- RLS
-- ============================================================
-- The public bid page (/bid/[slug]) fetches via service-role; anon has
-- no read access here. The policies below govern authenticated reads
-- (admin / property_manager / concierge / partner / member portals).
-- All auth.jwt() / auth.uid() calls wrapped in (SELECT …) for InitPlan.

ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bids: admin read"
  ON bids FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
  );

CREATE POLICY "bids: property_manager read"
  ON bids FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'property_manager'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND b.property_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid)
    )
  );

CREATE POLICY "bids: concierge read own"
  ON bids FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'concierge'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.concierge_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "bids: partner read own"
  ON bids FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'partner'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.concierge_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "bids: member read own"
  ON bids FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'member'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.member_user_id = (SELECT auth.uid())
    )
  );

-- Staff can update bid content and status. property_manager is scoped
-- to bids whose underlying booking is at their assigned property.
CREATE POLICY "bids: staff update"
  ON bids FOR UPDATE
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
    OR (
      (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'property_manager'
      AND EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.id = booking_id
          AND b.property_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid)
      )
    )
  );
