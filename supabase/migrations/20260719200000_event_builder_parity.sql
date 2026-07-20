-- Event builder parity pass
--
-- Closes the remaining gap between the admin event editor and the client's
-- reference mockup (temporary-resources/front-end-beta/_reference/event-builder),
-- following the same "match the reference's vocabulary with real columns"
-- approach as 20260719170000_events_instructors.sql and
-- 20260719180000_events_type_discipline_featured.sql:
--
--   1. included_with_membership — same fact the reference derives from
--      member_price = 0, but kept as an explicit flag rather than inferred,
--      since this project's member_price of NULL already means "no price
--      set" (distinct from "free"), so 0-as-signal would collide with that.
--   2. audience — "Members & Public" vs "Members Only" from the reference's
--      "Who Can Attend" field. Display-only in this pass: it does not gate
--      app/(public)/*/events/[id]/actions.ts's registerForEventAction, which
--      stays open-to-anyone by design (see this table's original migration
--      header). Revisit as a real gate only if a future request asks for one.
--   3. schedule_text + nullable start_at — "Standing" (indefinite) programs
--      from the reference show a recurring schedule string instead of a
--      date ("Tuesday and Thursday 7:30 AM"). A Standing program is a single
--      row with no start_at, not a dated occurrence, so start_at can no
--      longer be NOT NULL — the new check constraint requires one or the
--      other, never neither.

ALTER TABLE events ADD COLUMN included_with_membership boolean NOT NULL DEFAULT false;

ALTER TABLE events ADD COLUMN audience text NOT NULL DEFAULT 'members_and_public'
  CHECK (audience IN ('members_and_public', 'members_only'));

ALTER TABLE events ADD COLUMN schedule_text text;

ALTER TABLE events ALTER COLUMN start_at DROP NOT NULL;

ALTER TABLE events ADD CONSTRAINT event_has_date_or_schedule
  CHECK (start_at IS NOT NULL OR schedule_text IS NOT NULL);
