-- Public storage bucket for property_page_content image uploads.
--
-- Same pattern as homepage-images (20260615130000) and adventure-images
-- (20260604160000): PUBLIC bucket (content renders on anonymous marketing
-- pages via plain <img>/background-image), writes go through the admin
-- upload Server Action (service-role client, admin-checked), no
-- storage.objects INSERT policy needed. 10 MB cap + raster-image allowlist.
-- Idempotent.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-content-images',
  'property-content-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do nothing;
