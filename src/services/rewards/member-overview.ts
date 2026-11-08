import type { SupabaseClient } from "@supabase/supabase-js";
import type { RewardsProgram } from "@/src/constants/rewards/program";
import {
  getRewardActivity,
  getRewardBalances,
  type RewardActivity,
  type RewardBalance,
} from "@/src/services/rewards/accounts";
import {
  getRewardSuggestions,
  type RewardSuggestion,
} from "@/src/services/rewards/suggestions";

// Everything the member profile's Rewards section shows, one entry per
// active membership the signed-in member is on. Runs under the member's
// RLS scope (their own households only).

export interface MemberRewardsOverview extends RewardBalance {
  memberNumber: string;
  propertyName: string;
  recentActivity: RewardActivity[];
  suggestions: RewardSuggestion[];
}

export async function getMyRewardsOverview(
  supabase: SupabaseClient,
  program: RewardsProgram,
): Promise<MemberRewardsOverview[]> {
  const { data, error } = await supabase
    .from("memberships")
    .select("id, member_number, property_id, status, properties ( name )")
    .eq("status", "active");
  if (error || !data) return [];

  const balances = await getRewardBalances(
    supabase,
    data.map((row) => row.id as string),
  );

  return Promise.all(
    data.map(async (row): Promise<MemberRewardsOverview> => {
      const membershipId = row.id as string;
      const balance = balances.get(membershipId)!;
      const property = Array.isArray(row.properties) ? row.properties[0] : row.properties;
      const [recentActivity, suggestions] = await Promise.all([
        getRewardActivity(supabase, membershipId, 5),
        balance.isExpired
          ? Promise.resolve([] as RewardSuggestion[])
          : getRewardSuggestions(supabase, program, {
              propertyId: row.property_id as string,
              balance: balance.balance,
            }),
      ]);
      return {
        ...balance,
        memberNumber: row.member_number as string,
        propertyName: (property as { name?: string } | null)?.name ?? "",
        recentActivity,
        suggestions,
      };
    }),
  );
}
