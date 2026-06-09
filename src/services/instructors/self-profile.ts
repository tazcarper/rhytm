import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

// Instructor self-service profile: the narrow set of fields an instructor may
// edit about themselves from the /instructor portal — name, bio, photo, phone.
// Deliberately NOT is_active / display_order / properties / disciplines: those
// stay admin-controlled (roster decisions). Reads work for the instructor's own
// row via the self-read RLS policies; writes go through the service-role client
// after the action resolves the current instructor from the session.

export interface InstructorSelfProfile {
  name: string;
  bio: string | null;
  photoUrl: string | null;
  phone: string | null;
}

type ProfileRow = {
  name: string;
  bio: string | null;
  photo_url: string | null;
  instructor_portal_access: { phone: string | null } | null;
};

export async function getInstructorSelfProfile(
  client: SupabaseClient,
  instructorId: string,
): Promise<InstructorSelfProfile | null> {
  const { data, error } = await client
    .from("instructors")
    .select("name, bio, photo_url, instructor_portal_access ( phone )")
    .eq("id", instructorId)
    .maybeSingle();

  if (error) {
    throw new Error(`Instructor self profile failed: ${error.message}`);
  }
  if (!data) return null;

  const row = data as unknown as ProfileRow;
  return {
    name: row.name,
    bio: row.bio,
    photoUrl: row.photo_url,
    phone: row.instructor_portal_access?.phone ?? null,
  };
}

// The properties this instructor teaches at — for the schedule editor's
// per-property week grid. Sorted by name for a stable order.
export async function getInstructorSelfProperties(
  client: SupabaseClient,
  instructorId: string,
): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await client
    .from("instructor_properties")
    .select("properties ( id, name )")
    .eq("instructor_id", instructorId);

  if (error) {
    throw new Error(`Instructor self properties failed: ${error.message}`);
  }

  return (
    (data ?? []) as unknown as Array<{ properties: { id: string; name: string } | null }>
  )
    .map((row) => row.properties)
    .filter((property): property is { id: string; name: string } => property !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const UpdateInstructorPresentationSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  bio: z.string().trim().max(2000).optional(),
  photoUrl: z
    .string()
    .trim()
    .url("Photo must be a valid URL.")
    .or(z.literal(""))
    .optional(),
  phone: z.string().trim().max(40).optional(),
});

export type UpdateInstructorPresentationInput = z.infer<
  typeof UpdateInstructorPresentationSchema
>;

export type InstructorSelfMutationResult = { ok: true } | { ok: false; error: string };

// Updates only the presentation fields: name/bio/photo on the catalog row, phone
// on the (private) access row. Takes a service-role client — the caller (a
// /instructor Server Action) resolves the current instructor and passes their
// id, so an instructor can only ever edit their own row, and only these fields.
export async function updateInstructorPresentation(
  admin: SupabaseClient,
  instructorId: string,
  input: UpdateInstructorPresentationInput,
): Promise<InstructorSelfMutationResult> {
  const { error: rowError } = await admin
    .from("instructors")
    .update({
      name: input.name.trim(),
      bio: input.bio?.trim() || null,
      photo_url: input.photoUrl?.trim() || null,
    })
    .eq("id", instructorId);
  if (rowError) {
    return { ok: false, error: "Couldn't save your profile — try again." };
  }

  const { error: contactError } = await admin
    .from("instructor_portal_access")
    .update({ phone: input.phone?.trim() || null })
    .eq("instructor_id", instructorId);
  if (contactError) {
    return { ok: false, error: "Saved your profile, but the phone number didn't update." };
  }

  return { ok: true };
}
