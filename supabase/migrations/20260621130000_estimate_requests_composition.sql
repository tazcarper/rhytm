-- ============================================================
-- estimate_requests — party composition + manual line items
-- ============================================================
-- Brings the captured lead in line with the corrected intake model:
--   - host-of-record + composition: `members` (shoot on dues) vs non-member
--     `guest_adults` / `guest_juniors` (drive fees + ratios). A party can be
--     2 members hosting 10 guests.
--   - `lesson_hours` for the hourly private-lesson block (2-hr standard).
--   - `custom_lines` jsonb: staff-added flat line items (Musical Guest,
--     Snake Trainer, Hair & Makeup, …).
--
-- Additive + reversible. New columns are nullable; the prior `adults` /
-- `juniors` columns are KEPT for back-compat (the service writes them as the
-- party totals). The public-insert RPC is extended additively (the old
-- 17-arg signature is dropped and replaced by the full signature; same
-- REVOKE ALL + GRANT EXECUTE to anon/authenticated).
--
-- Rollback: drop the new columns; restore the prior 17-arg function.
-- ============================================================

alter table public.estimate_requests
  add column if not exists members       integer,
  add column if not exists guest_adults  integer,
  add column if not exists guest_juniors integer,
  add column if not exists lesson_hours  integer,
  add column if not exists custom_lines  jsonb not null default '[]'::jsonb;

comment on column public.estimate_requests.members is
  'Members in the party (member host) — shoot on dues, excluded from guest fees.';
comment on column public.estimate_requests.custom_lines is
  'Staff-added flat line items [{label, amount}] (staff phone-intake only).';

-- ---- Extend the public-insert RPC additively ----
-- Drop the prior 17-arg version and recreate with the composition + custom
-- line params appended. Same SECURITY DEFINER + grant posture.
drop function if exists public.create_estimate_request(
  uuid, estimate_channel, text, text, text, integer, integer,
  jsonb, jsonb, jsonb, date, date, text, text, text, text, uuid
);

create or replace function public.create_estimate_request(
  p_property_id        uuid,
  p_source_channel     estimate_channel,
  p_contact_name       text,
  p_contact_email      text,
  p_contact_phone      text,
  p_adults             integer,
  p_juniors            integer,
  p_experiences        jsonb,
  p_addons             jsonb,
  p_catering           jsonb,
  p_preferred_date     date,
  p_backup_date        date,
  p_arrival            text,
  p_notes              text,
  p_indicative_total   text,
  p_created_by_label   text,
  p_created_by_staff_id uuid,
  -- composition + manual lines (appended additively)
  p_members            integer,
  p_guest_adults       integer,
  p_guest_juniors      integer,
  p_lesson_hours       integer,
  p_custom_lines       jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.estimate_requests (
    property_id,
    source_channel,
    contact_name,
    contact_email,
    contact_phone,
    adults,
    juniors,
    experiences,
    addons,
    catering,
    preferred_date,
    backup_date,
    arrival,
    notes,
    indicative_total,
    created_by_label,
    created_by_staff_id,
    members,
    guest_adults,
    guest_juniors,
    lesson_hours,
    custom_lines
  ) values (
    p_property_id,
    p_source_channel,
    p_contact_name,
    p_contact_email,
    nullif(p_contact_phone, ''),
    coalesce(p_adults, 1),
    coalesce(p_juniors, 0),
    coalesce(p_experiences, '[]'::jsonb),
    coalesce(p_addons, '{}'::jsonb),
    p_catering,
    p_preferred_date,
    p_backup_date,
    nullif(p_arrival, ''),
    nullif(p_notes, ''),
    nullif(p_indicative_total, ''),
    coalesce(nullif(p_created_by_label, ''), 'self-serve'),
    p_created_by_staff_id,
    p_members,
    p_guest_adults,
    p_guest_juniors,
    p_lesson_hours,
    coalesce(p_custom_lines, '[]'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_estimate_request(
  uuid, estimate_channel, text, text, text, integer, integer,
  jsonb, jsonb, jsonb, date, date, text, text, text, text, uuid,
  integer, integer, integer, integer, jsonb
) from public;

grant execute on function public.create_estimate_request(
  uuid, estimate_channel, text, text, text, integer, integer,
  jsonb, jsonb, jsonb, date, date, text, text, text, text, uuid,
  integer, integer, integer, integer, jsonb
) to anon, authenticated;
