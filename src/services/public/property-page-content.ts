import type { SupabaseClient } from "@supabase/supabase-js";

// Public read for admin-editable static copy (see the
// property_page_content migration). Always-live content, no draft/publish
// gating. Returns null when no row exists yet — callers fall back to their
// own hardcoded copy, so a page never breaks before an admin has touched a
// given section.

export type PropertyPageKey =
  | "home"
  | "membership"
  | "education"
  | "private_events"
  | "events"
  | "adventures"
  | "club_life"
  | "basics"
  | "layout";

// A single repeating card/row within an "items" section (benefit tiles,
// amenity tiles, occasion cards, programs, onboarding steps, gallery
// images, pricing figures). Every field is optional — a given section only
// ever populates the subset it renders; the public page picks what it
// needs and ignores the rest.
export interface PropertyContentItem {
  title?: string;
  body?: string;
  imageUrl?: string;
  bullets?: string[];
  linkHref?: string;
}

export interface PropertyPageSection {
  heading: string | null;
  body: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  items: PropertyContentItem[] | null;
}

export async function getPropertyPageSection(
  supabase: SupabaseClient,
  propertyId: string,
  pageKey: PropertyPageKey,
  sectionKey: string,
): Promise<PropertyPageSection | null> {
  const { data, error } = await supabase
    .from("property_page_content")
    .select("heading, body, image_url, cta_label, cta_href, items")
    .eq("property_id", propertyId)
    .eq("page_key", pageKey)
    .eq("section_key", sectionKey)
    .maybeSingle();

  if (error || !data) return null;

  return {
    heading: data.heading,
    body: data.body,
    imageUrl: data.image_url,
    ctaLabel: data.cta_label,
    ctaHref: data.cta_href,
    items: (data.items as PropertyContentItem[] | null) ?? null,
  };
}
