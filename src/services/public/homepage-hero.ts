import type { SupabaseClient } from "@supabase/supabase-js";

// The umbrella homepage hero banner. One editable row (see the
// homepage_hero migration); rendered by app/page.tsx, edited from
// /admin/homepage.
export interface HomepageHero {
  eyebrow: string | null;
  title: string;
  lead: string | null;
  imageUrl: string | null;
  primaryCtaLabel: string | null;
  primaryCtaHref: string | null;
  secondaryCtaLabel: string | null;
  secondaryCtaHref: string | null;
}

type HomepageHeroRow = {
  eyebrow: string | null;
  title: string;
  lead: string | null;
  image_url: string | null;
  primary_cta_label: string | null;
  primary_cta_href: string | null;
  secondary_cta_label: string | null;
  secondary_cta_href: string | null;
};

const SELECT_COLUMNS =
  "eyebrow, title, lead, image_url, primary_cta_label, primary_cta_href, secondary_cta_label, secondary_cta_href";

// Last-resort copy so the homepage still renders a sensible hero even if
// the singleton row is missing (e.g. a stack seeded before this feature).
// The migration seeds the same values, so in practice the DB wins.
export const FALLBACK_HOMEPAGE_HERO: HomepageHero = {
  eyebrow: "Est. 2026",
  title: "Your day in the Texas Hill Country starts here.",
  lead: "Sporting clays, private instruction, and unforgettable gatherings across three storied properties — reserved online in minutes.",
  imageUrl: null,
  primaryCtaLabel: "Plan your visit",
  primaryCtaHref: "/book",
  secondaryCtaLabel: "Members’ Entrance",
  secondaryCtaHref: "/login",
};

function rowToHero(row: HomepageHeroRow): HomepageHero {
  return {
    eyebrow: row.eyebrow,
    title: row.title,
    lead: row.lead,
    imageUrl: row.image_url,
    primaryCtaLabel: row.primary_cta_label,
    primaryCtaHref: row.primary_cta_href,
    secondaryCtaLabel: row.secondary_cta_label,
    secondaryCtaHref: row.secondary_cta_href,
  };
}

// Reads the singleton hero row. Returns the fallback (never null) so a
// caller can render unconditionally without its own default handling.
export async function getHomepageHero(
  supabase: SupabaseClient,
): Promise<HomepageHero> {
  const { data, error } = await supabase
    .from("homepage_hero")
    .select(SELECT_COLUMNS)
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    return FALLBACK_HOMEPAGE_HERO;
  }
  return rowToHero(data as HomepageHeroRow);
}
