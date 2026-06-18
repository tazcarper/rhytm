-- =============================================================
-- Add-on max quantity — let staff allow more than one of an add-on
-- (feature: add-on detail pop-up; plan/add-on-detail-content.md)
-- =============================================================
-- Some add-ons are sensibly bought in multiples (extra ammunition), others
-- are one-per-booking (a private instructor upgrade). `max_quantity` is the
-- admin-set ceiling: 1 → the funnel shows a plain add/remove (no stepper);
-- > 1 → the funnel shows a (− # +) quantity stepper, clamped to this value.
--
-- Default 1 keeps every existing add-on single-quantity (no behavior change
-- until staff raise it). The CHECK matches the funnel/admin clamp (1–99).
-- Existing add_ons RLS already covers the new column; no policy change.

alter table add_ons
  add column if not exists max_quantity integer not null default 1
    check (max_quantity between 1 and 99);

comment on column add_ons.max_quantity is
  'Maximum quantity of this add-on per booking. 1 = single add/remove (no stepper); > 1 = the funnel shows a quantity stepper capped here.';
