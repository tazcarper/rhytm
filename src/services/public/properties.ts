import type { SupabaseClient } from "@supabase/supabase-js";

// `properties` has a public-read RLS policy, so the cookie-aware
// server client suffices — no service-role bypass needed.

export interface PublicProperty {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  bookingHorizonDays: number;
}

type PublicPropertyRow = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  booking_horizon_days: number;
};

const SELECT_COLUMNS = "id, name, slug, timezone, booking_horizon_days";

function rowToProperty(row: PublicPropertyRow): PublicProperty {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    timezone: row.timezone,
    bookingHorizonDays: row.booking_horizon_days,
  };
}

export async function getPublicProperties(
  supabase: SupabaseClient,
): Promise<{ data: PublicProperty[] | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("properties")
    .select(SELECT_COLUMNS)
    .order("name");

  if (error) return { data: null, error: { message: error.message } };
  return {
    data: ((data ?? []) as PublicPropertyRow[]).map(rowToProperty),
    error: null,
  };
}

export async function getPublicPropertyBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<{ data: PublicProperty | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("properties")
    .select(SELECT_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) return { data: null, error: { message: error.message } };
  return {
    data: data ? rowToProperty(data as PublicPropertyRow) : null,
    error: null,
  };
}
