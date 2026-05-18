-- Phase 2: Booking System
-- booking_status_enum, bookings, booking_disciplines, booking_add_ons
--
-- BEFORE INSERT/UPDATE triggers on bookings are prefixed with numeric
-- ordinals to force the required alphabetical fire order:
--   00_compute_end_time      — populates end_time from start_time + duration
--   01_set_capacity_reserved — sets capacity from booking_type
--   02_validate_start_time   — checks slot against time_slots
--   03_check_property_capacity — sums concurrent capacity_reserved
-- Without the prefixes, alphabetical order would put check_capacity FIRST,
-- silently allowing host_an_occasion oversubscription, and end_time would
-- not be populated in time for the capacity range overlap check.
--
-- end_time is a regular NOT NULL column populated by trigger 00, NOT a
-- GENERATED column. Postgres treats timestamptz + interval as STABLE
-- (timezone-sensitive arithmetic), which it forbids in STORED generated
-- expressions. The trigger handles it cleanly and always overwrites any
-- caller-supplied value.
--
-- Uses tstzrange (not tsrange) throughout — bookings use timestamptz.

-- ============================================================
-- Enum
-- ============================================================

CREATE TYPE booking_status_enum AS ENUM (
  'pending_review',   -- slot reserved, staff notified, awaiting review
  'awaiting_guest',   -- staff confirmed/modified, guest can now sign + pay
  'denied',           -- staff rejected, slot released
  'signed',           -- waiver signed by guest
  'deposit_paid',     -- deposit collected via Stripe
  'fulfilled',        -- event completed
  'cancelled',        -- cancelled at any point after pending_review
  'expired'           -- awaiting_guest timed out without guest action
);

-- ============================================================
-- bookings
-- ============================================================

CREATE TABLE bookings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  uuid NOT NULL REFERENCES properties(id),

  -- Booking type and scheduling
  booking_type      booking_type_enum NOT NULL,
  start_time        timestamptz       NOT NULL,
  duration_hours    integer           NOT NULL,
  end_time          timestamptz       NOT NULL,  -- populated by trigger 00_compute_end_time
  instructor_id     uuid              REFERENCES instructors(id),
  capacity_reserved integer           NOT NULL DEFAULT 1
                    CHECK (capacity_reserved > 0),
  range             text,

  -- Guest
  guest_name        text              NOT NULL,
  guest_email       text              NOT NULL,
  guest_phone       text,
  guest_count       integer           NOT NULL DEFAULT 1 CHECK (guest_count > 0),
  guest_notes       text,
  audience_type     audience_type_enum NOT NULL,
  member_user_id    uuid              REFERENCES auth.users(id),
  concierge_user_id uuid              REFERENCES auth.users(id),

  -- Pricing
  estimated_price   numeric(10,2),
  confirmed_price   numeric(10,2),
  deposit_amount    numeric(10,2),

  -- Workflow
  status                    booking_status_enum NOT NULL DEFAULT 'pending_review',
  deposit_payment_intent_id text,
  balance_payment_intent_id text,
  hubspot_deal_id           text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- A booking cannot originate from both a member and a partner concierge
  CONSTRAINT one_origin
    CHECK (NOT (member_user_id IS NOT NULL AND concierge_user_id IS NOT NULL)),

  -- Private lessons must have an instructor
  CONSTRAINT private_lesson_requires_instructor
    CHECK (booking_type != 'private_lesson' OR instructor_id IS NOT NULL),

  -- Duration must be valid for the booking type
  CONSTRAINT duration_valid_for_type CHECK (
    (booking_type = 'plan_a_visit'      AND duration_hours = 2)
    OR (booking_type = 'private_lesson'   AND duration_hours BETWEEN 1 AND 3)
    OR (booking_type = 'host_an_occasion' AND duration_hours BETWEEN 2 AND 6)
  )
);

-- ============================================================
-- Trigger 0: compute end_time
-- Postgres rejects timestamptz + interval in a STORED generated column
-- because the arithmetic is STABLE (timezone-sensitive), not IMMUTABLE.
-- A BEFORE INSERT/UPDATE trigger sidesteps that and also ensures the
-- value cannot be set inconsistently by callers.
-- ============================================================

CREATE OR REPLACE FUNCTION compute_booking_end_time()
RETURNS TRIGGER AS $$
BEGIN
  NEW.end_time := NEW.start_time + (NEW.duration_hours * interval '1 hour');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_00_compute_end_time
  BEFORE INSERT OR UPDATE OF start_time, duration_hours ON bookings
  FOR EACH ROW EXECUTE FUNCTION compute_booking_end_time();

-- ============================================================
-- Trigger 1: set capacity_reserved on insert
-- (host_an_occasion gets full property capacity; others get 1)
-- ============================================================

CREATE OR REPLACE FUNCTION set_capacity_reserved()
RETURNS TRIGGER AS $$
DECLARE
  v_max integer;
BEGIN
  IF NEW.booking_type = 'host_an_occasion' THEN
    SELECT max_concurrent_groups INTO v_max
    FROM properties
    WHERE id = NEW.property_id;

    NEW.capacity_reserved := v_max;
  ELSE
    NEW.capacity_reserved := 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_01_set_capacity_reserved
  BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_capacity_reserved();

-- ============================================================
-- Trigger 2: validate start_time against time_slots
-- Prevents bookings at arbitrary times. Runs BEFORE INSERT OR UPDATE.
-- ============================================================

CREATE OR REPLACE FUNCTION validate_booking_start_time()
RETURNS TRIGGER AS $$
DECLARE
  v_timezone    text;
  v_day_of_week smallint;
  v_slot_start  time;
  v_slot_exists boolean;
BEGIN
  SELECT timezone INTO v_timezone
  FROM properties WHERE id = NEW.property_id;

  v_day_of_week := EXTRACT(DOW FROM NEW.start_time AT TIME ZONE v_timezone)::smallint;
  v_slot_start  := (NEW.start_time AT TIME ZONE v_timezone)::time;

  SELECT EXISTS (
    SELECT 1 FROM time_slots
    WHERE property_id = NEW.property_id
      AND day_of_week = v_day_of_week
      AND slot_start  = v_slot_start
      AND is_active   = true
  ) INTO v_slot_exists;

  IF NOT v_slot_exists THEN
    RAISE EXCEPTION
      'start_time % is not a valid booking slot for this property',
      NEW.start_time;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_02_validate_start_time
  BEFORE INSERT OR UPDATE OF start_time ON bookings
  FOR EACH ROW EXECUTE FUNCTION validate_booking_start_time();

-- ============================================================
-- Trigger 3: property capacity check
-- Sums capacity_reserved across concurrent active bookings.
-- Runs BEFORE INSERT OR UPDATE — after set_capacity_reserved.
-- ============================================================

CREATE OR REPLACE FUNCTION check_property_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_concurrent integer;
  v_max        integer;
BEGIN
  -- Released statuses do not hold capacity
  IF NEW.status IN ('cancelled', 'expired', 'denied') THEN
    RETURN NEW;
  END IF;

  SELECT max_concurrent_groups INTO v_max
  FROM properties WHERE id = NEW.property_id
  FOR UPDATE;

  SELECT COALESCE(SUM(capacity_reserved), 0) INTO v_concurrent
  FROM bookings
  WHERE property_id = NEW.property_id
    AND status NOT IN ('cancelled', 'expired', 'denied')
    AND tstzrange(start_time, end_time, '[)') && tstzrange(NEW.start_time, NEW.end_time, '[)')
    AND id IS DISTINCT FROM NEW.id;

  IF v_concurrent + NEW.capacity_reserved > v_max THEN
    RAISE EXCEPTION
      'property is at capacity for the requested time window (% of % units in use)',
      v_concurrent, v_max;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_03_check_property_capacity
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION check_property_capacity();

-- ============================================================
-- Trigger 4: updated_at
-- ============================================================

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- Instructor exclusion constraint
-- Prevents two active bookings from overlapping on the same instructor.
-- btree_gist extension enabled in Phase 1.
-- ============================================================

ALTER TABLE bookings ADD CONSTRAINT no_instructor_overlap
  EXCLUDE USING gist (
    instructor_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (
    instructor_id IS NOT NULL
    AND status NOT IN ('cancelled', 'expired', 'denied')
  );

-- ============================================================
-- Indexes
-- ============================================================

-- Primary availability query: active bookings at a property in a time range
CREATE INDEX idx_bookings_property_time
  ON bookings (property_id, status)
  WHERE status NOT IN ('cancelled', 'expired', 'denied');

-- Instructor schedule lookups
CREATE INDEX idx_bookings_instructor
  ON bookings (instructor_id, start_time)
  WHERE instructor_id IS NOT NULL;

-- Member portal: "my bookings"
CREATE INDEX idx_bookings_member_user
  ON bookings (member_user_id, created_at DESC)
  WHERE member_user_id IS NOT NULL;

-- Partner portal: "bookings I created"
CREATE INDEX idx_bookings_concierge
  ON bookings (concierge_user_id, created_at DESC)
  WHERE concierge_user_id IS NOT NULL;

-- Admin list view: property + status + recency
CREATE INDEX idx_bookings_admin_list
  ON bookings (property_id, status, created_at DESC);

-- HubSpot sync lookups
CREATE INDEX idx_bookings_hubspot
  ON bookings (hubspot_deal_id)
  WHERE hubspot_deal_id IS NOT NULL;

-- Stripe payment lookups — UNIQUE to prevent a single Stripe PaymentIntent
-- from being attached to two bookings (safety net for webhook idempotency).
CREATE UNIQUE INDEX idx_bookings_deposit_intent
  ON bookings (deposit_payment_intent_id)
  WHERE deposit_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX idx_bookings_balance_intent
  ON bookings (balance_payment_intent_id)
  WHERE balance_payment_intent_id IS NOT NULL;

-- ============================================================
-- RLS on bookings
-- Public writes use service role (Server Actions) — no INSERT/DELETE policy needed.
-- ============================================================

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings: admin read all"
  ON bookings FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
  );

CREATE POLICY "bookings: property_manager read"
  ON bookings FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'property_manager'
    AND property_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid)
  );

CREATE POLICY "bookings: concierge read own"
  ON bookings FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'concierge'
    AND concierge_user_id = (SELECT auth.uid())
  );

CREATE POLICY "bookings: partner read own"
  ON bookings FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'partner'
    AND concierge_user_id = (SELECT auth.uid())
  );

CREATE POLICY "bookings: member read own"
  ON bookings FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'member'
    AND member_user_id = (SELECT auth.uid())
  );

-- Staff updates — this policy controls WHICH rows each role can update (e.g.
-- property_manager limited to their property). It does NOT control which
-- columns they can change — Postgres RLS is row-level only. Column-level
-- restrictions (e.g. property_manager may change status/range/confirmed_price
-- but not guest_email or property_id) are enforced inside service-role
-- Server Actions, which validate the payload before issuing the UPDATE.
-- Do not expose direct user-scoped UPDATE access to bookings from the client.
CREATE POLICY "bookings: staff update"
  ON bookings FOR UPDATE
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role')
    IN ('super_admin', 'admin', 'property_manager')
    AND (
      (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
      OR property_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid)
    )
  );

-- ============================================================
-- booking_disciplines
-- ============================================================

CREATE TABLE booking_disciplines (
  booking_id uuid NOT NULL REFERENCES bookings(id)  ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id),
  PRIMARY KEY (booking_id, service_id)
);

CREATE INDEX idx_booking_disciplines_service ON booking_disciplines (service_id);

ALTER TABLE booking_disciplines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_disciplines: admin read"
  ON booking_disciplines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "booking_disciplines: property_manager read"
  ON booking_disciplines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'property_manager'
        AND b.property_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid)
    )
  );

CREATE POLICY "booking_disciplines: member read own"
  ON booking_disciplines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND b.member_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "booking_disciplines: partner read own"
  ON booking_disciplines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND b.concierge_user_id = (SELECT auth.uid())
    )
  );

-- Writes are service role only

-- ============================================================
-- booking_add_ons
-- ============================================================

CREATE TABLE booking_add_ons (
  id         uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid          NOT NULL REFERENCES bookings(id)  ON DELETE CASCADE,
  service_id uuid          NOT NULL REFERENCES services(id),
  add_on_id  uuid          NOT NULL REFERENCES add_ons(id),
  quantity   integer       NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_at_booking numeric(10,2) NOT NULL,

  -- Enforces the add_on is valid for the chosen service
  CONSTRAINT fk_valid_service_add_on
    FOREIGN KEY (service_id, add_on_id)
    REFERENCES service_add_ons (service_id, add_on_id)
);

CREATE INDEX idx_booking_add_ons_booking ON booking_add_ons (booking_id);

-- Enforce that the service_id on each add-on row is one of the disciplines
-- selected on the same booking. The composite FK to service_add_ons already
-- guarantees the (service_id, add_on_id) pairing exists in the catalog —
-- this closes the remaining hole where a guest could attach an add-on for
-- a service they did not actually book.
--
-- Deferred to COMMIT so the application can insert booking_disciplines and
-- booking_add_ons rows in either order within the same transaction.
CREATE OR REPLACE FUNCTION check_booking_add_on_discipline()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM booking_disciplines
    WHERE booking_id = NEW.booking_id
      AND service_id = NEW.service_id
  ) THEN
    RAISE EXCEPTION
      'booking_add_ons.service_id % is not one of the disciplines selected on booking %',
      NEW.service_id, NEW.booking_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER booking_add_ons_check_discipline
  AFTER INSERT OR UPDATE ON booking_add_ons
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_booking_add_on_discipline();

ALTER TABLE booking_add_ons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_add_ons: admin read"
  ON booking_add_ons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "booking_add_ons: property_manager read"
  ON booking_add_ons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'property_manager'
        AND b.property_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid)
    )
  );

CREATE POLICY "booking_add_ons: member read own"
  ON booking_add_ons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.member_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "booking_add_ons: partner read own"
  ON booking_add_ons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.concierge_user_id = (SELECT auth.uid())
    )
  );

-- Writes are service role only
