-- =============================================================
-- App 3.11 — Catalog Editor: property_manager write policies for
-- services / add_ons / service_add_ons.
--
-- Phase 1 RLS already covers admin/super_admin writes on all three
-- tables and public/admin reads. This migration adds the missing
-- property_manager write path so each property's manager can edit
-- their own catalog without admin elevation.
--
-- Scope:
--   - services: property_manager can INSERT/UPDATE/DELETE when
--     property_id = auth_property_id().
--   - add_ons:  same.
--   - service_add_ons: junction has no property_id column, so the
--     policy joins through services (or add_ons — the trigger
--     `check_service_add_on_property` already guarantees both share
--     the same property_id, so either side suffices). We check
--     services for symmetry with the rest of the catalog.
--
-- Soft-delete is the documented path (toggle is_active=false), but
-- we still grant DELETE — the FK from booking_disciplines /
-- booking_add_ons is RESTRICT, so deletes against rows with active
-- booking refs reject at the DB level regardless.
-- =============================================================

-- services
CREATE POLICY "services: property_manager write"
  ON services FOR ALL
  USING (
    auth_role() = 'property_manager'
    AND property_id = auth_property_id()
  )
  WITH CHECK (
    auth_role() = 'property_manager'
    AND property_id = auth_property_id()
  );

-- add_ons
CREATE POLICY "add_ons: property_manager write"
  ON add_ons FOR ALL
  USING (
    auth_role() = 'property_manager'
    AND property_id = auth_property_id()
  )
  WITH CHECK (
    auth_role() = 'property_manager'
    AND property_id = auth_property_id()
  );

-- service_add_ons (joined-scope policy — no property_id column)
CREATE POLICY "service_add_ons: property_manager write"
  ON service_add_ons FOR ALL
  USING (
    auth_role() = 'property_manager'
    AND EXISTS (
      SELECT 1 FROM services s
      WHERE s.id = service_add_ons.service_id
        AND s.property_id = auth_property_id()
    )
  )
  WITH CHECK (
    auth_role() = 'property_manager'
    AND EXISTS (
      SELECT 1 FROM services s
      WHERE s.id = service_add_ons.service_id
        AND s.property_id = auth_property_id()
    )
  );
