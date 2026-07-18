import type { PropertyPageKey } from "@/src/services/public/property-page-content";

// The full editable-content surface across the 9 Horseshoe Bay pages,
// property-agnostic — this drives both the admin editors (which form to
// render per section, and which fields within that form) and, implicitly,
// which (page_key, section_key) pairs a property is expected to have
// seeded. Adding a new property (Hog Heaven, Packsaddle) needs no changes
// here: this config is shared across every property_id, only the content
// rows differ.
//
// `kind: "single"` sections render a subset of heading/body/image/cta (see
// `fields`). `kind: "items"` sections render an add/remove/reorder list of
// cards, each showing a subset of title/body/image/bullets/link (see
// `itemFields`). `kind: "hybrid"` sections are a single block (heading/body)
// PLUS a small items list below it — used for the two galleries that pair
// a heading/body with up to 3 photos in one row (club-spotlight,
// setting-gallery). Deliberately NOT covered here: education's instructor
// roster (wired to the real instructors system) and the FAQ page (its own
// table, property_faq_entries, with its own dedicated editor).
//
// `fields`/`itemFields` exist so each admin form only shows inputs the
// public page actually reads — every section here was audited against its
// consuming component; omitting a key means that input is dead weight for
// this specific section (e.g. the Logo section only ever reads its image,
// so it shows nothing else).

export type PropertyPageSectionKind = "single" | "items" | "hybrid";

export type SingleFieldKey = "heading" | "body" | "image" | "cta";
export type ItemFieldKey = "title" | "body" | "image" | "bullets" | "link";

export const ALL_SINGLE_FIELDS: ReadonlyArray<SingleFieldKey> = ["heading", "body", "image", "cta"];
export const ALL_ITEM_FIELDS: ReadonlyArray<ItemFieldKey> = ["title", "body", "image", "bullets", "link"];

export interface PropertyPageSectionConfig {
  pageKey: PropertyPageKey;
  sectionKey: string;
  label: string;
  kind: PropertyPageSectionKind;
  helpText?: string;
  /** single/hybrid — which of heading/body/image/cta to show. Default: all. */
  fields?: ReadonlyArray<SingleFieldKey>;
  /** items/hybrid — which per-card fields to show. Default: all. */
  itemFields?: ReadonlyArray<ItemFieldKey>;
  /** items/hybrid — cap on how many cards can be added. Default: unlimited. */
  maxItems?: number;
}

export const PROPERTY_CONTENT_PAGES: ReadonlyArray<{ key: PropertyPageKey; label: string }> = [
  { key: "home", label: "Homepage" },
  { key: "membership", label: "Membership" },
  { key: "education", label: "Education" },
  { key: "private_events", label: "Private Events" },
  { key: "events", label: "Events" },
  { key: "adventures", label: "Adventures" },
  { key: "club_life", label: "Club Life" },
  { key: "layout", label: "Layout" },
];

export const PROPERTY_PAGE_SECTIONS: ReadonlyArray<PropertyPageSectionConfig> = [
  // ---- basics (its own fixed top-level tab, not a page-picker entry —
  // there's only ever one "page" of basics, so it renders without the
  // per-page sub-picker other sections use) ----
  {
    pageKey: "basics",
    sectionKey: "logo",
    label: "Logo",
    kind: "single",
    fields: ["image"],
    helpText: "Upload the property's logo — shown in the header.",
  },
  {
    pageKey: "basics",
    sectionKey: "footer-logo",
    label: "Footer logo",
    kind: "single",
    fields: ["image"],
    helpText:
      "Upload a version for the dark footer band — usually a vertical or light/white mark, since the header logo above is meant for a light background. Leave blank to reuse the header logo.",
  },
  {
    pageKey: "basics",
    sectionKey: "address",
    label: "Address",
    kind: "single",
    fields: ["body"],
    helpText: "One address line per line.",
  },
  {
    pageKey: "basics",
    sectionKey: "contact-info",
    label: "Contact",
    kind: "items",
    itemFields: ["title", "body"],
    helpText: "One card per contact method — Title is the label (e.g. Email or Phone), Body is the value.",
  },
  {
    pageKey: "basics",
    sectionKey: "office-hours",
    label: "Office hours",
    kind: "items",
    itemFields: ["title", "body"],
    helpText: "One card per row, in display order — Title is the day range (e.g. Tue–Sat), Body is the hours.",
  },
  {
    pageKey: "basics",
    sectionKey: "social-links",
    label: "Social links",
    kind: "items",
    itemFields: ["title", "link"],
    helpText: "One card per platform — Title is the platform name, Link is the profile URL.",
  },

  // ---- layout (cross-page chrome — footer today, more later) ----
  {
    pageKey: "layout",
    sectionKey: "footer",
    label: "Footer",
    kind: "single",
    fields: ["heading", "body"],
    helpText: "The newsletter band's heading and blurb, shown above the footer's info columns.",
  },

  // ---- home ----
  { pageKey: "home", sectionKey: "intro", label: "Intro", kind: "single", fields: ["heading", "body"] },
  {
    pageKey: "home",
    sectionKey: "find-your-way",
    label: "Find Your Way In tiles",
    kind: "items",
    itemFields: ["title", "image", "link"],
    helpText: "Title, image, and link for each tile.",
  },
  {
    pageKey: "home",
    sectionKey: "amenities",
    label: "Premier Amenities",
    kind: "items",
    itemFields: ["title", "body", "bullets", "image"],
    helpText: "Title, blurb, bullet list, and image for each amenity card.",
  },
  {
    pageKey: "home",
    sectionKey: "campaign-quote",
    label: "Campaign quote",
    kind: "single",
    fields: ["heading", "body"],
  },
  {
    pageKey: "home",
    sectionKey: "join-cta",
    label: "Join the Club CTA",
    kind: "single",
    fields: ["heading", "body", "cta"],
  },

  // ---- membership ----
  { pageKey: "membership", sectionKey: "intro", label: "Intro", kind: "single" },
  {
    pageKey: "membership",
    sectionKey: "pricing",
    label: "Pricing figures",
    kind: "items",
    itemFields: ["title", "body"],
    helpText: "One card per figure — title is the number (e.g. $2,950), body is the label (e.g. Initiation).",
  },
  {
    pageKey: "membership",
    sectionKey: "benefits",
    label: "Member benefits",
    kind: "items",
    itemFields: ["title", "body"],
    helpText: "Title and blurb for each benefit.",
  },
  {
    pageKey: "membership",
    sectionKey: "amenities",
    label: "Premier Amenities",
    kind: "items",
    itemFields: ["title", "body", "bullets", "image"],
    helpText: "Title, blurb, bullet list, and image for each amenity card.",
  },
  {
    pageKey: "membership",
    sectionKey: "club-spotlight",
    label: "Club Spotlight gallery",
    kind: "hybrid",
    fields: ["heading", "body"],
    itemFields: ["image"],
    maxItems: 3,
    helpText: "Heading + body, plus up to 3 photos shown alongside it.",
  },
  {
    pageKey: "membership",
    sectionKey: "onboarding-steps",
    label: "Your First Visit steps",
    kind: "items",
    itemFields: ["title", "body"],
    helpText: "Title and blurb for each step, shown in order.",
  },
  {
    pageKey: "membership",
    sectionKey: "ambassador",
    label: "Membership ambassador",
    kind: "single",
    fields: ["heading", "body", "image"],
    helpText: "Heading is the ambassador's name; body is their blurb; image is their photo.",
  },

  // ---- private_events ----
  { pageKey: "private_events", sectionKey: "intro", label: "Intro", kind: "single" },
  {
    pageKey: "private_events",
    sectionKey: "occasions",
    label: "Events We Host",
    kind: "items",
    itemFields: ["title", "body", "image"],
    helpText: "Title, blurb, and image for each occasion card.",
  },
  {
    pageKey: "private_events",
    sectionKey: "services",
    label: "Services columns",
    kind: "items",
    itemFields: ["title", "body", "bullets"],
    helpText: "Title, blurb, and bullet list for each column.",
  },
  {
    pageKey: "private_events",
    sectionKey: "setting-gallery",
    label: "The Setting gallery",
    kind: "hybrid",
    fields: ["heading", "body"],
    itemFields: ["image"],
    maxItems: 3,
    helpText: "Heading + body, plus up to 3 photos shown alongside it.",
  },

  // ---- education ----
  { pageKey: "education", sectionKey: "intro", label: "Intro", kind: "single" },
  {
    pageKey: "education",
    sectionKey: "programs",
    label: "Programs",
    kind: "items",
    itemFields: ["title", "body", "link"],
    helpText: "Title, blurb, and link for each program card.",
  },
  {
    pageKey: "education",
    sectionKey: "cta",
    label: "Bottom CTA",
    kind: "single",
    fields: ["heading", "cta"],
  },

  // ---- events ----
  {
    pageKey: "events",
    sectionKey: "included-band",
    label: "“Included with Membership” band",
    kind: "single",
    fields: ["body"],
  },
  {
    pageKey: "events",
    sectionKey: "members-cta",
    label: "Members CTA",
    kind: "single",
    fields: ["heading", "body", "cta"],
  },

  // ---- adventures ----
  {
    pageKey: "adventures",
    sectionKey: "intro",
    label: "Intro",
    kind: "single",
    fields: ["heading", "body"],
  },

  // ---- club_life (upcoming events + standing programs are deliberately
  // NOT here — they need real backend work this pilot pass didn't scope:
  // a posts/blog table for "The Latest" and a type/"Standing" concept on
  // events, neither of which exist in this project's schema. See the
  // plan doc for the scope decision. "What's Next" reuses the real events
  // table directly, no admin content needed.) ----
  {
    pageKey: "club_life",
    sectionKey: "community",
    label: "Community band",
    kind: "single",
    fields: ["heading", "body", "cta"],
    helpText:
      "The dark band below the calendar. Horseshoe Bay uses it as a CTA to the private Facebook group (CTA label/link required); Hog Heaven uses it as an email-signup band instead (heading/body only, the CTA fields go unused).",
  },
  {
    pageKey: "club_life",
    sectionKey: "instagram",
    label: "Instagram handle",
    kind: "single",
    fields: ["heading", "cta"],
    helpText: "Heading is the @handle shown above the photo grid; the button links out to the profile.",
  },
  {
    pageKey: "club_life",
    sectionKey: "instagram-photos",
    label: "Instagram photos",
    kind: "items",
    itemFields: ["image", "link"],
    maxItems: 5,
    helpText: "Up to 5 photos — Link is optional, and can point at the specific Instagram post.",
  },
];

export function getSectionsForPage(pageKey: PropertyPageKey): ReadonlyArray<PropertyPageSectionConfig> {
  return PROPERTY_PAGE_SECTIONS.filter((section) => section.pageKey === pageKey);
}
