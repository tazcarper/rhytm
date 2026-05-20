import type { SupabaseClient } from "@supabase/supabase-js";

// `properties` has a public-read RLS policy, so the cookie-aware
// server client suffices — no service-role bypass needed.

export interface PublicProperty {
  id: string;
  name: string;
  slug: string;
  timezone: string;
}

export async function getPublicProperties(
  supabase: SupabaseClient,
): Promise<{ data: PublicProperty[] | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("properties")
    .select("id, name, slug, timezone")
    .order("name");

  if (error) return { data: null, error: { message: error.message } };
  return { data: (data ?? []) as PublicProperty[], error: null };
}

export async function getPublicPropertyBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<{ data: PublicProperty | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("properties")
    .select("id, name, slug, timezone")
    .eq("slug", slug)
    .maybeSingle();

  if (error) return { data: null, error: { message: error.message } };
  return { data: (data as PublicProperty | null) ?? null, error: null };
}
