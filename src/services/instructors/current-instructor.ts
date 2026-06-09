import type { SupabaseClient } from "@supabase/supabase-js";

// The signed-in instructor's own catalog row — name + home property — for the
// portal nav greeting. Kept tiny on purpose; gameplan data is fetched per
// event by its own service.
export interface CurrentInstructor {
  id: string;
  name: string;
  propertyName: string | null;
}

type AccessRow = {
  instructor_id: string;
  instructors: {
    name: string;
    properties: { name: string } | null;
  } | null;
};

// Resolves the instructor bound to the current auth account via the portal
// access table (self-read policy). Returns null for anyone who isn't a linked
// instructor. The embedded catalog row is readable even for an inactive
// instructor thanks to "instructors: instructor reads self".
export async function getCurrentInstructor(
  supabase: SupabaseClient,
): Promise<CurrentInstructor | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("instructor_portal_access")
    .select("instructor_id, instructors ( name, properties ( name ) )")
    .eq("user_id", user.id)
    .maybeSingle<AccessRow>();

  if (error) {
    throw new Error(`Current instructor failed: ${error.message}`);
  }
  if (!data || !data.instructors) return null;

  return {
    id: data.instructor_id,
    name: data.instructors.name,
    propertyName: data.instructors.properties?.name ?? null,
  };
}
