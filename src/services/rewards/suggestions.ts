import type { SupabaseClient } from "@supabase/supabase-js";
import type { RewardsProgram } from "@/src/constants/rewards/program";
import { dollarsForPoints } from "@/src/services/rewards/points";

// "What can I get with my points?" — real, bookable things at the
// member's property, ranked by what they can afford now and what they're
// close to. Today the source is upcoming member adventures; more sources
// (lessons, merchandise) slot in as extra providers (Open/Closed).

export interface RewardSuggestion {
  title: string;
  /** Dollar price of the item. */
  priceUsd: number;
  /** Points that would cover it outright. */
  pointsToCover: number;
  /** True when the balance covers the whole price. */
  affordable: boolean;
  /** Points still needed when not affordable. */
  pointsShort: number;
  href: string;
  detail: string;
}

type SuggestionProvider = (
  supabase: SupabaseClient,
  propertyId: string,
) => Promise<Array<{ title: string; priceUsd: number; href: string; detail: string }>>;

const upcomingAdventures: SuggestionProvider = async (supabase, propertyId) => {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("member_adventures")
    .select("id, title, price, start_date")
    .eq("property_id", propertyId)
    .eq("status", "published")
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .limit(10);
  return (data ?? []).map((row) => ({
    title: row.title as string,
    priceUsd: Number(row.price),
    href: `/member/adventures#${row.id as string}`,
    detail: `Member adventure · ${row.start_date as string}`,
  }));
};

const PROVIDERS: ReadonlyArray<SuggestionProvider> = [upcomingAdventures];

export async function getRewardSuggestions(
  supabase: SupabaseClient,
  program: RewardsProgram,
  input: { propertyId: string; balance: number; limit?: number },
): Promise<RewardSuggestion[]> {
  const items = (
    await Promise.all(PROVIDERS.map((provider) => provider(supabase, input.propertyId)))
  ).flat();

  const valueUsd = dollarsForPoints(program, input.balance);
  const suggestions = items
    .filter((item) => item.priceUsd > 0)
    .map((item): RewardSuggestion => {
      const pointsToCover = Math.ceil(item.priceUsd / program.dollarsPerPoint - 1e-9);
      const affordable = valueUsd + 1e-9 >= item.priceUsd;
      return {
        ...item,
        pointsToCover,
        affordable,
        pointsShort: affordable ? 0 : pointsToCover - input.balance,
      };
    });

  // Affordable first (priciest first — the best use of points), then the
  // ones they're closest to.
  suggestions.sort((a, b) => {
    if (a.affordable !== b.affordable) return a.affordable ? -1 : 1;
    return a.affordable ? b.priceUsd - a.priceUsd : a.pointsShort - b.pointsShort;
  });
  return suggestions.slice(0, input.limit ?? 3);
}
