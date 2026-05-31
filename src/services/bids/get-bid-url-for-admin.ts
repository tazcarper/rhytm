import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAbsoluteBidUrl } from "./bid-url";

// Server-side recovery of a bid's public URL for admin-triggered flows
// (confirmation email, future deposit nudges, etc.).
//
// Reads `bids.access_code_plaintext`, populated at create + regenerate
// time by the RPCs updated in
// 20260530170100_write_access_code_plaintext_in_rpcs.sql.
//
// Returns { url: null } when:
//   - The bid was created before Phase 1 of this change (legacy row).
//   - The bid was somehow inserted without going through the RPC.
//
// Callers MUST handle null gracefully (typically: fall back to "use
// your original email" copy in templates) — we do not throw, because
// missing plaintext is a known, recoverable state for legacy rows.
//
// MUST be called with a service-role client. Authenticated clients can
// read the column for their own rows under existing RLS, but the
// admin-flow callers (Inngest functions, webhook handlers) don't have
// a per-request user context — they use service role uniformly.

interface BidUrlRow {
  slug: string;
  access_code_plaintext: string | null;
}

export interface BidUrlResult {
  url: string | null;
}

export async function getBidUrlForAdmin(
  supabase: SupabaseClient,
  bidId: string,
  origin: string,
): Promise<BidUrlResult> {
  const { data, error } = await supabase
    .from("bids")
    .select("slug, access_code_plaintext")
    .eq("id", bidId)
    .single<BidUrlRow>();

  if (error || !data) {
    throw new Error(
      `getBidUrlForAdmin: bid ${bidId} lookup failed: ${
        error?.message ?? "no row"
      }`,
    );
  }

  if (!data.access_code_plaintext) {
    return { url: null };
  }

  return {
    url: buildAbsoluteBidUrl(origin, data.slug, data.access_code_plaintext),
  };
}
