"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  updateAdminProperty,
  UpdateAdminPropertyInputSchema,
  type UpdateAdminPropertyRawInput,
  type UpdateAdminPropertyResult,
} from "@/src/services/admin/properties";

export async function updateAdminPropertyAction(
  input: UpdateAdminPropertyRawInput,
): Promise<UpdateAdminPropertyResult> {
  const parsed = UpdateAdminPropertyInputSchema.safeParse(input);
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
  const result = await updateAdminProperty(supabase, parsed.data);

  if (result.ok) {
    revalidatePath("/admin/properties");
    revalidatePath("/");
  }

  return result;
}
