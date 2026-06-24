"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  updateEstimateStatus,
  type EstimateStatus,
  type UpdateEstimateStatusResult,
} from "@/src/services/estimates/admin-estimates";

// Thin server action: move a lead along the pipeline. RLS (the
// `estimate_requests: staff update` policy) is the real gate; this validates
// input and revalidates the affected pages.
export async function updateEstimateStatusAction(
  id: string,
  status: EstimateStatus,
): Promise<UpdateEstimateStatusResult> {
  if (!id) return { ok: false, error: "Missing request id." };

  const supabase = await createServerSupabaseClient();
  const result = await updateEstimateStatus(supabase, id, status);

  if (result.ok) {
    revalidatePath("/admin/estimates");
    revalidatePath(`/admin/estimates/${id}`);
  }
  return result;
}
