"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  updateBidPricing,
  UpdateBidPricingInputSchema,
  type UpdateBidPricingRawInput,
  type UpdateBidPricingResult,
} from "@/src/services/admin/update-bid-pricing";
import {
  updateBidContent,
  UpdateBidContentInputSchema,
  type UpdateBidContentRawInput,
  type UpdateBidContentResult,
} from "@/src/services/admin/update-bid-content";
import {
  resolveBidLibraryContent,
  type ResolveBidLibraryResult,
} from "@/src/services/admin/resolve-bid-library";

function firstIssueMessage(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): string {
  const issue = issues[0];
  return issue
    ? `${issue.path.map(String).join(".")}: ${issue.message}`
    : "Invalid input";
}

export async function updateBidPricingAction(
  input: UpdateBidPricingRawInput,
): Promise<UpdateBidPricingResult> {
  const parsed = UpdateBidPricingInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssueMessage(parsed.error.issues) };
  }

  const supabase = await createServerSupabaseClient();
  const result = await updateBidPricing(supabase, parsed.data);

  if (result.ok) {
    revalidatePath(`/admin/bids/${parsed.data.bidId}`);
    revalidatePath("/admin/bids");
  }

  return result;
}

export async function updateBidContentAction(
  input: UpdateBidContentRawInput,
): Promise<UpdateBidContentResult> {
  const parsed = UpdateBidContentInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssueMessage(parsed.error.issues) };
  }

  const supabase = await createServerSupabaseClient();
  const result = await updateBidContent(supabase, parsed.data);

  if (result.ok) {
    revalidatePath(`/admin/bids/${parsed.data.bidId}`);
    revalidatePath("/admin/bids");
  }

  return result;
}

// Resolve-only: returns what the content library would auto-fill for this bid.
// Does not persist — the drawer merges the result into its draft, and saving
// goes through updateBidContentAction.
export async function repullBidContentAction(
  bidId: string,
): Promise<ResolveBidLibraryResult> {
  const supabase = await createServerSupabaseClient();
  return resolveBidLibraryContent(supabase, bidId);
}
