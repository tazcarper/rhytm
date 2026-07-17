"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  saveEvent,
  deleteEvent,
  duplicateEventFromTemplate,
  cancelEventRegistration,
  SaveEventSchema,
  type SaveEventRawInput,
  type SaveEventResult,
} from "@/src/services/admin/events";

// Thin actions: validate → service → revalidate the surfaces an event can
// appear on. RLS enforces that only admin / super_admin / the owning
// property_manager can write.
function revalidateEventSurfaces() {
  revalidatePath("/admin/events");
}

export async function saveEventAction(input: SaveEventRawInput): Promise<SaveEventResult> {
  const parsed = SaveEventSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid input",
    };
  }

  const supabase = await createServerSupabaseClient();
  const result = await saveEvent(supabase, parsed.data);
  if (result.ok) revalidateEventSurfaces();
  return result;
}

export async function deleteEventAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const result = await deleteEvent(supabase, id);
  if (result.ok) revalidateEventSurfaces();
  return result;
}

export async function duplicateEventFromTemplateAction(
  templateId: string,
): Promise<SaveEventResult> {
  const supabase = await createServerSupabaseClient();
  const result = await duplicateEventFromTemplate(supabase, templateId);
  if (result.ok) revalidateEventSurfaces();
  return result;
}

export async function cancelEventRegistrationAction(
  registrationId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  return cancelEventRegistration(supabase, registrationId);
}
