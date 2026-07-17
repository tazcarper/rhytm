import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdminDashboardCounts {
  pendingBids: number;
  newInquiries: number;
}

export async function getAdminDashboardCounts(
  supabase: SupabaseClient,
): Promise<AdminDashboardCounts> {
  const [bidsResult, inquiriesResult] = await Promise.all([
    supabase
      .from("bids")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review")
      .is("deleted_at", null),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
  ]);

  if (bidsResult.error) {
    throw new Error(`Admin dashboard counts failed: ${bidsResult.error.message}`);
  }
  if (inquiriesResult.error) {
    throw new Error(`Admin dashboard counts failed: ${inquiriesResult.error.message}`);
  }

  return {
    pendingBids: bidsResult.count ?? 0,
    newInquiries: inquiriesResult.count ?? 0,
  };
}
