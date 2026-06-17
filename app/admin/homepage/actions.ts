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
  updateHomepageHero,
  UpdateHomepageHeroInputSchema,
  type UpdateHomepageHeroRawInput,
  type UpdateHomepageHeroResult,
} from "@/src/services/admin/homepage-hero";

// Thin action: validate input, call the service, revalidate the two pages
// that show the hero (the admin editor and the public homepage). RLS does
// the authorization — only admin / super_admin can write the row.
export async function updateHomepageHeroAction(
  input: UpdateHomepageHeroRawInput,
): Promise<UpdateHomepageHeroResult> {
  const parsed = UpdateHomepageHeroInputSchema.safeParse(input);
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
  const result = await updateHomepageHero(supabase, parsed.data);

  if (result.ok) {
    revalidatePath("/admin/homepage");
    revalidatePath("/");
  }

  return result;
}

// Upload one hero background image to the public homepage-images bucket and
// return its public URL for the form to drop into the image field — the same
// field a pasted URL fills, so the renderer is unchanged. Admin-gated, then
// writes via service role (the bucket has no INSERT policy by design). Thin:
// auth + extract file + delegate to the generic public-image service.
export async function uploadHomepageHeroImageAction(
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
