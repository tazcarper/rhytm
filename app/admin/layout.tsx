import { type ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasAdminAccess } from "@/lib/auth/portal";
import { AdminNav } from "@/src/components/admin/admin-nav";
import { getAdminDashboardCounts } from "@/src/services/admin/dashboard";
import { staffNeedsOnboarding } from "@/src/services/admin/team";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createServerSupabaseClient();

  const [{ data: userData }, counts, requestHeaders] = await Promise.all([
    supabase.auth.getUser(),
    getAdminDashboardCounts(supabase).catch(() => ({ pendingBids: 0 })),
    headers(),
  ]);

  const user = userData.user;
  const role = user?.app_metadata?.role as string | undefined;

  // First-sign-in gate: a staff member with no name yet is sent to the
  // onboarding step and can't use the portal until they complete it. The
  // /admin/welcome route itself is excluded (no loop) and renders without the
  // nav. Fails open if the staff_profiles table can't be read.
  const pathname = requestHeaders.get("x-pathname") ?? "";
  const onWelcome = pathname.startsWith("/admin/welcome");
  if (user && hasAdminAccess(role) && !onWelcome) {
    if (await staffNeedsOnboarding(user.id)) {
      redirect("/admin/welcome");
    }
  }

  return (
    <>
      {!onWelcome && (
        <AdminNav email={user?.email} role={role} pendingBidCount={counts.pendingBids} />
      )}
      {children}
    </>
  );
}
