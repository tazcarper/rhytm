"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  updateAdminBid,
  UpdateAdminBidInputSchema,
  type UpdateAdminBidRawInput,
  type UpdateAdminBidResult,
} from "@/src/services/admin/update-bid";

export async function updateAdminBidAction(
  input: UpdateAdminBidRawInput,
): Promise<UpdateAdminBidResult> {
  const parsed = UpdateAdminBidInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid input",
    };
  }

  const supabase = await createServerSupabaseClient();
  const result = await updateAdminBid(supabase, parsed.data);

  if (result.ok) {
    revalidatePath(`/admin/bids/${parsed.data.bidId}`);
    revalidatePath("/admin/bids");
  }

  return result;
}
