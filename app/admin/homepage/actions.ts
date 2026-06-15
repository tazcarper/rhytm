"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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
