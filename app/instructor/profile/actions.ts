"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getCurrentInstructor } from "@/src/services/instructors/current-instructor";
import {
  updateInstructorPresentation,
  UpdateInstructorPresentationSchema,
  type UpdateInstructorPresentationInput,
  type InstructorSelfMutationResult,
} from "@/src/services/instructors/self-profile";
import {
  saveInstructorSchedule,
  SaveInstructorScheduleSchema,
  addInstructorException,
  AddInstructorExceptionSchema,
  deleteInstructorException,
  type ScheduleMutationResult,
} from "@/src/services/admin/instructor-schedule";
import {
  createPublicImageStorage,
  INSTRUCTOR_PHOTO_BUCKET,
} from "@/lib/storage/public-image-storage";
import {
  uploadPublicImage,
  type UploadPublicImageResult,
} from "@/src/services/admin/upload-public-image";

// Instructor self-service writes. Every action resolves the CURRENT instructor
// from the session and operates only on that id — a client-passed id is never
// trusted. Writes then go through the service-role client, reusing the same
// schedule services the admin uses (the instructor just can't choose whose
// schedule). Presentation edits are limited to name/bio/photo/phone by the
// narrow updateInstructorPresentation service.

async function requireCurrentInstructorId(): Promise<
  { ok: true; instructorId: string } | { ok: false; error: string }
> {
  const supabase = await createServerSupabaseClient();
  const instructor = await getCurrentInstructor(supabase).catch(() => null);
  if (!instructor) {
    return { ok: false, error: "You don't have an instructor profile to edit." };
  }
  return { ok: true, instructorId: instructor.id };
}

export async function saveInstructorSelfProfileAction(
  input: UpdateInstructorPresentationInput,
): Promise<InstructorSelfMutationResult> {
  const parsed = UpdateInstructorPresentationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const guard = await requireCurrentInstructorId();
  if (!guard.ok) return { ok: false, error: guard.error };

  const result = await updateInstructorPresentation(
    createServiceRoleClient(),
    guard.instructorId,
    parsed.data,
  );
  if (result.ok) {
    revalidatePath("/instructor/profile");
    revalidatePath("/instructor");
    revalidatePath("/admin/instructors");
    revalidatePath("/instructors");
  }
  return result;
}

export async function saveInstructorSelfScheduleAction(input: {
  windows: Array<{
    propertyId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
}): Promise<ScheduleMutationResult> {
  const guard = await requireCurrentInstructorId();
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = SaveInstructorScheduleSchema.safeParse({
    instructorId: guard.instructorId,
    windows: input.windows,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the schedule." };
  }

  const result = await saveInstructorSchedule(createServiceRoleClient(), parsed.data);
  if (result.ok) revalidatePath("/instructor/profile");
  return result;
}

export async function addInstructorSelfExceptionAction(input: {
  propertyId: string | null;
  date: string;
  kind: "unavailable" | "available";
  startTime: string | null;
  endTime: string | null;
  reason?: string;
}): Promise<ScheduleMutationResult> {
  const guard = await requireCurrentInstructorId();
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = AddInstructorExceptionSchema.safeParse({
    instructorId: guard.instructorId,
    ...input,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the exception." };
  }

  const result = await addInstructorException(createServiceRoleClient(), parsed.data);
  if (result.ok) revalidatePath("/instructor/profile");
  return result;
}

export async function deleteInstructorSelfExceptionAction(input: {
  exceptionId: string;
}): Promise<ScheduleMutationResult> {
  const guard = await requireCurrentInstructorId();
  if (!guard.ok) return { ok: false, error: guard.error };

  const result = await deleteInstructorException(
    createServiceRoleClient(),
    guard.instructorId,
    input.exceptionId,
  );
  if (result.ok) revalidatePath("/instructor/profile");
  return result;
}

// Upload the instructor's own photo to the public instructor-photos bucket.
// Instructor-gated (must resolve to a current instructor), then service-role
// storage write — mirrors the admin uploadInstructorPhotoAction.
export async function uploadInstructorSelfPhotoAction(
  formData: FormData,
): Promise<UploadPublicImageResult> {
  const guard = await requireCurrentInstructorId();
  if (!guard.ok) return { ok: false, error: "Not authorized." };

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file received." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const storage = createPublicImageStorage(
    createServiceRoleClient(),
    INSTRUCTOR_PHOTO_BUCKET,
  );
  return uploadPublicImage(storage, { bytes, contentType: file.type });
}
