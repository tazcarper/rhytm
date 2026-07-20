import type { SupabaseClient } from "@supabase/supabase-js";
import { getUnactionedInquiryCount } from "./inquiries";

export interface AdminDashboardCounts {
  pendingBids: number;
  newInquiries: number;
}

export async function getAdminDashboardCounts(
  supabase: SupabaseClient,
): Promise<AdminDashboardCounts> {
  const [bidsResult, newInquiries] = await Promise.all([
    supabase
      .from("bids")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review")
      .is("deleted_at", null),
    getUnactionedInquiryCount(supabase),
  ]);

  if (bidsResult.error) {
    throw new Error(`Admin dashboard counts failed: ${bidsResult.error.message}`);
  }

  return {
    pendingBids: bidsResult.count ?? 0,
    newInquiries,
  };
}
