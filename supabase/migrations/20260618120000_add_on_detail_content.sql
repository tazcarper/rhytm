-- =============================================================
-- Add-on detail content — photo + "what's included" line
-- (feature: add-on detail pop-up; plan/add-on-detail-content.md)
-- =============================================================
-- The booking-funnel add-on detail pop-up shows a landscape photo and a
-- short "what's included" line. Until now those had no home in the schema,
-- so the pop-up rendered a branded placeholder. This migration adds the two
-- columns and a public bucket for uploaded photos, so staff can populate
-- them from /admin and the funnel renders the real content.
--
-- Both columns are NULLABLE: an add-on with neither still renders the
-- placeholder + omits the line (graceful degradation is preserved). Existing
-- add_ons RLS (public read active / admin read all + admin writes) already
-- covers the new columns — no policy change needed.

alter table add_ons
  add column if not exists image_url       text,
  add column if not exists included_detail text;

comment on column add_ons.image_url is
  'Public URL of the add-on detail photo (uploaded to the add-on-images bucket, or a pasted link). NULL → the funnel pop-up shows the branded placeholder.';
comment on column add_ons.included_detail is
  'Short "what''s included" line shown under the price in the add-on detail pop-up. NULL → the line is omitted.';

-- PUBLIC bucket for uploaded add-on photos. Mirrors homepage-images /
-- adventure-images: world-readable by URL (the funnel shows them via a plain
-- <img>), writes go through the admin upload Server Action under service role
-- (no storage.objects INSERT policy needed). 10 MB cap + raster MIME allowlist.
-- Idempotent.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'add-on-images',
  'add-on-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do nothing;
