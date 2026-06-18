import type { SupabaseClient } from "@supabase/supabase-js";

// services + add_ons + service_add_ons all have anon-readable RLS for
// active rows (Phase 1 migration). The cookie-aware server client is
// enough — no service-role bypass needed.

export interface PublicAddOn {
  id: string;
  name: string;
  description: string | null;
  price: number;
  // Detail-pop-up content (migration 20260618120000). Both nullable: an
  // add-on without a photo renders the branded placeholder, and one without
  // an included line simply omits it.
  imageUrl: string | null;
  includedDetail: string | null;
  // Max quantity per booking (migration 20260618130000). 1 = single add/remove;
  // > 1 = the funnel shows a stepper capped here.
  maxQuantity: number;
}

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  // Discipline card photo (migration 20260618140000). NULL → the funnel card
  // renders the branded placeholder.
  imageUrl: string | null;
  addOns: ReadonlyArray<PublicAddOn>;
}

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  display_order: number;
  service_add_ons: ReadonlyArray<{
    add_ons: {
      id: string;
      name: string;
      description: string | null;
      price: string | number;
      display_order: number;
      is_active: boolean;
      image_url: string | null;
      included_detail: string | null;
      max_quantity: number;
    } | null;
  }> | null;
};

export async function getPublicServicesForProperty(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<{ data: PublicService[] | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("services")
    .select(
      `
      id,
      name,
      description,
      image_url,
      display_order,
      service_add_ons (
        add_ons (
          id,
          name,
          description,
          price,
          display_order,
          is_active,
          image_url,
          included_detail,
          max_quantity
        )
      )
      `,
    )
    .eq("property_id", propertyId)
    .eq("is_active", true)
    .order("display_order");

  if (error) return { data: null, error: { message: error.message } };

  // Supabase infers add_ons as an array for joined selects, but a single
  // service_add_ons row references one add_on, not many. The unknown hop
  // is the standard escape until generated types catch up.
  const rows = (data ?? []) as unknown as ServiceRow[];
  const services: PublicService[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    addOns: (row.service_add_ons ?? [])
      .map((j) => j.add_ons)
      .filter((a): a is NonNullable<typeof a> => a !== null && a.is_active)
      .sort((a, b) => a.display_order - b.display_order)
      .map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        // Postgres numeric arrives as a string over the wire; normalize to number
        // for downstream pricing math. App 6 will be stricter — App 2's estimate
        // is a placeholder until Q5 confirms the pricing formula.
        price: typeof a.price === "string" ? parseFloat(a.price) : a.price,
        imageUrl: a.image_url,
        includedDetail: a.included_detail,
        maxQuantity: a.max_quantity,
      })),
  }));

  return { data: services, error: null };
}
