// The sub-nav sections of the single-page property workspace. Shared between
// the server page (which parses the requested section out of the catch-all
// URL) and the client workspace (which renders the tab bar + active panel).
// Keys double as URL segments, so they must stay URL-safe and stable.

export interface PropertySection {
  key: PropertySectionKey;
  label: string;
}

export const PROPERTY_SECTIONS = [
  { key: "basics", label: "Basics" },
  { key: "experiences", label: "Experiences" },
  { key: "add-ons", label: "Add-ons" },
  { key: "catering", label: "Catering" },
  { key: "guest-fees", label: "Guest fees" },
] as const satisfies ReadonlyArray<{ key: string; label: string }>;

export type PropertySectionKey = (typeof PROPERTY_SECTIONS)[number]["key"];

export const DEFAULT_PROPERTY_SECTION: PropertySectionKey = "basics";

// Only Experiences and Add-ons open an inline item editor (a deep-linkable
// drawer); the URL for those carries a trailing item id.
export const DRAWER_SECTIONS: ReadonlyArray<PropertySectionKey> = [
  "experiences",
  "add-ons",
];

export function isPropertySectionKey(value: string): value is PropertySectionKey {
  return PROPERTY_SECTIONS.some((section) => section.key === value);
}
