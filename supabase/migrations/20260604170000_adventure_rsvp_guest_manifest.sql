-- ============================================================
-- App 4 (member adventures) — per-RSVP guest manifest
-- ============================================================
-- Members reserve a party (`guest_count` includes the lead member). This
-- adds the names of the *additional* guests coming with them — the
-- manifest staff use to plan day-of (the lead member's name already lives
-- on the `people` row reached via created_by_person_id).
--
-- Stored as a jsonb array of { name } objects, following the project's
-- "satellite data in jsonb, no schema churn" convention (same as
-- member_adventures.details). Extensible later (dietary, waiver, etc.)
-- without a migration. Length is expected to stay <= guest_count - 1; the
-- save path caps it.
--
-- No RLS change: reads inherit the existing member_adventure_rsvps
-- policies (member reads own; admin/property_manager read their scope) and
-- writes go through the member save action (service role, after an
-- ownership check) or admin write scope — the same pattern as every other
-- RSVP mutation.

alter table public.member_adventure_rsvps
  add column if not exists guests jsonb not null default '[]'::jsonb;

comment on column public.member_adventure_rsvps.guests is
  'Manifest of the additional guests in the party (beyond the lead member): jsonb array of { name }. Length stays <= guest_count - 1; the lead member''s identity comes from created_by_person_id.';
