import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getPublicPropertyBySlug } from "./properties";

// DB-driven catalog for the public /request-estimate page. Replaces the
// hardcoded RULES catalog in estimate-intake/rules.ts: experiences, add-ons,
// the tiered guest-fee schedule, and catering all come from the tables the
// admin catalog area manages. The indicative-price math lives in the pure
// module `src/services/estimates/estimate-pricing.ts`, which consumes this.
//
// Visibility is just is_active (deactivate to hide). Reads:
//   - services (is_active)                            — public RLS
//   - add_ons  (is_active)                            — public RLS
//   - catering_options (is_active)                    — public RLS
//   - pricing_rules (audience_type = 'estimate')      — staff-only RLS, so the
//     guest-fee schedule is read with the service-role key, mirroring
//     getPublicPricingForProperty. Returns only price-affecting fields.

export type EstimatePricingKind =
  | "guest_fee_tier"
  | "lesson_ladder"
  | "class_per_person"
  | "quote";

export interface EstimateExperience {
  id: string;
  name: string;
  description: string | null;
  pricingKind: EstimatePricingKind;
  // Members-only experience (HSB Tournament/Event): locked for a non-member host.
  membersOnly: boolean;
  // lesson_ladder kind only: flat per-student ladder + cohort size (1:N ratio).
  lessonLadder: number[] | null;
  lessonCohortSize: number;
  // class_per_person kind only: member vs public per-head rate.
  classPriceMember: number | null;
  classPricePublic: number | null;
}

// Every active add-on shows on the estimate (deactivate to hide). An add-on is
// a simple quantity item priced quantity × price; max_quantity = 1 renders as a
// Yes/No toggle, otherwise a stepper capped at max_quantity. The optional
// member retail discount (members 20% off goods like ammo/gear) is the one
// estimate-specific behaviour, carried per add-on.
export type EstimateAddOnControl = "qty" | "bool";

export interface EstimateAddOn {
  id: string;
  name: string;
  description: string | null;
  price: number;
  maxQuantity: number;
  control: EstimateAddOnControl;
  memberDiscount: boolean;
}

export interface EstimateGuestFeeTier {
  maxGuests: number;
  // Adult per-guest fee; junior (15 & under) falls back to adult when null.
  adult: number;
  junior: number;
}

export interface EstimateCateringOption {
  id: string;
  tier: string;
  vendorName: string;
  pricePerHead: number;
}

export interface EstimateCatalog {
  experiences: EstimateExperience[];
  addOns: EstimateAddOn[];
  guestFeeTiers: EstimateGuestFeeTier[];
  catering: EstimateCateringOption[];
}

export const EMPTY_ESTIMATE_CATALOG: EstimateCatalog = {
  experiences: [],
  addOns: [],
  guestFeeTiers: [],
  catering: [],
};

function parseNumeric(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "string" ? parseFloat(value) : value;
}

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  pricing_kind: EstimatePricingKind;
  members_only: boolean;
  lesson_ladder: Array<string | number> | null;
  lesson_cohort_size: number;
  class_price_member: string | number | null;
  class_price_public: string | number | null;
};

type AddOnRow = {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  max_quantity: number;
  estimate_member_discount: boolean;
};

type CateringRow = {
  id: string;
  tier: string;
  vendor_name: string;
  price_per_head: string | number;
};

type EstimateTierRow = {
  min_guests: number;
  max_guests: number;
  rate_per_person: string | number;
  junior_rate_per_person?: string | number | null;
};

// The per-property estimate guest-fee schedule. Stored as a pricing_rules row
// with audience_type = 'estimate' (kept distinct from the /book public rule).
async function getEstimateGuestFeeTiers(
  propertyId: string,
): Promise<EstimateGuestFeeTier[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("pricing_rules")
    .select("tiers")
    .eq("property_id", propertyId)
    .eq("audience_type", "estimate")
    .maybeSingle();

  if (error) {
    console.error(`Estimate guest-fee read failed (property ${propertyId}): ${error.message}`);
    return [];
  }
  if (!data) return [];
  const rawTiers = (data as { tiers: unknown }).tiers;
  if (!Array.isArray(rawTiers)) return [];

  return (rawTiers as EstimateTierRow[])
    .map((tier) => {
      const adult = parseNumeric(tier.rate_per_person);
      const junior =
        tier.junior_rate_per_person === null ||
        tier.junior_rate_per_person === undefined
          ? adult
          : parseNumeric(tier.junior_rate_per_person);
      return { maxGuests: tier.max_guests, adult, junior };
    })
    .sort((a, b) => a.maxGuests - b.maxGuests);
}

function rowToExperience(row: ServiceRow): EstimateExperience {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    pricingKind: row.pricing_kind,
    membersOnly: row.members_only,
    lessonLadder:
      row.lesson_ladder === null
        ? null
        : row.lesson_ladder.map((v) => parseNumeric(v)),
    lessonCohortSize: row.lesson_cohort_size,
    classPriceMember:
      row.class_price_member === null ? null : parseNumeric(row.class_price_member),
    classPricePublic:
      row.class_price_public === null ? null : parseNumeric(row.class_price_public),
  };
}

// Every active add-on shows. max_quantity = 1 → Yes/No toggle, else a stepper.
function mapAddOns(rows: AddOnRow[]): EstimateAddOn[] {
  return rows.map((row) => {
    const maxQuantity = row.max_quantity > 0 ? row.max_quantity : 1;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      price: parseNumeric(row.price),
      maxQuantity,
      control: maxQuantity === 1 ? "bool" : "qty",
      memberDiscount: row.estimate_member_discount,
    };
  });
}

export async function getEstimateCatalog(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<EstimateCatalog> {
  const [servicesResult, addOnsResult, cateringResult, guestFeeTiers] =
    await Promise.all([
      supabase
        .from("services")
        .select(
          "id, name, description, pricing_kind, members_only, lesson_ladder, lesson_cohort_size, class_price_member, class_price_public",
        )
        .eq("property_id", propertyId)
        .eq("is_active", true)
        .order("display_order"),
      supabase
        .from("add_ons")
        .select("id, name, description, price, max_quantity, estimate_member_discount")
        .eq("property_id", propertyId)
        .eq("is_active", true)
        .order("display_order"),
      supabase
        .from("catering_options")
        .select("id, tier, vendor_name, price_per_head")
        .eq("property_id", propertyId)
        .eq("is_active", true)
        .order("display_order"),
      getEstimateGuestFeeTiers(propertyId),
    ]);

  // Reads fail open (empty catalog) so the page never crashes, but log so a
  // broken RLS/query is visible rather than silently rendering nothing.
  if (servicesResult.error) {
    console.error(`Estimate experiences read failed (property ${propertyId}): ${servicesResult.error.message}`);
  }
  if (addOnsResult.error) {
    console.error(`Estimate add-ons read failed (property ${propertyId}): ${addOnsResult.error.message}`);
  }
  if (cateringResult.error) {
    console.error(`Estimate catering read failed (property ${propertyId}): ${cateringResult.error.message}`);
  }

  const experiences = ((servicesResult.data ?? []) as ServiceRow[]).map(
    rowToExperience,
  );
  const addOns = mapAddOns((addOnsResult.data ?? []) as AddOnRow[]);
  const catering = ((cateringResult.data ?? []) as CateringRow[]).map((row) => ({
    id: row.id,
    tier: row.tier,
    vendorName: row.vendor_name,
    pricePerHead: parseNumeric(row.price_per_head),
  }));

  return { experiences, addOns, guestFeeTiers, catering };
}

// Per-club catalog map for the estimate front door, which lets the user switch
// club in-form (client-side). We fetch every BOOKABLE club's catalog up front
// (server-side) and hand the whole map to the client component — mirroring
// getEstimateClubScheduling. Packsaddle ("coming soon") is omitted; the form
// gates it before reading any catalog.
const BOOKABLE_CLUBS: ReadonlyArray<{ club: string; slug: string }> = [
  { club: "hsb", slug: "horseshoe-bay" },
  { club: "hh", slug: "hog-heaven" },
];

export type EstimateCatalogByClub = Record<string, EstimateCatalog>;

export async function getEstimateCatalogByClub(
  supabase: SupabaseClient,
): Promise<EstimateCatalogByClub> {
  const entries = await Promise.all(
    BOOKABLE_CLUBS.map(async ({ club, slug }) => {
      const { data: property } = await getPublicPropertyBySlug(supabase, slug);
      if (!property) return null;
      const catalog = await getEstimateCatalog(supabase, property.id);
      return [club, catalog] as const;
    }),
  );

  const result: EstimateCatalogByClub = {};
  for (const entry of entries) {
    if (entry) result[entry[0]] = entry[1];
  }
  return result;
}
