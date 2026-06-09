-- ============================================================
-- Scan-to-sign: per-booking QR waivers (whole party signs)
-- ============================================================
-- Staff show a QR on the booking; each guest scans it on their own phone and
-- signs their own waiver, all tied to the booking. The first scan signs the
-- canonical bid waiver (marks the booking signed); the rest are additional
-- party waivers linked to the booking.

-- Many waivers can reference one booking (unlike bid_id, which is UNIQUE).
-- These party rows are standalone-shaped (property_id + signer_email, no
-- bid_id) so the existing link CHECK + property_manager read policy already
-- cover them; booking_id just records the association.
alter table public.waiver_documents
  add column if not exists booking_id uuid references public.bookings(id);

create index if not exists waiver_documents_booking_id_idx
  on public.waiver_documents (booking_id)
  where booking_id is not null;

-- Opaque bearer token the QR encodes (→ /sign-waiver/<token>). Minted on
-- demand when staff open the QR; one per booking, partial-UNIQUE.
alter table public.bookings
  add column if not exists waiver_sign_token text;

create unique index if not exists bookings_waiver_sign_token_key
  on public.bookings (waiver_sign_token)
  where waiver_sign_token is not null;

comment on column public.waiver_documents.booking_id is
  'Booking this waiver is associated with. Set for QR scan-to-sign party waivers (multiple per booking); bid-linked waivers associate via bid_id instead.';
comment on column public.bookings.waiver_sign_token is
  'Opaque bearer token encoded in the booking''s scan-to-sign QR (→ /sign-waiver/<token>). Minted on demand; NULL = no QR issued yet.';
