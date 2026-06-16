-- Fix Packsaddle Precision range facts in the bid FAQ content library.
--
-- The seeded "How far out can we shoot?" answer (template 'distances',
-- id f0000000-0000-0000-0000-00000000000d) understated the range as
-- "100 yards out past 1,000". Per Nicholas (2026-06-16), Packsaddle is a
-- 4,000-yard range with world-class shooting decks and known-distance
-- targetry out to a mile. Update the canonical bid FAQ answer to match.
--
-- Idempotent: targets the row by its stable seed UUID; safe to re-run.

UPDATE public.bid_faq_templates
SET answer = 'A 4,000-yard range with world-class shooting decks and known-distance targetry out to a mile — steel and paper at honest distances for working up a ballistic solution.'
WHERE id = 'f0000000-0000-0000-0000-00000000000d';
