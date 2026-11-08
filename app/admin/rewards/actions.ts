"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { REWARDS_PROGRAM } from "@/src/constants/rewards/program";
import { postStaffRewardEntry, setRewardExpiry } from "@/src/services/rewards/ledger";
import {
  buildStaffRewardEntry,
  StaffAdjustmentSchema,
  type StaffAdjustmentInput,
} from "@/src/services/rewards/staff-adjust";

// Thin actions: validate → service → revalidate. The database functions
// check that the signed-in staff member may change this membership and
// stamp who did it, so nothing here needs elevated access.

export type RewardActionResult = { ok: true } | { ok: false; error: string };

function revalidateRewards(membershipId: string) {
  revalidatePath("/admin/rewards");
  revalidatePath(`/admin/rewards/${membershipId}`);
}

export async function adjustRewardPointsAction(
  input: StaffAdjustmentInput,
): Promise<RewardActionResult> {
  const parsed = StaffAdjustmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const built = buildStaffRewardEntry(REWARDS_PROGRAM, parsed.data);
  if (!built.ok) return built;

  const supabase = await createServerSupabaseClient();
  const result = await postStaffRewardEntry(supabase, built.entry);
  if (!result.ok) return { ok: false, error: result.message };

  revalidateRewards(parsed.data.membershipId);
  return { ok: true };
}

export async function setRewardExpiryAction(
  membershipId: string,
  expiresOn: string,
): Promise<RewardActionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) {
    return { ok: false, error: "Pick a date." };
  }
  const supabase = await createServerSupabaseClient();
  // End of the chosen day, Central time (all three properties are in Texas).
  const result = await setRewardExpiry(supabase, membershipId, `${expiresOn}T23:59:59-06:00`);
  if (!result.ok) return { ok: false, error: result.message };
  revalidateRewards(membershipId);
  return { ok: true };
}
