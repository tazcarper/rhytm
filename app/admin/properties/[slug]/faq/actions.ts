"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  saveFaqEntry,
  deleteFaqEntry,
  SaveFaqEntrySchema,
  type SaveFaqEntryRawInput,
  type SaveFaqEntryResult,
  type DeleteFaqEntryResult,
} from "@/src/services/admin/faq";
import { getAdminPropertyById } from "@/src/services/admin/properties";

export async function saveFaqEntryAction(
  input: SaveFaqEntryRawInput,
): Promise<SaveFaqEntryResult> {
  const parsed = SaveFaqEntrySchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid input",
    };
  }

  const supabase = await createServerSupabaseClient();
  const result = await saveFaqEntry(supabase, parsed.data);
  if (result.ok) {
    const property = await getAdminPropertyById(supabase, parsed.data.propertyId);
    revalidatePath(`/admin/properties/${property?.slug ?? parsed.data.propertyId}/faq`);
    revalidatePath("/horseshoe-bay/faq");
  }
  return result;
}

export async function deleteFaqEntryAction(
  propertyId: string,
  id: string,
): Promise<DeleteFaqEntryResult> {
  const supabase = await createServerSupabaseClient();
  const result = await deleteFaqEntry(supabase, id);
  if (result.ok) {
    const property = await getAdminPropertyById(supabase, propertyId);
    revalidatePath(`/admin/properties/${property?.slug ?? propertyId}/faq`);
    revalidatePath("/horseshoe-bay/faq");
  }
  return result;
}
