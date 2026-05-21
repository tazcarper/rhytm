-- =============================================================
-- Adds properties.booking_horizon_days — the maximum number of days
-- ahead a public guest can book at this property. Admin-editable
-- from the App 3 dashboard. Same-day booking is always allowed (the
-- lower bound is now(), not now()+lead).
-- =============================================================

ALTER TABLE properties
  ADD COLUMN booking_horizon_days integer NOT NULL DEFAULT 30
    CHECK (booking_horizon_days BETWEEN 1 AND 365);

COMMENT ON COLUMN properties.booking_horizon_days IS
  'Max days into the future a public guest can book at this property. Admin-editable from App 3 dashboard. Same-day booking is always allowed; lower-bound is now().';
