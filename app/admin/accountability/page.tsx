import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Heading, PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { canManageTeam } from "@/lib/auth/portal";
import { getOrgSeats } from "@/src/services/admin/accountability";
import { AccountabilityView } from "@/src/components/admin/accountability/accountability-view";

export const dynamic = "force-dynamic";

// Chart of Accountability — the company org structure. Viewable by any staff
// role (the /admin layout gates access); editing is limited to super-admins +
// admins (canManageTeam), enforced again in the server actions.
export default async function AccountabilityPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const editable = canManageTeam(user?.app_metadata?.role as string | undefined);

  const seats = await getOrgSeats();

  return (
    <PageShell width="xl">
      <AdminBreadcrumb
        segments={[{ label: "Admin", href: "/admin" }, { label: "Accountability Chart" }]}
      />
      <Heading level={1} size="h2" underline>
        Chart of Accountability
      </Heading>
      <p className="text-gray font-serif italic text-[15px] mt-2 mb-2 max-w-[62ch]">
        The living command structure of Rhythm Outdoors — every seat and every
        accountability across Hog Heaven, Horseshoe Bay, and Packsaddle Precision.
      </p>

      <AccountabilityView seats={seats} editable={editable} />
    </PageShell>
  );
}
