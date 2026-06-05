-- ============================================================
-- Team / staff onboarding — every staff member has a name + email
-- ============================================================
-- Staff/admin-portal users have no `people` row (that table is for members).
-- This table is their identity + onboarding state: an admin invites a
-- teammate by email + role, and the teammate must set their name on first
-- sign-in (the /admin/welcome step) before using the portal.
--
-- `role` here mirrors app_metadata.role (the auth-level source of truth the
-- proxy + RLS read); it's duplicated for the team list. `full_name` is null
-- until onboarding completes.

create table if not exists public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null,
  full_name text,
  status text not null default 'invited' check (status in ('invited', 'active', 'disabled')),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.staff_profiles enable row level security;
-- No policies by design: every read/write goes through a service-role
-- server action or service that gates on is_admin() (manage) or auth.uid()
-- (self-onboarding) in app code. RLS-enabled + zero policies = deny by
-- default for any direct anon/authenticated client (same pattern as the
-- webhook-idempotency table).

comment on table public.staff_profiles is
  'Identity + onboarding state for staff/admin-portal users (who have no people row). user_id → auth.users. `role` mirrors app_metadata.role (auth-level source of truth used by the proxy + RLS); `full_name` is captured on first sign-in via /admin/welcome. Accessed only by service-role admin-gated server code.';
