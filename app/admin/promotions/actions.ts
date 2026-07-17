"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { hasAdminAccess } from "@/lib/auth/portal";
import { createHomepageImageStorage } from "@/lib/storage/homepage-image-storage";
import {
  uploadPublicImage,
  type UploadPublicImageResult,
} from "@/src/services/admin/upload-public-image";
import {
  savePromotion,
  deletePromotion,
  SavePromotionSchema,
  type SavePromotionRawInput,
  type SavePromotionResult,
} from "@/src/services/admin/promotions";

// Thin actions: validate → service → revalidate the surfaces a promotion can
// appear on. RLS enforces that only admin / super_admin can write.
function revalidatePromotionSurfaces() {
  revalidatePath("/admin/promotions");
  revalidatePath("/");
  revalidatePath("/adventures");
  // Property pages are dynamic (force-dynamic) so they re-read on each hit.
}

export async function savePromotionAction(
  input: SavePromotionRawInput,
): Promise<SavePromotionResult> {
  const parsed = SavePromotionSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue
        ? `${issue.path.join(".")}: ${issue.message}`
        : "Invalid input",
    };
  }

  const supabase = await createServerSupabaseClient();
  const result = await savePromotion(supabase, parsed.data);
  if (result.ok) revalidatePromotionSurfaces();
  return result;
}

export async function deletePromotionAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const result = await deletePromotion(supabase, id);
  if (result.ok) revalidatePromotionSurfaces();
  return result;
}

// Upload one promotion image to the public homepage-images bucket (reused —
// same "public marketing image" purpose) and return its URL for the form to
// drop into the image field. Admin-gated, then writes via service role (the
// bucket has no INSERT policy by design).
export async function uploadPromotionImageAction(
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
  const storage = createHomepageImageStorage(createServiceRoleClient());
  return uploadPublicImage(storage, { bytes, contentType: file.type });
}
