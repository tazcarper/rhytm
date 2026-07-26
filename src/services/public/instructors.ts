import type { SupabaseClient } from "@supabase/supabase-js";

// Public read of the real instructor roster (the same admin-managed data
// behind /admin/instructors), scoped to one property. Replaces the
// education page's previous hardcoded INSTRUCTORS array — bio/photo/
// disciplines are now genuinely admin-editable via the existing instructor
// editor, no new content model needed.

export interface PublicInstructor {
  id: string;
  name: string;
  bio: string | null;
  photoUrl: string | null;
  disciplines: string[];
}

type InstructorRow = {
  id: string;
  name: string;
  bio: string | null;
  photo_url: string | null;
  instructor_disciplines: Array<{ services: { name: string } | null }> | null;
};

export async function getPublicInstructorsForProperty(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<PublicInstructor[]> {
  const { data, error } = await supabase
    .from("instructors")
    .select(
      "id, name, bio, photo_url, instructor_disciplines ( services ( name ) ), instructor_properties!inner ( property_id )",
    )
    .eq("is_active", true)
    .eq("instructor_properties.property_id", propertyId)
    .order("display_order", { ascending: true });

  if (error) throw new Error(`Public instructors failed: ${error.message}`);

  return ((data ?? []) as unknown as InstructorRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    bio: row.bio,
    photoUrl: row.photo_url,
    disciplines: (row.instructor_disciplines ?? [])
      .map((link) => link.services?.name)
      .filter((name): name is string => Boolean(name)),
  }));
}
