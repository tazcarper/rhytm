-- Phase 1: Foundation Tables
-- properties, time_slots, services, add_ons, service_add_ons, instructors, pricing_rules

-- ============================================================
-- Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- Shared trigger function
-- ============================================================

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Enums (defined here; Phase 2 references these — do not redefine)
-- ============================================================

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

-- ============================================================
-- properties
-- ============================================================

CREATE TABLE properties (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text        NOT NULL,
  slug                  text        NOT NULL UNIQUE,
  timezone              text        NOT NULL DEFAULT 'America/Chicago',
  max_concurrent_groups integer     NOT NULL DEFAULT 1 CHECK (max_concurrent_groups > 0),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "properties: public read"
  ON properties FOR SELECT USING (true);

CREATE POLICY "properties: admin write"
  ON properties FOR ALL
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));

-- Seed: all three properties (max_concurrent_groups confirmed later via Q2)
INSERT INTO properties (name, slug, timezone, max_concurrent_groups) VALUES
  ('Horseshoe Bay Sporting Club', 'horseshoe-bay', 'America/Chicago', 1),
  ('Hog Heaven Sporting Club',   'hog-heaven',    'America/Chicago', 1),
  ('Packsaddle Precision',       'packsaddle',    'America/Chicago', 1);

-- ============================================================
-- time_slots
-- ============================================================

CREATE TABLE time_slots (
  id          uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid     NOT NULL REFERENCES properties(id),
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  slot_start  time     NOT NULL,
  is_active   boolean  NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (property_id, day_of_week, slot_start)
);

CREATE INDEX idx_time_slots_lookup
  ON time_slots (property_id, day_of_week, is_active);

ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_slots: public read active"
  ON time_slots FOR SELECT
  USING (is_active = true);

CREATE POLICY "time_slots: admin read all"
  ON time_slots FOR SELECT
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));

CREATE POLICY "time_slots: admin write"
  ON time_slots FOR ALL
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));

-- Seed blocked pending Q2 (operating hours per property).
-- Example format — replace with confirmed hours before seeding:
--
-- INSERT INTO time_slots (property_id, day_of_week, slot_start)
-- SELECT p.id, d.dow, t.slot::time
-- FROM properties p
-- CROSS JOIN (VALUES (1),(2),(3),(4),(5)) AS d(dow)
-- CROSS JOIN (VALUES ('09:00'),('10:00'),('11:00'),('12:00'),('13:00'),('14:00'),('15:00')) AS t(slot)
-- WHERE p.slug = 'horseshoe-bay';

-- ============================================================
-- services
-- ============================================================

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

CREATE POLICY "services: public read active"
  ON services FOR SELECT
  USING (is_active = true);

CREATE POLICY "services: admin read all"
  ON services FOR SELECT
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));

CREATE POLICY "services: admin write"
  ON services FOR ALL
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));

-- Seed blocked pending Q4 (full discipline catalog). Seed HSB from existing materials separately.

-- ============================================================
-- add_ons
-- ============================================================

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

-- ============================================================
-- service_add_ons
-- ============================================================

CREATE TABLE service_add_ons (
  service_id uuid NOT NULL REFERENCES services(id)  ON DELETE CASCADE,
  add_on_id  uuid NOT NULL REFERENCES add_ons(id)   ON DELETE CASCADE,
  PRIMARY KEY (service_id, add_on_id)
);

CREATE OR REPLACE FUNCTION check_service_add_on_property()
RETURNS TRIGGER AS $$
DECLARE
  v_service_property uuid;
  v_addon_property   uuid;
BEGIN
  SELECT property_id INTO v_service_property FROM services WHERE id = NEW.service_id;
  SELECT property_id INTO v_addon_property   FROM add_ons  WHERE id = NEW.add_on_id;

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

CREATE POLICY "service_add_ons: public read"
  ON service_add_ons FOR SELECT USING (true);

CREATE POLICY "service_add_ons: admin write"
  ON service_add_ons FOR ALL
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));

-- ============================================================
-- instructors
-- ============================================================

CREATE TABLE instructors (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   uuid    NOT NULL REFERENCES properties(id),
  name          text    NOT NULL,
  bio           text,
  photo_url     text,
  is_active     boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_instructors_property ON instructors (property_id, is_active);

CREATE TRIGGER instructors_updated_at
  BEFORE UPDATE ON instructors
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instructors: public read active"
  ON instructors FOR SELECT
  USING (is_active = true);

CREATE POLICY "instructors: admin read all"
  ON instructors FOR SELECT
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));

CREATE POLICY "instructors: admin and pm write"
  ON instructors FOR ALL
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin')
    OR (
      (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'property_manager'
      AND property_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid)
    )
  );

-- Seed blocked pending Q2 (instructor headcount per property).

-- ============================================================
-- pricing_rules
-- ============================================================

CREATE TABLE pricing_rules (
  id            uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   uuid               NOT NULL REFERENCES properties(id),
  booking_type  booking_type_enum  NOT NULL,
  audience_type audience_type_enum NOT NULL,

  -- Flat rate (private_lesson: $200/hr confirmed)
  rate_per_unit numeric(10,2),
  unit          text,

  -- Tiered rates (plan_a_visit group pricing) — JSONB placeholder until Q5 confirmed
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

CREATE POLICY "pricing_rules: staff read"
  ON pricing_rules FOR SELECT
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role')
    IN ('super_admin', 'admin', 'property_manager', 'concierge', 'membership_coordinator')
  );

CREATE POLICY "pricing_rules: admin write"
  ON pricing_rules FOR ALL
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin'));

-- Seed blocked pending Q5 (pricing formula confirmation).
