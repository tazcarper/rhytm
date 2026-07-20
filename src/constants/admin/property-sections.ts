// The sub-nav sections of the single-page property workspace. Shared between
// the server page (which parses the requested section out of the catch-all
// URL) and the client workspace (which renders the tab bar + active panel).
// Keys double as URL segments, so they must stay URL-safe and stable.
//
// Experiences / Add-ons / Catering / Guest fees / FAQ were removed from this
// list 2026-07-19 for initial launch — they manage the OLD booking-funnel
// catalog/pricing (or, for FAQ, content not needed at launch), not anything
// the new property front end reads. Their services, components, and DB
// tables are untouched (Hog Heaven/Packsaddle's old funnel still runs on
// that data) — only the admin tabs are hidden. Revisit if those properties
// need catalog/pricing edits again before their own front-end migration, or
// if FAQ content becomes needed at launch.
//
// Basics came back 2026-07-19, re-scoped: logo/address/contact/hours/social
// links — the property-wide facts the new header/footer chrome actually
// reads — rather than the old form's mostly-unused fields (directions,
// booking horizon, etc.).

export interface PropertySection {
  key: PropertySectionKey;
  label: string;
}

export const PROPERTY_SECTIONS = [
  { key: "basics", label: "Basics" },
  { key: "content", label: "Marketing pages" },
  { key: "events", label: "Events" },
] as const satisfies ReadonlyArray<{ key: string; label: string }>;

export type PropertySectionKey = (typeof PROPERTY_SECTIONS)[number]["key"];

export const DEFAULT_PROPERTY_SECTION: PropertySectionKey = "basics";

// No section here opens an inline item-editor drawer (that was
// Experiences/Add-ons, both removed) — nothing needs an extra URL segment.
export const DRAWER_SECTIONS: ReadonlyArray<PropertySectionKey> = [];

export function isPropertySectionKey(value: string): value is PropertySectionKey {
  return PROPERTY_SECTIONS.some((section) => section.key === value);
}
