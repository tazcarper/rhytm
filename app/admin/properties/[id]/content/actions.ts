"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { hasAdminAccess } from "@/lib/auth/portal";
import {
  savePropertyPageSection,
  SavePropertyPageSectionSchema,
  type SavePropertyPageSectionRawInput,
  type SavePropertyPageSectionResult,
} from "@/src/services/admin/property-page-content";
import { createPropertyContentImageStorage } from "@/lib/storage/property-content-image-storage";
import {
  uploadPublicImage,
  type UploadPublicImageResult,
} from "@/src/services/admin/upload-public-image";

// The public route each page_key renders on — only 'home' doesn't map
// directly to its own key (it's the property's index page).
const PUBLIC_PATH_BY_PAGE_KEY: Record<string, string> = {
  home: "",
  membership: "membership",
  education: "education",
  private_events: "private-events",
  events: "events",
  adventures: "adventures",
  club_life: "club-life",
};

export async function savePropertyPageContentAction(
  input: SavePropertyPageSectionRawInput,
): Promise<SavePropertyPageSectionResult> {
  const parsed = SavePropertyPageSectionSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid input",
    };
  }

  const supabase = await createServerSupabaseClient();
  const result = await savePropertyPageSection(supabase, parsed.data);
  if (result.ok) {
    revalidatePath(`/admin/properties/${parsed.data.propertyId}/content`);
    if (parsed.data.pageKey === "basics" || parsed.data.pageKey === "layout") {
      // Both feed the shared header/footer chrome rendered by every page
      // under the property's layout — revalidate the whole subtree.
      revalidatePath("/horseshoe-bay", "layout");
    } else {
      const path = PUBLIC_PATH_BY_PAGE_KEY[parsed.data.pageKey] ?? parsed.data.pageKey;
      revalidatePath(`/horseshoe-bay${path ? `/${path}` : ""}`);
    }
  }
  return result;
}

export async function uploadPropertyContentImageAction(
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
  const storage = createPropertyContentImageStorage(createServiceRoleClient());
  return uploadPublicImage(storage, { bytes, contentType: file.type });
}
