-- Property map link — App 9 W3 reminder emails.
--
-- A single admin-pasted Google Maps share link (e.g.
-- https://maps.app.goo.gl/...) per property. The pre-event reminder emails
-- render it as an "Open in Google Maps" link near the bottom. No API key,
-- no autocomplete, no stored coordinates — staff paste the link from Google
-- Maps' Share dialog. Null hides the link.

ALTER TABLE properties
  ADD COLUMN map_url text;

COMMENT ON COLUMN properties.map_url IS
  'Google Maps share link (https://maps.app.goo.gl/... or any maps URL); rendered as the "Open in Google Maps" link in the pre-event reminder emails. Null hides it.';
