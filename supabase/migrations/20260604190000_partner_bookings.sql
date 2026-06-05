-- ============================================================
-- App 5 (Partner Portal) — attribute bookings to a partner org
-- ============================================================
-- A partner (concierge) books on behalf of a guest. The booking is created
-- through the same create_public_booking path as the public funnel with
-- audience_type = 'partner'; this column records WHICH partner organization
-- made it, so the partner dashboard can list its own bookings.
--
-- No partner RLS policy is added: writes go through the service-role
-- booking-creation service, and the partner dashboard reads go through a
-- service-role service scoped by the org id read from the caller's verified
-- JWT (app_metadata.partner_org_id). Partners therefore have NO direct
-- authed read path to `bookings` (deny by default) — consistent with how
-- public bid reads + booking writes already work.
--
-- ON DELETE SET NULL: deleting a partner org (rare) must not cascade-delete
-- historical bookings; they just lose the attribution.

alter table public.bookings
  add column if not exists partner_org_id uuid
    references public.partner_organizations(id) on delete set null;

create index if not exists bookings_partner_org_id_idx
  on public.bookings (partner_org_id)
  where partner_org_id is not null;

comment on column public.bookings.partner_org_id is
  'Set when a partner/concierge books on behalf of a guest (audience_type = partner). Scopes the partner-portal dashboard. Written + read via service-role services that verify the org from the JWT; no partner RLS policy by design.';
