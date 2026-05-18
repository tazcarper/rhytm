# Phase 1 — Foundation Tables

## Prerequisites

- Supabase project created, connection pooler on port 6543 configured
- `btree_gist` extension enabled (needed in Phase 2 — enable here to keep extensions together)
- Vercel region and Supabase region matched
- All secrets in Vercel environment variables

## What This Phase Builds

`properties`, `time_slots`, `services`, `add_ons`, `service_add_ons`, `instructors`, `pricing_rules`

These tables have no dependencies on any other application tables. Every subsequent phase either depends on these or extends them.

---

## Migration

### Step 1 — Extensions

```sql
-- Required for the instructor exclusion constraint in Phase 2
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Required if using moddatetime for updated_at triggers (optional — we use a custom function instead)
-- CREATE EXTENSION IF NOT EXISTS moddatetime;
```

### Step 2 — Shared trigger function

Define once here. Every table with an `updated_at` column uses this trigger.

```sql
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Step 3 — `properties`

```sql
CREATE TABLE properties (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  slug        text        NOT NULL UNIQUE,  -- e.g. 'horseshoe-bay', 'hog-heaven', 'packsaddle'
  timezone    text        NOT NULL DEFAULT 'America/Chicago',
  max_concurrent_groups integer NOT NULL DEFAULT 1
                          CHECK (max_concurrent_groups > 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Anyone can read properties (needed for the public booking form to know what exists)
CREATE POLICY "properties: public read"
  ON properties FOR SELECT USING (true);

-- Only super_admin / admin can write
CREATE POLICY "properties: admin write"
  ON properties FOR ALL
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));
```

**Seed immediately after creating the table — every other table depends on these IDs.**

```sql
INSERT INTO properties (name, slug, timezone, max_concurrent_groups) VALUES
  ('Horseshoe Bay Sporting Club', 'horseshoe-bay', 'America/Chicago', 1),  -- update max_concurrent_groups from Q2
  ('Hog Heaven Sporting Club',   'hog-heaven',    'America/Chicago', 1),
  ('Packsaddle Precision',       'packsaddle',    'America/Chicago', 1);
```

### Step 4 — `time_slots`

Valid booking start times per property per day of week. This is a whitelist — the UI reads it to build the calendar picker, and a trigger in Phase 2 validates that every booking's `start_time` matches a row here.

```sql
CREATE TABLE time_slots (
  id           uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  uuid     NOT NULL REFERENCES properties(id),
  day_of_week  smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0 = Sunday
  slot_start   time     NOT NULL,  -- e.g. '09:00:00'
  is_active    boolean  NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (property_id, day_of_week, slot_start)
);

CREATE INDEX idx_time_slots_lookup
  ON time_slots (property_id, day_of_week, is_active);

ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;

-- Anon users need to read active slots to display the booking calendar
CREATE POLICY "time_slots: public read active"
  ON time_slots FOR SELECT
  USING (is_active = true);

-- Admins can read all (including inactive) for management UI
CREATE POLICY "time_slots: admin read all"
  ON time_slots FOR SELECT
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));

CREATE POLICY "time_slots: admin write"
  ON time_slots FOR ALL
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));
```

**Seed blocked by client confirmation of operating hours per property.** Placeholder format:

```sql
-- Example: HSB weekdays (Mon–Fri = 1–5), 9 AM to 3 PM on the hour
INSERT INTO time_slots (property_id, day_of_week, slot_start)
SELECT
  p.id,
  d.dow,
  t.slot::time
FROM properties p
CROSS JOIN (VALUES (1),(2),(3),(4),(5)) AS d(dow)
CROSS JOIN (VALUES ('09:00'),('10:00'),('11:00'),('12:00'),('13:00'),('14:00'),('15:00')) AS t(slot)
WHERE p.slug = 'horseshoe-bay';

-- Example: HSB weekends (Sat=6, Sun=0), 8 AM to 4 PM
INSERT INTO time_slots (property_id, day_of_week, slot_start)
SELECT
  p.id,
  d.dow,
  t.slot::time
FROM properties p
CROSS JOIN (VALUES (0),(6)) AS d(dow)
CROSS JOIN (VALUES ('08:00'),('09:00'),('10:00'),('11:00'),('12:00'),('13:00'),('14:00'),('15:00'),('16:00')) AS t(slot)
WHERE p.slug = 'horseshoe-bay';
```

### Step 5 — `services`

```sql
CREATE TABLE services (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   uuid    NOT NULL REFERENCES properties(id),
  name          text    NOT NULL,
  description   text,
  is_active     boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_services_property ON services (property_id, is_active, display_order);

CREATE TRIGGER services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Public can read active services (needed to build the discipline selection in the booking form)
CREATE POLICY "services: public read active"
  ON services FOR SELECT
  USING (is_active = true);

CREATE POLICY "services: admin read all"
  ON services FOR SELECT
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));

CREATE POLICY "services: admin write"
  ON services FOR ALL
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));
```

**Seed blocked by Q4** (full discipline catalog for Hog Heaven and Packsaddle). HSB disciplines from existing materials can be seeded immediately.

### Step 6 — `add_ons`

Same structure as `services`. Each property owns its own add-on catalog independently — no cross-property sharing is assumed even if names match.

```sql
CREATE TABLE add_ons (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   uuid          NOT NULL REFERENCES properties(id),
  name          text          NOT NULL,
  description   text,
  price         numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  is_active     boolean       NOT NULL DEFAULT true,
  display_order integer       NOT NULL DEFAULT 0,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_add_ons_property ON add_ons (property_id, is_active, display_order);

CREATE TRIGGER add_ons_updated_at
  BEFORE UPDATE ON add_ons
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE add_ons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "add_ons: public read active"
  ON add_ons FOR SELECT
  USING (is_active = true);

CREATE POLICY "add_ons: admin read all"
  ON add_ons FOR SELECT
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));

CREATE POLICY "add_ons: admin write"
  ON add_ons FOR ALL
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));
```

### Step 7 — `service_add_ons`

Defines which add-ons are available for which disciplines at a property. A "drink cart" that applies to all disciplines gets one row per service. An "ammunition package" that only applies to sporting clays gets one row.

The FK to `service_add_ons(service_id, add_on_id)` from `booking_add_ons` (Phase 2) enforces that a guest can only select add-ons that are actually configured for their chosen discipline — no trigger needed in that direction.

The same-property constraint (a service and its add-on must belong to the same property) is enforced here via a trigger, since Postgres cannot express this with a FK alone.

```sql
CREATE TABLE service_add_ons (
  service_id  uuid NOT NULL REFERENCES services(id)  ON DELETE CASCADE,
  add_on_id   uuid NOT NULL REFERENCES add_ons(id)   ON DELETE CASCADE,
  PRIMARY KEY (service_id, add_on_id)
);

-- Enforce that service and add_on belong to the same property
CREATE OR REPLACE FUNCTION check_service_add_on_property()
RETURNS TRIGGER AS $$
DECLARE
  v_service_property uuid;
  v_addon_property   uuid;
BEGIN
  SELECT property_id INTO v_service_property FROM services  WHERE id = NEW.service_id;
  SELECT property_id INTO v_addon_property   FROM add_ons   WHERE id = NEW.add_on_id;

  IF v_service_property IS DISTINCT FROM v_addon_property THEN
    RAISE EXCEPTION 'service_id and add_on_id must belong to the same property';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER service_add_ons_same_property
  BEFORE INSERT OR UPDATE ON service_add_ons
  FOR EACH ROW EXECUTE FUNCTION check_service_add_on_property();

ALTER TABLE service_add_ons ENABLE ROW LEVEL SECURITY;

-- Public can read (needed to map disciplines to available add-ons in the booking form)
CREATE POLICY "service_add_ons: public read"
  ON service_add_ons FOR SELECT USING (true);

CREATE POLICY "service_add_ons: admin write"
  ON service_add_ons FOR ALL
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));
```

### Step 8 — `instructors`

```sql
CREATE TABLE instructors (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  uuid    NOT NULL REFERENCES properties(id),
  name         text    NOT NULL,
  bio          text,
  photo_url    text,
  is_active    boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_instructors_property ON instructors (property_id, is_active);

CREATE TRIGGER instructors_updated_at
  BEFORE UPDATE ON instructors
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;

-- Public can read active instructors (shown in the private lesson booking form)
CREATE POLICY "instructors: public read active"
  ON instructors FOR SELECT
  USING (is_active = true);

CREATE POLICY "instructors: admin read all"
  ON instructors FOR SELECT
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));

-- Admins and property managers can write instructors for their property
CREATE POLICY "instructors: admin write"
  ON instructors FOR ALL
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
    OR (
      (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'property_manager'
      AND property_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid)
    )
  );
```

**Seed blocked by Q2** (instructor headcount per property).

### Step 9 — `pricing_rules`

Placeholder schema. The exact column shape depends on Q5 (pricing formula). Three formulas are needed:
- `plan_a_visit`: tiered per-person rate by group size
- `private_lesson`: flat hourly rate ($200/hr confirmed; guest fee for non-members TBD)
- `host_an_occasion`: custom / team-quoted — may not use this table on the hot path

```sql
CREATE TYPE booking_type_enum AS ENUM (
  'plan_a_visit',
  'private_lesson',
  'host_an_occasion'
);

CREATE TYPE audience_type_enum AS ENUM (
  'public',
  'member',
  'partner'
);

CREATE TABLE pricing_rules (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   uuid          NOT NULL REFERENCES properties(id),
  booking_type  booking_type_enum NOT NULL,
  audience_type audience_type_enum NOT NULL,

  -- Flat rate (used for private_lesson: $200/hr)
  rate_per_unit numeric(10,2),
  unit          text,           -- 'hour', 'person', etc.

  -- Tiered rates (used for plan_a_visit group pricing)
  -- Format: [{"min_guests": 1, "max_guests": 5, "rate_per_person": 150}, ...]
  tiers         jsonb,

  minimum_fee   numeric(10,2),

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (property_id, booking_type, audience_type)
);

CREATE TRIGGER pricing_rules_updated_at
  BEFORE UPDATE ON pricing_rules
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;

-- Pricing is calculated server-side only — no client access
-- Staff can read; admins can write
CREATE POLICY "pricing_rules: staff read"
  ON pricing_rules FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role')
    IN ('super_admin', 'admin', 'property_manager', 'concierge', 'membership_coordinator')
  );

CREATE POLICY "pricing_rules: admin write"
  ON pricing_rules FOR ALL
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));
```

---

## Seed Data Summary

| Table | Status | Blocked By |
|---|---|---|
| `properties` | Ready — seed 3 rows, use placeholder `max_concurrent_groups = 1` | Q2 for final capacity values |
| `time_slots` | Ready to seed HSB — use example format above | Q2 for operating hours per property |
| `services` | Partially ready — HSB from existing materials | Q4 for Hog Heaven and Packsaddle |
| `add_ons` | Blocked | Q4 |
| `service_add_ons` | Blocked | Q4 (must seed services and add_ons first) |
| `instructors` | Blocked | Q2 (headcount) |
| `pricing_rules` | Blocked | Q5 (pricing formula) |

---

## Notes

**`properties.timezone`** — All three properties are in Texas (Central Time). Stored explicitly so that the time-slot validation trigger in Phase 2 can extract the correct local time from a UTC `timestamptz` without hardcoding. If a property ever moves or an event is out-of-state, this field handles it correctly.

**`booking_type_enum` and `audience_type_enum`** — Defined in this phase because `pricing_rules` needs them. Phase 2 will reference these same types — do not re-define them.

**`pricing_rules` column shape** — The `tiers` JSONB column is a placeholder. Once Q5 is answered, this may become a dedicated `pricing_tiers` table (one row per tier threshold) for easier querying and validation. Do not build the pricing engine against this schema until Q5 is resolved.

**`service_add_ons` same-property trigger** — The trigger fires `BEFORE INSERT OR UPDATE`. It re-validates on update to prevent someone from reassigning an add-on to a different service that happens to be at a different property.

**RLS and the anon key** — Tables with `public read` policies are readable by any request that uses the Supabase anon key, including unauthenticated visitors on the public booking form. This is intentional — guests need to see properties, services, add-ons, and time slots without logging in. Pricing rules are the exception: they are staff-only and never exposed to the client.
