-- ============================================================
-- Property gear presets — a saved gear list per property
-- ============================================================
--
-- Gear an admin uses often at one property ("Ear protection, required,
-- bring your own or rent for $2"). In the event builder they show as a
-- checklist so a piece of gear is added with one tick instead of typed
-- again. Rows marked add_to_new_events are added to every new draft at
-- that property (e.g. all Hog Heaven events require eye and ear
-- protection).
--
-- Columns mirror event_gear_items, so a preset copies straight onto an
-- event. Presets are a starting point only: editing an event's gear never
-- changes the preset, and editing a preset never changes existing events.
--
-- RLS mirrors the `events` table's own policies: admins manage every
-- property's list, a property_manager manages their own property's list.
-- Guests never read this table (the event's own gear rows are what the
-- public page shows).
--
-- Policy dependency audit (CLAUDE.md RLS rule 5): the policies reference
-- no other table, only the JWT helpers auth_role(), auth_property_id() and
-- is_admin(). No policy on any other table references this one. No cycles.

CREATE TABLE property_gear_presets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id        uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name               text NOT NULL CHECK (length(trim(name)) > 0),
  is_required        boolean NOT NULL DEFAULT false,
  included           boolean NOT NULL DEFAULT false,
  bring_own_allowed  boolean NOT NULL DEFAULT false,
  rent_price         numeric(10, 2) CHECK (rent_price IS NULL OR rent_price >= 0),
  buy_price          numeric(10, 2) CHECK (buy_price IS NULL OR buy_price >= 0),
  notes              text,
  add_to_new_events  boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT property_gear_preset_has_a_way CHECK (
    included OR bring_own_allowed OR rent_price IS NOT NULL OR buy_price IS NOT NULL
  )
);

-- One preset per name per property, ignoring case, so saving "Ear
-- protection" again updates the existing row.
CREATE UNIQUE INDEX uq_property_gear_presets_name
  ON property_gear_presets (property_id, lower(name));

ALTER TABLE property_gear_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_gear_presets: admin all"
  ON property_gear_presets FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "property_gear_presets: property_manager own property"
  ON property_gear_presets FOR ALL
  USING ((SELECT auth_role()) = 'property_manager' AND property_id = (SELECT auth_property_id()))
  WITH CHECK ((SELECT auth_role()) = 'property_manager' AND property_id = (SELECT auth_property_id()));
