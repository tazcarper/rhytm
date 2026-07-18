-- The reference mockup's Events page has dynamic Type/Discipline filter
-- pills and a distinct "Featured Event" card, both driven by fields this
-- project's events table deliberately didn't model on the first pilot
-- pass (see this table's own migration header). The client now wants
-- both built, so: real columns, matching the demo data's own free-text
-- vocabulary (e.g. type: "Training"; discipline: "Shotgun") rather than a
-- fixed enum, same approach as `instructors`.

ALTER TABLE events ADD COLUMN type text;
ALTER TABLE events ADD COLUMN discipline text;
ALTER TABLE events ADD COLUMN featured boolean NOT NULL DEFAULT false;
