import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Heading, PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { getEvent, getEventRoster } from "@/src/services/admin/events";
import { getAdminPropertiesList } from "@/src/services/admin/properties";
import { EventEditorForm } from "@/src/components/admin/event-editor-form";
import { EventRoster } from "@/src/components/admin/event-roster";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const [event, properties, roster] = await Promise.all([
    getEvent(supabase, id),
    getAdminPropertiesList(supabase),
    getEventRoster(supabase, id),
  ]);

  if (!event) {
    notFound();
  }

  return (
    <PageShell width="wide">
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
      />
    </PageShell>
  );
}
