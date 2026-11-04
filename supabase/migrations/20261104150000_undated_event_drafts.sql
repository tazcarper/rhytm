-- ============================================================
-- Let a draft event exist before it has a date
-- ============================================================
--
-- The New event screen now creates a draft from just the club, the kind
-- of event and its name; the builder's Date step asks for the date
-- afterwards. So a draft may have neither start_at nor schedule_text.
-- Any other status still needs one or the other, as before.
--
-- Nothing that reads events breaks on an undated draft: guests only see
-- published / sold-out rows, and the admin list, calendar and stats
-- already skip or label rows with no start_at.

ALTER TABLE events DROP CONSTRAINT event_has_date_or_schedule;

ALTER TABLE events ADD CONSTRAINT event_has_date_or_schedule
  CHECK (status = 'draft' OR start_at IS NOT NULL OR schedule_text IS NOT NULL);
