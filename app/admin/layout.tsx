import { type ReactNode } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AdminNav } from "@/src/components/admin/admin-nav";
import { getAdminDashboardCounts } from "@/src/services/admin/dashboard";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createServerSupabaseClient();

  const [{ data: userData }, counts] = await Promise.all([
    supabase.auth.getUser(),
    getAdminDashboardCounts(supabase).catch(() => ({ pendingBids: 0 })),
  ]);

  const user = userData.user;
  const role = user?.app_metadata?.role as string | undefined;

  return (
    <>
      <AdminNav
        email={user?.email}
        role={role}
        pendingBidCount={counts.pendingBids}
      />
      {children}
    </>
  );
}
