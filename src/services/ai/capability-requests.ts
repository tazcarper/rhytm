import type { SupabaseClient } from "@supabase/supabase-js";

// "The event builder can't do this yet" requests collected by the helper.
// A developer reviews them; frequent requests mean the business is missing
// something that should become a default or a starter.

export type CapabilityRequestStatus = "new" | "reviewing" | "planned" | "built" | "declined";

export interface CapabilityRequestInput {
  propertyId: string | null;
  summary: string;
  ownerWords: string;
}

export interface CapabilityRequestRow {
  id: string;
  summary: string;
  ownerWords: string;
  status: CapabilityRequestStatus;
  propertyName: string | null;
  createdAt: string;
}

export async function createCapabilityRequest(
  supabase: SupabaseClient,
  input: CapabilityRequestInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("capability_requests").insert({
    property_id: input.propertyId,
    summary: input.summary.slice(0, 1000),
    owner_words: input.ownerWords.slice(0, 2000),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getCapabilityRequests(supabase: SupabaseClient): Promise<CapabilityRequestRow[]> {
  const { data, error } = await supabase
    .from("capability_requests")
    .select("id, summary, owner_words, status, created_at, properties ( name )")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Couldn't load feature requests: ${error.message}`);

  return (data ?? []).map((row) => {
    const property = Array.isArray(row.properties) ? row.properties[0] : row.properties;
    return {
      id: row.id,
      summary: row.summary,
      ownerWords: row.owner_words,
      status: row.status as CapabilityRequestStatus,
      propertyName: (property as { name: string } | null)?.name ?? null,
      createdAt: row.created_at,
    };
  });
}
