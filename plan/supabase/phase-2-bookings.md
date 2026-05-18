# Phase 2 — The Booking System

## Prerequisites

- Phase 1 complete (`properties`, `time_slots`, `services`, `add_ons`, `service_add_ons`, `instructors`)
- `btree_gist` extension enabled (done in Phase 1)
- `booking_type_enum` and `audience_type_enum` created (done in Phase 1)

## What This Phase Builds

`booking_status_enum`, `bookings`, `booking_disciplines`, `booking_add_ons`

Plus: 5 trigger functions, the instructor exclusion constraint, and all supporting indexes.

---

## Migration

### Step 1 — Status enum

```sql
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
```

### Step 2 — `bookings`

```sql
CREATE TABLE bookings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  uuid NOT NULL REFERENCES properties(id),

  -- Booking type and scheduling
  booking_type      booking_type_enum NOT NULL,
  start_time        timestamptz       NOT NULL,
  duration_hours    integer           NOT NULL,
  end_time          timestamptz       NOT NULL,  -- populated by trigger bookings_00_compute_end_time
  instructor_id     uuid              REFERENCES instructors(id),
  capacity_reserved integer           NOT NULL DEFAULT 1
                    CHECK (capacity_reserved > 0),
  range             text,  -- soft field, team-assigned post-booking

  -- Guest
  guest_name        text          NOT NULL,
  guest_email       text          NOT NULL,
  guest_phone       text,
  guest_count       integer       NOT NULL DEFAULT 1 CHECK (guest_count > 0),
  guest_notes       text,
  audience_type     audience_type_enum NOT NULL,
  member_user_id    uuid          REFERENCES auth.users(id),
  concierge_user_id uuid          REFERENCES auth.users(id),

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

  -- A booking cannot be from both a member and a partner concierge simultaneously
  CONSTRAINT one_origin
    CHECK (NOT (member_user_id IS NOT NULL AND concierge_user_id IS NOT NULL)),

  -- Private lessons must have an instructor
  CONSTRAINT private_lesson_requires_instructor
    CHECK (booking_type != 'private_lesson' OR instructor_id IS NOT NULL),

  -- Duration must be valid for the booking type
  CONSTRAINT duration_valid_for_type CHECK (
    (booking_type = 'plan_a_visit'    AND duration_hours = 2)
    OR (booking_type = 'private_lesson' AND duration_hours BETWEEN 1 AND 3)
    OR (booking_type = 'host_an_occasion' AND duration_hours BETWEEN 2 AND 6)
  )
);
```

### Step 2.5 — Trigger: compute `end_time`

`end_time` is a regular `NOT NULL` column, not a `GENERATED` column. Postgres treats `timestamptz + interval` as `STABLE` (the result depends on the session `TimeZone` GUC), and `GENERATED ALWAYS AS … STORED` requires an `IMMUTABLE` expression — so the obvious generated-column form is rejected at `CREATE TABLE` time.

A `BEFORE INSERT OR UPDATE` trigger sidesteps the restriction *and* doubles as protection against callers supplying an inconsistent `end_time` — the trigger always recomputes from `start_time + duration_hours`. The numeric prefix `00_` keeps it alphabetically ahead of the other BEFORE triggers, so `end_time` is populated before the capacity check reads it.

```sql
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
```

### Step 3 — Trigger: set `capacity_reserved` on insert

`host_an_occasion` bookings require exclusive use of the property. This trigger reads `max_concurrent_groups` from `properties` and sets `capacity_reserved` accordingly. Application code must never write this field directly.

```sql
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
```

### Step 4 — Trigger: validate `start_time` against `time_slots`

Prevents bookings at arbitrary times (e.g. 9:17 AM). Extracts the local time from the UTC `start_time` using the property's timezone, then checks it against `time_slots`.

```sql
CREATE OR REPLACE FUNCTION validate_booking_start_time()
RETURNS TRIGGER AS $$
DECLARE
  v_timezone     text;
  v_day_of_week  smallint;
  v_slot_start   time;
  v_slot_exists  boolean;
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
```

### Step 5 — Trigger: property capacity check

Runs on every insert and every status-changing update. Sums `capacity_reserved` across all concurrent active bookings at the property. Rejects the insert/update if capacity would be exceeded.

`denied`, `cancelled`, and `expired` are excluded — those statuses release the hold.

```sql
CREATE OR REPLACE FUNCTION check_property_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_concurrent integer;
  v_max        integer;
BEGIN
  -- Released statuses do not hold capacity — skip the check
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
```

### Step 6 — Instructor exclusion constraint

Prevents two active bookings with the same instructor from overlapping in time. Uses the `btree_gist` extension to index `tsrange`. The partial `WHERE` clause excludes released statuses so they don't block future bookings.

```sql
ALTER TABLE bookings ADD CONSTRAINT no_instructor_overlap
  EXCLUDE USING gist (
    instructor_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (
    instructor_id IS NOT NULL
    AND status NOT IN ('cancelled', 'expired', 'denied')
  );
```

### Step 7 — `updated_at` trigger

```sql
CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
```

### Step 8 — Indexes

```sql
-- Primary availability query: find all active bookings at a property within a time range
-- Used by the capacity trigger and the calendar UI
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
-- from being associated with two bookings (defense-in-depth for webhook handlers)
CREATE UNIQUE INDEX idx_bookings_deposit_intent
  ON bookings (deposit_payment_intent_id)
  WHERE deposit_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX idx_bookings_balance_intent
  ON bookings (balance_payment_intent_id)
  WHERE balance_payment_intent_id IS NOT NULL;
```

### Step 9 — RLS on `bookings`

All public writes (the checkout Server Action) use the Supabase service role key and bypass RLS entirely. The policies below govern authenticated reads and staff writes.

```sql
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- super_admin and admin: all bookings across all properties
CREATE POLICY "bookings: admin read all"
  ON bookings FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
  );

-- property_manager: bookings for their assigned property
CREATE POLICY "bookings: property_manager read"
  ON bookings FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'property_manager'
    AND property_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid)
  );

-- internal concierge: bookings they own
CREATE POLICY "bookings: concierge read own"
  ON bookings FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'concierge'
    AND concierge_user_id = (SELECT auth.uid())
  );

-- partner concierge: bookings they created
CREATE POLICY "bookings: partner read own"
  ON bookings FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'partner'
    AND concierge_user_id = (SELECT auth.uid())
  );

-- member: their own bookings only
CREATE POLICY "bookings: member read own"
  ON bookings FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'member'
    AND member_user_id = (SELECT auth.uid())
  );

-- Staff updates — this policy controls WHICH rows each role can update (e.g.
-- property_manager is limited to bookings at their assigned property). It does
-- NOT control which columns they can change — Postgres RLS is row-level only.
-- Column-level restrictions (e.g. property_manager may change status, range,
-- confirmed_price but not guest_email or property_id) are enforced inside the
-- service-role Server Actions, which validate the payload before issuing the
-- UPDATE. Do not expose direct, user-scoped UPDATE access to bookings from the
-- client; all staff writes must go through a Server Action.
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

-- No direct INSERT or DELETE via RLS — all writes go through service role Server Actions
```

### Step 10 — `booking_disciplines`

```sql
CREATE TABLE booking_disciplines (
  booking_id  uuid NOT NULL REFERENCES bookings(id)  ON DELETE CASCADE,
  service_id  uuid NOT NULL REFERENCES services(id),
  PRIMARY KEY (booking_id, service_id)
);

CREATE INDEX idx_booking_disciplines_service ON booking_disciplines (service_id);

ALTER TABLE booking_disciplines ENABLE ROW LEVEL SECURITY;

-- Readable if you can read the parent booking — mirror the bookings policies
-- In practice: staff see all, members/partners see their own via the booking join

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
```

### Step 11 — `booking_add_ons`

The FK `(service_id, add_on_id) REFERENCES service_add_ons(service_id, add_on_id)` enforces that a guest can only select add-ons that are configured for their chosen discipline. No trigger needed — the composite FK handles it.

```sql
CREATE TABLE booking_add_ons (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   uuid          NOT NULL REFERENCES bookings(id)  ON DELETE CASCADE,
  service_id   uuid          NOT NULL REFERENCES services(id),
  add_on_id    uuid          NOT NULL REFERENCES add_ons(id),
  quantity     integer       NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_at_booking numeric(10,2) NOT NULL,

  -- Enforces the add_on is valid for the service — composite FK to service_add_ons PK
  CONSTRAINT fk_valid_service_add_on
    FOREIGN KEY (service_id, add_on_id)
    REFERENCES service_add_ons (service_id, add_on_id)
);

CREATE INDEX idx_booking_add_ons_booking ON booking_add_ons (booking_id);

-- Enforce that the service_id on each add-on row is one of the disciplines
-- selected on the same booking. The composite FK to service_add_ons already
-- guarantees the (service_id, add_on_id) pairing exists in the catalog — this
-- trigger closes the remaining hole where a guest could attach an add-on for
-- a service they did not actually book.
--
-- Deferred to COMMIT time so the application can insert booking_disciplines
-- and booking_add_ons in either order within the same transaction.
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

-- Mirror booking_disciplines policies: readable by whoever can see the parent booking
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
```

---

## Notes

**`end_time` is trigger-populated, not a generated column** — the obvious shape (`GENERATED ALWAYS AS (start_time + duration_hours * interval '1 hour') STORED`) is rejected by Postgres at `CREATE TABLE` time with `generation expression is not immutable`. `timestamptz + interval` is `STABLE` (the operator's volatility reflects timezone sensitivity), and `STORED` generated columns require an `IMMUTABLE` expression. We work around this with the `bookings_00_compute_end_time` BEFORE trigger, which (a) always recomputes from `start_time + duration_hours`, overwriting any caller-supplied value, and (b) runs alphabetically first so the capacity check and exclusion constraint see a populated `end_time`. Functionally equivalent to a generated column for our purposes; differs only in that callers technically *could* pass an `end_time` on INSERT — the trigger immediately overrides it.

**Trigger ordering** — Postgres fires `BEFORE` triggers in alphabetical order of trigger name when multiple exist on the same table and event. The numeric prefixes force the required order:
1. `bookings_01_set_capacity_reserved` runs first — sets `capacity_reserved` based on `booking_type`
2. `bookings_02_validate_start_time` runs second — validates the time slot
3. `bookings_03_check_property_capacity` runs third — uses the now-correct `capacity_reserved`

Without the prefixes, alphabetical order would be `check` < `set` < `validate`, and the capacity check would read `capacity_reserved` before `set_capacity_reserved` had a chance to populate it — silently allowing oversubscription on `host_an_occasion` bookings. Do not rename without preserving the order.

**Instructor exclusion constraint vs. capacity trigger** — These are independent checks. A booking can pass the capacity trigger (property has room) but fail the exclusion constraint (instructor is double-booked). Both must pass for the insert to succeed. The constraint fires as a post-trigger index check; the trigger fires as a BEFORE trigger. Both prevent the insert — the error messages are different.

**Money as `numeric(10,2)`** — Never `float` or `real` for monetary values. `numeric` is exact decimal arithmetic. `10,2` supports up to $99,999,999.99 — sufficient for any booking or event pricing.

**Service role for public writes** — The checkout Server Action creates the booking and bid in one transaction using `SUPABASE_SECRET_KEY`. This key must never be exposed client-side. The `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is for read-only public queries (available slots, services, etc.) and authenticated user reads (member portal, partner portal).

**`booking_disciplines` and `booking_add_ons` RLS** — The EXISTS subquery on `bookings` is correct but adds a join on every row read. For high-volume admin list views, use the service role client on the server side instead of relying on RLS joins. RLS is the safety net; the application should use the appropriate key for each access pattern.

**Status transitions** — The application is responsible for enforcing valid status transitions (e.g., you cannot go from `fulfilled` back to `pending_review`). The database does not enforce the state machine graph — it only stores the current status. If invalid transitions are a concern, add a trigger that validates `OLD.status → NEW.status` against an allowed-transitions table.
