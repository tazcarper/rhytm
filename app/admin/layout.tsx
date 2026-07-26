import { type ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasAdminAccess } from "@/lib/auth/portal";
import { AdminSidebar } from "@/src/components/admin/admin-sidebar";
import { getAdminDashboardCounts } from "@/src/services/admin/dashboard";
import { staffNeedsOnboarding } from "@/src/services/admin/team";
import { getAdminPropertiesWithLogos } from "@/src/services/admin/properties";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createServerSupabaseClient();

  const [{ data: userData }, counts, requestHeaders, properties] = await Promise.all([
    supabase.auth.getUser(),
    getAdminDashboardCounts(supabase).catch(() => ({ pendingBids: 0, newInquiries: 0 })),
    headers(),
    getAdminPropertiesWithLogos(supabase).catch(() => []),
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

  if (onWelcome) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen">
      <AdminSidebar
        email={user?.email}
        role={role}
        pendingBidCount={counts.pendingBids}
        newInquiryCount={counts.newInquiries}
        properties={properties.map((property) => ({
          id: property.id,
          name: property.name,
          slug: property.slug,
          logoUrl: property.logoUrl,
        }))}
      />
      {/* Desktop rail is fixed; give the content column room for it. */}
      <div className="lg:pl-60">{children}</div>
    </div>
  );
}
