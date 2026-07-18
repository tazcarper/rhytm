-- property_faq_entries
--
-- Admin-editable FAQ content for the new property FAQ page
-- (app/(public)/horseshoe-bay/faq). Previously hardcoded in
-- app/(public)/horseshoe-bay/faq/faq-data.ts (13 categories, ~45 Q&As,
-- transcribed from the client's mockup) with an explicit note that it had
-- "no existing home in the data model" — this table is that home.
--
-- Deliberately its own table rather than folded into property_page_content:
-- FAQ content is a flat list of many small (category, question, answer)
-- rows the admin adds/removes/reorders freely, not a handful of named page
-- sections. `category` is a plain text label (not a normalized table) —
-- categories don't carry their own metadata beyond a title and an implied
-- order, so `category_order` + `sort_order` (order within category) is
-- enough to render grouped, ordered output without a second table.
--
-- Unlike property_page_content's "DB row overrides hardcoded default"
-- pattern, this table is fully authoritative once seeded (see the
-- companion seed migration) — the public page reads only from here.

CREATE TABLE property_faq_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id    uuid NOT NULL REFERENCES properties(id),

  category       text NOT NULL,
  category_order integer NOT NULL DEFAULT 0,

  question       text NOT NULL,
  answer         text NOT NULL,
  sort_order     integer NOT NULL DEFAULT 0,

  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX property_faq_entries_property_idx
  ON property_faq_entries (property_id, category_order, sort_order);

CREATE TRIGGER property_faq_entries_updated_at
  BEFORE UPDATE ON property_faq_entries
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE property_faq_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_faq_entries: public read"
  ON property_faq_entries FOR SELECT
  USING (true);

CREATE POLICY "property_faq_entries: admin all"
  ON property_faq_entries FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "property_faq_entries: property_manager write own"
  ON property_faq_entries FOR ALL
  USING ((SELECT auth_role()) = 'property_manager' AND property_id = (SELECT auth_property_id()))
  WITH CHECK ((SELECT auth_role()) = 'property_manager' AND property_id = (SELECT auth_property_id()));
