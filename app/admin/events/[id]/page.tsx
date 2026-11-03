import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Heading, PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { getEvent, getEventRoster } from "@/src/services/admin/events";
import { getAdminPropertiesList } from "@/src/services/admin/properties";
import { getAdminInstructors, getAssignableDisciplines } from "@/src/services/admin/instructors";
import { EventEditorForm } from "@/src/components/admin/event-editor-form";
import { EventRoster } from "@/src/components/admin/event-roster";
import { EventExtrasEditor } from "@/src/components/admin/event-extras-editor";
import { getEventExtras, hasAnyExtras } from "@/src/services/admin/event-extras";
import { EVENT_STARTERS, isEventStarterKey } from "@/src/constants/admin/event-starters";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ starter?: string }>;
}) {
  const { id } = await params;
  const { starter } = await searchParams;
  const supabase = await createServerSupabaseClient();

  const [event, properties, roster, savedExtras] = await Promise.all([
    getEvent(supabase, id),
    getAdminPropertiesList(supabase),
    getEventRoster(supabase, id),
    getEventExtras(supabase, id),
  ]);

  if (!event) {
    notFound();
  }

  // A freshly created event from a starter has nothing saved yet — offer
  // the starter's tickets/gear/questions as a pre-fill the admin confirms.
  const seedStarter =
    !hasAnyExtras(savedExtras) && isEventStarterKey(starter) ? EVENT_STARTERS[starter] : null;
  const extras = seedStarter ? seedStarter.extras : savedExtras;

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
          { label: event.title },
        ]}
      />
      <Heading level={1} size="h2" underline>
        Edit event
      </Heading>

      <section className="mt-6 mb-10">
        <Heading level={2} size="h3" className="mb-3">
          Registrations
        </Heading>
        <EventRoster rows={roster} />
      </section>

      <EventEditorForm
        event={event}
        properties={properties.map((property) => ({ id: property.id, name: property.name }))}
        disciplineOptions={disciplineOptions}
        instructorOptions={instructorOptions}
      />

      <EventExtrasEditor eventId={event.id} extras={extras} seededFrom={seedStarter?.label} />
    </PageShell>
  );
}
