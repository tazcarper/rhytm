import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageShell } from "@/lib/ui";
import { EventPageSubhead, EventPageTitle } from "@/src/components/admin/event-page-title";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { getEvent, getEventRoster } from "@/src/services/admin/events";
import { getAdminPropertiesList } from "@/src/services/admin/properties";
import { getAdminInstructors, getAssignableDisciplines } from "@/src/services/admin/instructors";
import { EventEditorForm } from "@/src/components/admin/event-editor-form";
import { EventRoster } from "@/src/components/admin/event-roster";
import { getEventExtras } from "@/src/services/admin/event-extras";
import { getGearPresets } from "@/src/services/admin/gear-presets";
import { sectionFromStepSlug } from "@/src/services/admin/event-form-check";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ started?: string; step?: string }>;
}) {
  const { id } = await params;
  const { started, step } = await searchParams;
  const supabase = await createServerSupabaseClient();

  const [event, properties, roster, extras, gearPresets] = await Promise.all([
    getEvent(supabase, id),
    getAdminPropertiesList(supabase),
    getEventRoster(supabase, id),
    getEventExtras(supabase, id),
    getGearPresets(supabase),
  ]);

  if (!event) {
    notFound();
  }

  const [disciplineOptions, instructorOptions] = await Promise.all([
    getAssignableDisciplines(supabase, properties.map((property) => property.id)),
    getAdminInstructors(supabase),
  ]);

  const registrations = (
    <section className="mt-6 mb-10">
      <EventPageSubhead>Registrations</EventPageSubhead>
      <EventRoster rows={roster} />
    </section>
  );

  return (
    <PageShell width="xxl">
      <AdminBreadcrumb
        segments={[
          { label: "Admin", href: "/admin" },
          { label: "Events", href: "/admin/events" },
          { label: event.title },
        ]}
      />
      <EventPageTitle>Edit event</EventPageTitle>

      {/* Sign-ups come first once there are any; a fresh draft goes straight to the builder. */}
      {roster.length > 0 && registrations}

      <div className="mt-6">
        <EventEditorForm
          event={event}
          properties={properties.map((property) => ({ id: property.id, name: property.name }))}
          disciplineOptions={disciplineOptions}
          instructorOptions={instructorOptions}
          extras={extras}
          gearPresets={gearPresets}
          justStarted={started === "1"}
          initialStep={sectionFromStepSlug(step) ?? undefined}
        />
      </div>

      {roster.length === 0 && registrations}
    </PageShell>
  );
}
