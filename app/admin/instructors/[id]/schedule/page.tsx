import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert, Heading, PageShell } from "@/lib/ui";
import { hasAdminAccess } from "@/lib/auth/portal";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { getAdminInstructor } from "@/src/services/admin/instructors";
import { getAdminPropertiesList } from "@/src/services/admin/properties";
import { getInstructorSchedule } from "@/src/services/admin/instructor-schedule";
import { InstructorScheduleEditor } from "@/src/components/admin/instructor-schedule-editor";

export const dynamic = "force-dynamic";

// Weekly availability + time-off editor for one instructor. Same access gate as
// the profile editor (any admin-portal role reaches it; saving re-checks
// super_admin/admin or the owning property manager server-side).
export default async function AdminInstructorSchedulePage({
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
        { label: "Schedule" },
      ]}
    />
  );

  if (!hasAdminAccess(role)) {
    return (
      <PageShell width="wide">
        {breadcrumb}
        <Heading level={1} size="h2" underline>
          Schedule
        </Heading>
        <Alert variant="info" title="Not available" className="mt-4">
          You don&rsquo;t have access to instructor management.
        </Alert>
      </PageShell>
    );
  }

  const [instructor, properties, schedule] = await Promise.all([
    getAdminInstructor(supabase, id),
    getAdminPropertiesList(supabase),
    getInstructorSchedule(supabase, id),
  ]);
  if (!instructor) notFound();

  // The instructor's assigned properties, in the catalog's display order.
  const linkedProperties = properties
    .filter((property) => instructor.propertyIds.includes(property.id))
    .map((property) => ({ id: property.id, name: property.name }));

  return (
    <PageShell width="wide">
      {breadcrumb}
      <Heading level={1} size="h2" underline>
        {instructor.name} — schedule
      </Heading>
      <p className="text-gray font-serif italic text-[15px] mt-2 mb-6 max-w-[62ch]">
        Set the weekly hours this instructor teaches at each property, plus any time off or
        one-off availability. Guests booking a private lesson only see times that fit this
        schedule and aren&rsquo;t already booked.
      </p>

      <InstructorScheduleEditor
        instructorId={instructor.id}
        properties={linkedProperties}
        initialWindows={schedule.windows}
        initialExceptions={schedule.exceptions}
      />
    </PageShell>
  );
}
