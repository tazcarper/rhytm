-- Per-target pricing — add an optional maximum target count, dashboard-editable.
-- The minimum stays implicit (one allotment, enforced by the stepper); this caps
-- the top end. Null = no maximum. Expressed in targets (e.g. 300), stepped by
-- the allotment size.
alter table public.services
  add column if not exists target_max_count int;
