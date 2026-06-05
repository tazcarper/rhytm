import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert, Heading, PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { canManageTeam } from "@/lib/auth/portal";
import { getTeam } from "@/src/services/admin/team";
import { getAdminPropertiesList } from "@/src/services/admin/properties";
import { InviteTeamForm } from "@/src/components/admin/invite-team-form";
import { TeamList } from "@/src/components/admin/team-list";

export const dynamic = "force-dynamic";

// Team management (super_admin + admin). Invite teammates by email + role;
// they set their name at /admin/welcome on first sign-in.
export default async function TeamPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role as string | undefined;

  if (!canManageTeam(role)) {
    return (
      <PageShell width="wide">
        <AdminBreadcrumb segments={[{ label: "Admin", href: "/admin" }, { label: "Team" }]} />
        <Heading level={1} size="h2" underline>
          Team
        </Heading>
        <Alert variant="info" title="Not available" className="mt-4">
          Only super-admins and admins can manage the team.
        </Alert>
      </PageShell>
    );
  }

  const [team, properties] = await Promise.all([
    getTeam(),
    getAdminPropertiesList(supabase),
  ]);
  const propertyOptions = properties.map((p) => ({ id: p.id, name: p.name }));

  return (
    <PageShell width="wide">
      <AdminBreadcrumb segments={[{ label: "Admin", href: "/admin" }, { label: "Team" }]} />
      <Heading level={1} size="h2" underline>
        Team
      </Heading>
      <p className="text-gray font-serif italic text-[15px] mt-2 mb-6 max-w-[62ch]">
        Invite teammates and see who has access. Each person sets their own name when they first
        sign in.
      </p>

      <div className="flex flex-col gap-6">
        <InviteTeamForm properties={propertyOptions} />
        <TeamList members={team} properties={propertyOptions} currentUserId={user!.id} />
      </div>
    </PageShell>
  );
}
