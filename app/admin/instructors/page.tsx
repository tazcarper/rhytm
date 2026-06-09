import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert, Heading, PageShell } from "@/lib/ui";
import { canManageTeam, hasAdminAccess } from "@/lib/auth/portal";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { getAdminInstructors } from "@/src/services/admin/instructors";
import { getAdminPropertiesList } from "@/src/services/admin/properties";
import { CreateInstructorForm } from "@/src/components/admin/create-instructor-form";
import { InstructorPortalList } from "@/src/components/admin/instructor-portal-list";

export const dynamic = "force-dynamic";

// Onboarding for the instructor gameplan portal. Lists instructor records and
// lets admins (or a property manager for their own property) invite each one
// to /instructor. Read-only for concierge / membership coordinators — the
// invite/revoke actions enforce the same scope server-side.
export default async function AdminInstructorsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role as string | undefined;

  const breadcrumb = (
    <AdminBreadcrumb
      segments={[{ label: "Admin", href: "/admin" }, { label: "Instructors" }]}
    />
  );

  if (!hasAdminAccess(role)) {
    return (
      <PageShell width="wide">
        {breadcrumb}
        <Heading level={1} size="h2" underline>
          Instructors
        </Heading>
        <Alert variant="info" title="Not available" className="mt-4">
          You don&rsquo;t have access to instructor management.
        </Alert>
      </PageShell>
    );
  }

  const canCreate = canManageTeam(role);
  const [instructors, properties] = await Promise.all([
    getAdminInstructors(supabase),
    canCreate ? getAdminPropertiesList(supabase) : Promise.resolve([]),
  ]);

  return (
    <PageShell width="wide">
      {breadcrumb}
      <Heading level={1} size="h2" underline>
        Instructors
      </Heading>
      <p className="text-gray font-serif italic text-[15px] mt-2 mb-6 max-w-[62ch]">
        Add instructors and invite them to the gameplan portal. Once invited they
        sign in at the usual login and see a read-only briefing of the events
        they&rsquo;re teaching — guest, activity, and any special requests.
      </p>

      <div className="flex flex-col gap-6">
        {canCreate && (
          <CreateInstructorForm
            properties={properties.map((property) => ({
              id: property.id,
              name: property.name,
            }))}
          />
        )}
        <InstructorPortalList instructors={instructors} />
      </div>
    </PageShell>
  );
}
