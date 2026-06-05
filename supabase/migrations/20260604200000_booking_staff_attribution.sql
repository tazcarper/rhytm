-- ============================================================
-- Staff "book on behalf of a customer" — supersedes the partner-org idea
-- ============================================================
-- The partner-organization concept (an outside company booking for its own
-- guests) doesn't match the business: there are no external partners. What
-- staff actually need is to book a visit for a call-in customer themselves.
--
-- So we drop the unused partner_org_id attribution and replace it with
-- created_by_admin_id — the staff user who created the booking on the
-- customer's behalf (audit trail; "booked by Jane"). Bookings still flow
-- through the same create_public_booking path + bid pipeline; staff then
-- send the customer the pay link or confirm/collect from /admin/bids.
--
-- No RLS change: staff reads already run under the admin portal's broader
-- RLS scope; this column is just attribution.

alter table public.bookings
  drop column if exists partner_org_id;

alter table public.bookings
  add column if not exists created_by_admin_id uuid;

comment on column public.bookings.created_by_admin_id is
  'The staff/admin auth user who created this booking on a customer''s behalf (phone-in / walk-up). Null for self-service public or member bookings. Attribution only — not an FK (admins have no people row).';
