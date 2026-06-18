-- =============================================================
-- Discipline (service) card photo
-- (feature: booking "Choose Your Discipline" redesign;
--  plan/booking-disciplines-redesign.md)
-- =============================================================
-- The redesigned disciplines step renders each service as a large editorial
-- card with a landscape photo. Until now services had no image column, so the
-- card falls back to a branded placeholder. This migration adds the column and
-- a public bucket for uploaded photos, so staff can populate them from /admin
-- and the funnel renders the real image. Mirrors the add-on detail photo
-- feature (migration 20260618120000) exactly.
--
-- image_url is NULLABLE: a service without a photo still renders (the card
-- shows the branded placeholder — graceful degradation is preserved). Existing
-- services RLS (public read active / admin read all + admin writes) already
-- covers the new column — no policy change needed.

alter table services
  add column if not exists image_url text;

comment on column services.image_url is
  'Public URL of the discipline card photo (uploaded to the service-images bucket, or a pasted link). NULL → the funnel card shows the branded placeholder.';

-- PUBLIC bucket for uploaded discipline photos. Mirrors add-on-images /
-- homepage-images / adventure-images: world-readable by URL (the funnel shows
-- them via next/image), writes go through the admin upload Server Action under
-- service role (no storage.objects INSERT policy needed). 10 MB cap + raster
-- MIME allowlist. Idempotent.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'service-images',
  'service-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do nothing;
