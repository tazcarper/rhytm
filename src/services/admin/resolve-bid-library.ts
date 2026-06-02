import type { SupabaseClient } from "@supabase/supabase-js";

// Reads the FAQ + gear the content library WOULD auto-fill for an existing
// bid, via the staff-gated repull_bid_content RPC. Resolve-only — it never
// writes; the bid editor merges this into its local draft and the existing
// updateBidContent path persists the frozen snapshot on save.

export interface BidLibraryGearItem {
  name: string;
  description?: string;
}

export interface BidLibraryFaqItem {
  question: string;
  answer: string;
}

export interface BidLibraryContent {
  gearList: BidLibraryGearItem[];
  faq: BidLibraryFaqItem[];
}

export type ResolveBidLibraryResult =
  | { ok: true; content: BidLibraryContent }
  | { ok: false; error: string };

// The RPC returns a single row of (faq jsonb, gear jsonb). supabase-js maps a
// RETURNS TABLE function to an array of rows.
type RepullRow = {
  faq: unknown;
  gear: unknown;
};

function toGearList(value: unknown): BidLibraryGearItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is { name: string; description?: string } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { name?: unknown }).name === "string",
    )
    .map((item) =>
      typeof item.description === "string" && item.description
        ? { name: item.name, description: item.description }
        : { name: item.name },
    );
}

function toFaq(value: unknown): BidLibraryFaqItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is BidLibraryFaqItem =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { question?: unknown }).question === "string" &&
      typeof (item as { answer?: unknown }).answer === "string",
  );
}

export async function resolveBidLibraryContent(
  supabase: SupabaseClient,
  bidId: string,
): Promise<ResolveBidLibraryResult> {
  const { data, error } = await supabase.rpc("repull_bid_content", {
    p_bid_id: bidId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const row = (Array.isArray(data) ? data[0] : data) as RepullRow | undefined;
  return {
    ok: true,
    content: {
      gearList: toGearList(row?.gear),
      faq: toFaq(row?.faq),
    },
  };
}
