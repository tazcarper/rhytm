import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdminDashboardCounts {
  pendingBids: number;
}

export async function getAdminDashboardCounts(
  supabase: SupabaseClient,
): Promise<AdminDashboardCounts> {
  const { count, error } = await supabase
    .from("bids")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_review")
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Admin dashboard counts failed: ${error.message}`);
  }

  return { pendingBids: count ?? 0 };
}
