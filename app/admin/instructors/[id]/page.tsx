import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert, Heading, PageShell } from "@/lib/ui";
import { canManageTeam, hasAdminAccess } from "@/lib/auth/portal";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import {
  getAdminInstructor,
  getAssignableDisciplines,
} from "@/src/services/admin/instructors";
import { getAdminPropertiesList } from "@/src/services/admin/properties";
import { InstructorProfileEditorForm } from "@/src/components/admin/instructor-profile-editor-form";
import { InstructorStatusBadges } from "@/src/components/admin/instructor-status-badges";

export const dynamic = "force-dynamic";

// Profile editor for one instructor — photo, bio, availability, visibility.
// Same access gate as the instructors index (any admin-portal role can reach
// it; saving re-checks super_admin/admin or the owning property manager
// server-side).
export default async function AdminInstructorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role as string | undefined;

  const breadcrumb = (
    <AdminBreadcrumb
      segments={[
        { label: "Admin", href: "/admin" },
        { label: "Instructors", href: "/admin/instructors" },
        { label: "Profile" },
      ]}
    />
  );

  if (!hasAdminAccess(role)) {
    return (
      <PageShell width="wide">
        {breadcrumb}
        <Heading level={1} size="h2" underline>
          Instructor
        </Heading>
        <Alert variant="info" title="Not available" className="mt-4">
          You don&rsquo;t have access to instructor management.
        </Alert>
      </PageShell>
    );
  }

  const [instructor, properties] = await Promise.all([
    getAdminInstructor(supabase, id),
    getAdminPropertiesList(supabase),
  ]);
  if (!instructor) notFound();

  // Disciplines across every property, so the editor can react to property
  // checkbox toggles client-side without a round-trip.
  const disciplines = await getAssignableDisciplines(
    supabase,
    properties.map((property) => property.id),
  );

  return (
    <PageShell width="wide">
      {breadcrumb}
      <Heading level={1} size="h2" underline>
        {instructor.name}
      </Heading>
      <p className="text-gray font-serif italic text-[15px] mt-2 mb-2 max-w-[62ch]">
        Build this instructor&rsquo;s guest-facing profile — the photo and bio appear on the
        public instructors page and in the private-lesson booking picker.
      </p>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="font-sans text-[12px] uppercase tracking-[0.5px] text-gray">
          {instructor.email ?? "No contact email"}
          {instructor.phone ? ` · ${instructor.phone}` : ""}
        </span>
        <span className="text-gray">·</span>
        <InstructorStatusBadges
          isActive={instructor.isActive}
          hasPortalAccess={instructor.hasPortalAccess}
        />
        <Link
          href={`/admin/instructors/${instructor.id}/schedule`}
          className="ml-auto font-sans text-[12px] uppercase tracking-[0.5px] text-olive underline underline-offset-2"
        >
          Weekly schedule &amp; time off →
        </Link>
      </div>

      <InstructorProfileEditorForm
        properties={properties.map((property) => ({
          id: property.id,
          name: property.name,
        }))}
        disciplines={disciplines}
        initial={instructor}
        canDelete={canManageTeam(role)}
      />
    </PageShell>
  );
}
