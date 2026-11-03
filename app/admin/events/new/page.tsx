import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Heading, PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { getAdminPropertiesList } from "@/src/services/admin/properties";
import { getEventTemplates } from "@/src/services/admin/events";
import { getAdminInstructors, getAssignableDisciplines } from "@/src/services/admin/instructors";
import { EventEditorForm } from "@/src/components/admin/event-editor-form";
import { NewEventTemplatePicker } from "@/src/components/admin/new-event-template-picker";
import { NewEventStarterPicker } from "@/src/components/admin/new-event-starter-picker";
import { EventHelperPanel } from "@/src/components/admin/event-helper-panel";
import { EVENT_STARTERS, isEventStarterKey } from "@/src/constants/admin/event-starters";

// Roles that get the AI helper (pilot decision, 2026-11-03). Mirrors
// HELPER_ROLES in app/api/admin/event-helper/route.ts.
const HELPER_ROLES = new Set(["super_admin", "admin", "property_manager"]);

export const dynamic = "force-dynamic";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string; starter?: string }>;
}) {
  const { propertyId, starter } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const showHelper = HELPER_ROLES.has((user?.app_metadata?.role as string | undefined) ?? "");
  const activeStarter = isEventStarterKey(starter) ? EVENT_STARTERS[starter] : null;
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

      {showHelper && <EventHelperPanel propertyId={propertyId ?? null} />}

      <NewEventStarterPicker starters={Object.values(EVENT_STARTERS)} activeKey={activeStarter?.key ?? null} />

      <NewEventTemplatePicker templates={templates} />

      <EventEditorForm
        // Remount when the starter changes so the form re-reads its seed.
        key={activeStarter?.key ?? "blank"}
        seed={
          activeStarter
            ? {
                starterKey: activeStarter.key,
                type: activeStarter.defaults.type,
                maxCapacity: activeStarter.defaults.maxCapacity,
                maxGuestsPerRegistration: activeStarter.defaults.maxGuestsPerRegistration,
                infoBoxes: activeStarter.defaults.infoBoxes,
              }
            : undefined
        }
        event={null}
        properties={properties.map((property) => ({ id: property.id, name: property.name }))}
        disciplineOptions={disciplineOptions}
        instructorOptions={instructorOptions}
        defaultPropertyId={propertyId}
      />
    </PageShell>
  );
}
