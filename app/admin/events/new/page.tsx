import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Heading, PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { getAdminPropertiesList } from "@/src/services/admin/properties";
import { getEventTemplates } from "@/src/services/admin/events";
import { getAdminInstructors, getAssignableDisciplines } from "@/src/services/admin/instructors";
import { EventEditorForm } from "@/src/components/admin/event-editor-form";
import { NewEventTemplatePicker } from "@/src/components/admin/new-event-template-picker";

export const dynamic = "force-dynamic";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const { propertyId } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const [properties, templates] = await Promise.all([
    getAdminPropertiesList(supabase),
    getEventTemplates(supabase),
  ]);
  const [disciplineOptions, instructorOptions] = await Promise.all([
    getAssignableDisciplines(supabase, properties.map((property) => property.id)),
    getAdminInstructors(supabase),
  ]);

  return (
    <PageShell width="xxl">
      <AdminBreadcrumb
        segments={[
          { label: "Admin", href: "/admin" },
          { label: "Events", href: "/admin/events" },
          { label: "New" },
        ]}
      />
      <Heading level={1} size="h2" underline>
        New event
      </Heading>

      <NewEventTemplatePicker templates={templates} />

      <EventEditorForm
        event={null}
        properties={properties.map((property) => ({ id: property.id, name: property.name }))}
        disciplineOptions={disciplineOptions}
        instructorOptions={instructorOptions}
        defaultPropertyId={propertyId}
      />
    </PageShell>
  );
}
