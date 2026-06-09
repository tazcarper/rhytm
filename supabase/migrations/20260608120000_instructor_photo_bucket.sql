-- ============================================================
-- App 14 (instructor profiles) — public storage bucket for instructor photos
-- ============================================================
-- The `instructor-photos` bucket is PUBLIC (public = true): instructor
-- headshots are rendered by the public /instructors page and the booking
-- funnel's instructor picker, so the objects must be reachable by an
-- unauthenticated browser via their public URL. Mirrors the
-- `adventure-images` bucket exactly (see 20260604160000) — the same public
-- editorial-imagery pattern, just a separate bucket so the two domains'
-- objects stay organizationally distinct.
--
-- WRITES go through the admin upload Server Action (uploadInstructorPhotoAction),
-- which verifies admin access and then uploads with the service-role client
-- (bypasses storage RLS) — so no storage.objects INSERT policy is needed, and
-- anon/member sessions have no direct write path. Public READ is granted by the
-- bucket's `public = true` flag (Supabase serves these without RLS).
--
-- Photos are PUBLIC by design (a guest choosing an instructor should see their
-- face + bio). Contact PII (email/phone) stays in instructor_portal_access and
-- never touches this bucket or the public-read instructors row.
--
-- Hardening: 10 MB per-object cap and a raster-image MIME allowlist.
--
-- Idempotent (ON CONFLICT) so it is a no-op if the bucket was already created
-- out-of-band (e.g. via the Storage API during setup).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'instructor-photos',
  'instructor-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do nothing;
