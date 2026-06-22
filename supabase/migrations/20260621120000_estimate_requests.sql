-- ============================================================
-- estimate_requests — the lead / request object (PR-1 slice)
-- ============================================================
-- The missing front half of the estimate-driven flow. A customer (or a
-- staff member on a phone call) requests an estimate; it is captured here
-- as a lead and surfaces in the admin where the existing bid tools live.
--
-- This is the `estimate_requests` slice of the blessed architecture plan
-- (plan/architecture/schema-extension-plan.md, §5.1 / §7) — NOT price
-- tiers, NOT bid versioning, NOT bid→many-bookings. Names/enums align with
-- that plan so the rest of PR-1 can land additively later.
--
-- Additive + reversible: new enums, one new table, one SECURITY DEFINER
-- public-insert RPC. Rollback = drop the RPC, the table, then the enums.
--
-- v1 captures the lead only. The indicative total is computed client-side
-- from the prototype RULES and stored as free text (`indicative_total`) —
-- the BINDING price is still staff-built on the bid. No money moves here.
-- ============================================================

-- ---- Enums (align with the architecture plan) ----
-- estimate_channel: which pricing door the lead came through.
-- Forward-reference (schema-extension-response.md §3.1 / §5.2): a later PR-1
-- slice adds a decoupled `price_tiers` lookup (retail/member/group/partner/
-- non_member) + a channel→tier strategy map (config, not a branch). The map
-- is NOT 1:1 — `public_group`→`group`, and no channel here yields `retail`
-- (that tier covers public walk-in / non-group). Keep these channel values;
-- do the translation in the map. Channel stays an enum (small closed set);
-- the churn-prone pricing axis is the `price_tiers` table, per §4.1.
create type estimate_channel as enum (
  'member',
  'non_member',
  'public_group',
  'partner'
);

-- estimate_status: the lead pipeline (the CRM seed).
--   new → building → sent → accepted / declined → converted
create type estimate_status as enum (
  'new',
  'building',
  'sent',
  'accepted',
  'declined',
  'converted'
);

-- ---- Table ----
create table if not exists public.estimate_requests (
  id                 uuid primary key default gen_random_uuid(),
  -- Nullable: a lead can arrive before a club is firmly chosen, and a
  -- "Coming Soon" (Packsaddle) capture-interest lead may not map to a
  -- bookable property yet. Mapped from the form's club selection by slug.
  property_id        uuid references public.properties(id) on delete set null,
  source_channel     estimate_channel not null,
  status             estimate_status  not null default 'new',

  -- Lead contact
  contact_name       text not null,
  contact_email      text not null,
  contact_phone      text,

  -- Party size (juniors = 15 & under; drives the safety/instructor math
  -- the prototype surfaces, recorded here as captured context).
  adults             integer not null default 1 check (adults >= 0),
  juniors            integer not null default 0 check (juniors >= 0),

  -- Free-shape selections captured at intake. Kept as jsonb because the
  -- catalog/pricing model that would normalize these is a later PR-1 slice;
  -- v1 deliberately stores what the customer chose without binding it.
  experiences        jsonb not null default '[]'::jsonb,
  addons             jsonb not null default '{}'::jsonb,
  catering           jsonb,

  -- Timing
  preferred_date     date,
  backup_date        date,
  arrival            text,

  -- Notes + the client-computed indicative figure (text, e.g. "$1,240",
  -- "Coming Soon", "Custom" — never treated as authoritative money).
  notes              text,
  indicative_total   text,

  -- Provenance: 'self-serve' for the public door, or the staff member's
  -- name when taken on the phone. created_by_staff_id is the auth user id
  -- when a signed-in staff member submits on a customer's behalf.
  created_by_label   text not null default 'self-serve',
  created_by_staff_id uuid references auth.users(id) on delete set null,

  created_at         timestamptz not null default now()
);

create index if not exists estimate_requests_status_created_idx
  on public.estimate_requests (status, created_at desc);

comment on table public.estimate_requests is
  'Lead/request object for the estimate-driven flow (PR-1 slice). Captured from the public Request-an-Estimate front door or staff phone intake; surfaces in /admin/estimates where staff build the binding bid. jsonb selection columns are intentionally un-normalized in v1.';

-- Forward-reference (schema-extension-response.md §3.2 / D2): the binding bid
-- is the existing `bids` row (reused, not a separate `estimates` table). A
-- later PR-1 slice adds nullable `bids.estimate_request_id` FK→estimate_requests
-- so an accepted bid traces back to this lead. No column is added to this table
-- for that link — the FK lives on `bids`. Nothing to do here now; noted so the
-- next slice lands additively.

-- ---- RLS ----
alter table public.estimate_requests enable row level security;

-- Staff (super_admin / admin / property_manager / concierge /
-- membership_coordinator) read + update the queue. is_staff() is a
-- SECURITY INVOKER helper that already wraps auth.jwt() in (SELECT …)
-- internally (Phase 4), so the per-query InitPlan rule is satisfied.
-- No inline cross-table subqueries — single-table predicate only.
create policy "estimate_requests: staff read"
  on public.estimate_requests for select
  using (is_staff());

create policy "estimate_requests: staff update"
  on public.estimate_requests for update
  using (is_staff()) with check (is_staff());

-- No INSERT policy by design: the public/self-serve door has no auth
-- session and is never granted a direct table INSERT. All inserts go
-- through create_estimate_request() (SECURITY DEFINER) below — same
-- pattern as create_public_booking(). No DELETE policy (leads are kept).

-- ============================================================
-- create_estimate_request(...) — public insert RPC
-- ============================================================
-- SECURITY DEFINER so an unauthenticated guest can lodge a lead without a
-- direct table grant. Validation lives in the calling service; this fn just
-- inserts one row and returns its id. Mirrors create_public_booking's
-- REVOKE ALL + explicit GRANT EXECUTE shape.
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
  p_created_by_staff_id uuid
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
    created_by_staff_id
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
    p_created_by_staff_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_estimate_request(
  uuid, estimate_channel, text, text, text, integer, integer,
  jsonb, jsonb, jsonb, date, date, text, text, text, text, uuid
) from public;

grant execute on function public.create_estimate_request(
  uuid, estimate_channel, text, text, text, integer, integer,
  jsonb, jsonb, jsonb, date, date, text, text, text, text, uuid
) to anon, authenticated;
