import type { SupabaseClient } from "@supabase/supabase-js";

// Public read path for promotions (see the promotions migration). Returns
// only the promos a visitor should see on a given placement, already
// property-filtered and ordered. RLS restricts the base rows to published +
// in-window; this adds placement + property scoping in app code so no
// cross-table RLS subquery is needed.

export type PromotionPlacement =
  | "homepage_band"
  | "property_page"
  | "adventures_page";

export interface Promotion {
  id: string;
  title: string;
  eyebrow: string | null;
  body: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
}

type PromotionRow = {
  id: string;
  title: string;
  eyebrow: string | null;
  body: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_href: string | null;
  placements: string[];
  sort_order: number;
  // Embedded join rows. Empty array = the promo targets all clubs.
  promotion_properties: { property_id: string }[];
};

const SELECT_COLUMNS =
  "id, title, eyebrow, body, image_url, cta_label, cta_href, placements, sort_order, promotion_properties ( property_id )";

function rowToPromotion(row: PromotionRow): Promotion {
  return {
    id: row.id,
    title: row.title,
    eyebrow: row.eyebrow,
    body: row.body,
    imageUrl: row.image_url,
    ctaLabel: row.cta_label,
    ctaHref: row.cta_href,
  };
}

// A promo with no property rows applies to all clubs; otherwise it applies
// only to the clubs it lists.
function appliesToProperty(
  row: PromotionRow,
  propertyId: string | undefined,
): boolean {
  if (row.promotion_properties.length === 0) return true;
  if (!propertyId) return false;
  return row.promotion_properties.some(
    (link) => link.property_id === propertyId,
  );
}

export interface GetActivePromotionsOptions {
  placement: PromotionPlacement;
  /** Scope to one club's page. Omit for site-wide placements (homepage,
      adventures index) — those show all-club promos only. */
  propertyId?: string;
}

// Returns the live promotions for a placement, property-scoped, ordered by
// sort_order then newest. Never throws — a failed read yields an empty band
// rather than breaking the page it sits on.
export async function getActivePromotions(
  supabase: SupabaseClient,
  { placement, propertyId }: GetActivePromotionsOptions,
): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from("promotions")
    .select(SELECT_COLUMNS)
    .contains("placements", [placement])
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const rows = data as unknown as PromotionRow[];
  return rows
    .filter((row) => appliesToProperty(row, propertyId))
    .map(rowToPromotion);
}
