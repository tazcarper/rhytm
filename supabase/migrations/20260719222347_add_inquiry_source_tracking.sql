-- Inquiry source tracking
--
-- The Membership and Private Events forms live behind many CTAs on each
-- property's marketing pages (an intro CTA, one "Inquire" per membership
-- tier card, an onboarding CTA, a tour CTA, a bottom-of-page standalone
-- form, etc). property_id already says *which property* an inquiry came
-- from; nothing said *which CTA the guest clicked* — e.g. that a Hog
-- Heaven membership inquiry came from the "Legacy Family" tier card
-- specifically, not the page's general "Request Membership Info" button.
--
-- Two nullable text columns rather than folding into the existing
-- `details` jsonb: `details` is documented as type-specific *form* fields
-- (how-heard-about-us, event type, guest count) that the guest fills in
-- and that vary per inquiry_type. Source is not a form field — it's
-- context the page captures automatically, applies uniformly to every
-- inquiry_type, and the admin list view needs to show/scan directly
-- rather than expand into per-row JSON.
--
--   source_page   the pathname the form was submitted from
--                 (e.g. "/hog-heaven/membership")
--   source_label  the specific CTA/plan the guest clicked
--                 (e.g. "Legacy Family", "Schedule a Tour")
--
-- Nullable: older rows (submitted before this migration) have neither.

ALTER TABLE inquiries
  ADD COLUMN source_page text,
  ADD COLUMN source_label text;
