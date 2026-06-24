-- =============================================================
-- Editable Homepage Hero — public storage bucket for the uploaded
-- background image (feature: editable-homepage-hero)
-- =============================================================
-- Companion to 20260615120000_homepage_hero.sql. The hero's background
-- can now be set two ways: paste an image URL (unchanged) OR upload a
-- file. Uploaded files land in this PUBLIC `homepage-images` bucket and
-- the resulting public URL is stored in homepage_hero.image_url exactly
-- like a pasted URL — the renderer (app/page.tsx) is unchanged.
--
-- PUBLIC (public = true): the hero is shown to anonymous visitors via a
-- plain <img>/background-image, so objects must be world-readable by URL.
-- Mirrors the `adventure-images` bucket; contrast the private `waivers`
-- bucket (signed URLs).
--
-- WRITES go through the admin upload Server Action, which verifies admin
-- access and uploads with the service-role client (bypasses storage RLS).
-- No storage.objects INSERT policy is needed; anon/member sessions have no
-- direct write path. Public READ comes from the `public = true` flag.
--
-- Hardening: 10 MB per-object cap + raster-image MIME allowlist.
-- Idempotent (ON CONFLICT) so it is a no-op if the bucket already exists.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'homepage-images',
  'homepage-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do nothing;
