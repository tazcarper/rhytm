import type { SupabaseClient } from "@supabase/supabase-js";

// services + add_ons + service_add_ons all have anon-readable RLS for
// active rows (Phase 1 migration). The cookie-aware server client is
// enough — no service-role bypass needed.

export interface PublicAddOn {
  id: string;
  name: string;
  description: string | null;
  price: number;
}

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  addOns: ReadonlyArray<PublicAddOn>;
}

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  service_add_ons: ReadonlyArray<{
    add_ons: {
      id: string;
      name: string;
      description: string | null;
      price: string | number;
      display_order: number;
      is_active: boolean;
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
      display_order,
      service_add_ons (
        add_ons (
          id,
          name,
          description,
          price,
          display_order,
          is_active
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
    addOns: (row.service_add_ons ?? [])
      .map((j) => j.add_ons)
      .filter((a): a is NonNullable<typeof a> => a !== null && a.is_active)
      .sort((a, b) => a.display_order - b.display_order)
      .map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        // Postgres numeric arrives as a string over the wire; normalize to number
        // for downstream pricing math. App 6 will be stricter — for App 2 the
        // estimate is "starting from" anyway.
        price: typeof a.price === "string" ? parseFloat(a.price) : a.price,
      })),
  }));

  return { data: services, error: null };
}
