import type { SupabaseClient } from "@supabase/supabase-js";

// Signed-waiver list for the admin. Reads via the caller's RLS-scoped client
// (admins see all; property managers see their property's — bid-linked via
// the existing policy, standalone via the new property_manager policy).

export interface WaiverRow {
  id: string;
  signedName: string;
  signerEmail: string | null;
  createdAt: string;
  bidId: string | null;
  propertyName: string | null;
}

interface RawWaiverRow {
  id: string;
  signed_name: string;
  signer_email: string | null;
  created_at: string;
  bid_id: string | null;
  property_id: string | null;
  properties: { name: string } | { name: string }[] | null;
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getWaivers(
  supabase: SupabaseClient,
  search?: string,
): Promise<WaiverRow[]> {
  let query = supabase
    .from("waiver_documents")
    .select("id, signed_name, signer_email, created_at, bid_id, property_id, properties ( name )")
    .order("created_at", { ascending: false })
    .limit(100);

  const safe = search?.replace(/[%(),]/g, " ").trim();
  if (safe) {
    query = query.or(`signed_name.ilike.%${safe}%,signer_email.ilike.%${safe}%`);
  }

  const { data } = await query;
  return ((data as RawWaiverRow[] | null) ?? []).map((row) => ({
    id: row.id,
    signedName: row.signed_name,
    signerEmail: row.signer_email,
    createdAt: row.created_at,
    bidId: row.bid_id,
    propertyName: pickOne(row.properties)?.name ?? null,
  }));
}
