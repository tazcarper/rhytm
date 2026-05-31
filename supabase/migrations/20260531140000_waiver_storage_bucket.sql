-- ============================================================
-- App 7 (homegrown waiver) — private storage bucket for signed PDFs
-- ============================================================
-- The `waivers` bucket is PRIVATE (public = false): objects are reachable
-- only via the service-role client or a short-lived signed URL generated
-- server-side. The signing path writes with service role; admins view via
-- a server-generated signed URL (a later phase). Because all access is
-- service-role (which bypasses storage RLS), no storage.objects policies
-- are needed — anon/authenticated have no direct path to these objects.
--
-- Hardening: 10 MB per-object cap and application/pdf only.
--
-- Idempotent (ON CONFLICT) so it is a no-op if the bucket was already
-- created out-of-band (e.g. via the Storage API during setup).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('waivers', 'waivers', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;
