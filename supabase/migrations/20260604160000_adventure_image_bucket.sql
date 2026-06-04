-- ============================================================
-- App 4 (member adventures) — public storage bucket for editorial imagery
-- ============================================================
-- The `adventure-images` bucket is PUBLIC (public = true): hero, gallery,
-- and chapter images are rendered by plain <img src> on public-facing
-- adventure pages, so the objects must be reachable by an unauthenticated
-- browser via their public URL. Contrast with the private `waivers` bucket,
-- whose objects are sensitive and reached only through signed URLs.
--
-- WRITES go through the admin upload Server Action, which verifies admin
-- access and then uploads with the service-role client (bypasses storage
-- RLS) — so no storage.objects INSERT policy is needed, and anon/member
-- sessions have no direct write path. Public READ is granted by the
-- bucket's `public = true` flag (Supabase serves these without RLS).
--
-- Hardening: 10 MB per-object cap and a raster-image MIME allowlist.
--
-- Idempotent (ON CONFLICT) so it is a no-op if the bucket was already
-- created out-of-band (e.g. via the Storage API during setup).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'adventure-images',
  'adventure-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do nothing;
