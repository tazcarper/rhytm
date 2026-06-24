-- =============================================================
-- HSB (Horseshoe Bay) — canonical guest fees (corrects the earlier ladder)
--
-- Source: canonical HSBC Q&A 5.12.26 (Schema Training Corpus v2.1 §9, §12).
-- An earlier migration mistakenly loaded an *escalating* ladder
-- ($85/$110/$130/$150/$160 to 24 guests) drawn from a superseded Charter.
-- That escalating ladder is actually HHSC's (Hog Heaven) — a different
-- property. The truth for HSB Sporting Club:
--
--   Adult (16+):       FLAT $85/person  (includes cart + clays)
--   Junior (15 & under): FLAT $55/person (includes cart + clays)
--   Up to 5 guests per visit; groups of 6+ need GM approval (a separate
--   reservation path, so the slider caps at 5 here).
--
-- plan_a_visit (public): one flat tier 1-5 carrying both rates.
-- private_lesson (public): $200/hr base + the same guest fee per head
--   ($85 adult / $55 junior) — the booker is a non-member who pays entry.
--
-- Scope: Horseshoe Bay only. Hog Heaven and Packsaddle stay on placeholders.
-- =============================================================

-- ---- plan_a_visit (public): flat $85 adult / $55 junior, 1-5 guests ----
UPDATE pricing_rules
SET tiers = jsonb_build_array(
  jsonb_build_object(
    'min_guests', 1,
    'max_guests', 5,
    'rate_per_person', 85.00,
    'junior_rate_per_person', 55.00
  )
)
WHERE booking_type = 'plan_a_visit'
  AND audience_type = 'public'
  AND property_id = (SELECT id FROM properties WHERE slug = 'horseshoe-bay');

-- ---- private_lesson (public): guest fee $85 adult / $55 junior ----
UPDATE pricing_rules
SET per_guest_fee = 85.00,
    junior_per_guest_fee = 55.00
WHERE booking_type = 'private_lesson'
  AND audience_type = 'public'
  AND property_id = (SELECT id FROM properties WHERE slug = 'horseshoe-bay');
