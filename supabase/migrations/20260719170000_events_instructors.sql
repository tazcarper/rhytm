-- The reference mockup's event-detail page always shows an Instructors
-- meta row (Date/Time/Location/Instructors) when the event has one. This
-- project's events table had no first-class column for it — a one-off
-- "Instructor" info box was used as a stopgap for the first seeded event,
-- but that only works per-event and doesn't surface in the meta rows
-- where the design actually wants it. Adding a real column instead of
-- string-matching an info box heading.

ALTER TABLE events ADD COLUMN instructors text;
