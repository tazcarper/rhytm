"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { hasAdminAccess } from "@/lib/auth/portal";
import { createEventImageStorage } from "@/lib/storage/event-image-storage";
import {
  uploadPublicImage,
  type UploadPublicImageResult,
} from "@/src/services/admin/upload-public-image";
import {
  saveEvent,
  saveRecurringEvents,
  deleteEvent,
  duplicateEventFromTemplate,
  cancelEventRegistration,
  SaveEventSchema,
  type SaveEventRawInput,
  type SaveEventResult,
  type SaveRecurringEventsResult,
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

export async function saveRecurringEventsAction(
  input: SaveEventRawInput,
  extraDates: string[],
): Promise<SaveRecurringEventsResult> {
  const parsed = SaveEventSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid input",
      createdIds: [],
    };
  }

  const supabase = await createServerSupabaseClient();
  const startDate = parsed.data.startAt?.split("T")[0];
  const result = await saveRecurringEvents(
    supabase,
    parsed.data,
    startDate ? [startDate, ...extraDates] : extraDates,
  );
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

export async function uploadEventImageAction(
  formData: FormData,
): Promise<UploadPublicImageResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!hasAdminAccess(user?.app_metadata?.role as string | undefined)) {
    return { ok: false, error: "Not authorized." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file received." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const storage = createEventImageStorage(createServiceRoleClient());
  return uploadPublicImage(storage, { bytes, contentType: file.type });
}

export async function cancelEventRegistrationAction(
  registrationId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  return cancelEventRegistration(supabase, registrationId);
}
