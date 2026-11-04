import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageShell } from "@/lib/ui";
import { EventPageTitle } from "@/src/components/admin/event-page-title";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { getAdminPropertiesList } from "@/src/services/admin/properties";
import { getEventTemplates } from "@/src/services/admin/events";
import { getGearPresets } from "@/src/services/admin/gear-presets";
import { EventStartForm } from "@/src/components/admin/event-start-form";
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
  const [properties, templates, gearPresets] = await Promise.all([
    getAdminPropertiesList(supabase),
    getEventTemplates(supabase),
    getGearPresets(supabase),
  ]);

  const manualStart = (
    <EventStartForm
      // Remount when the starter changes so the form re-reads its defaults.
      key={activeStarter?.key ?? "blank"}
      properties={properties.map((property) => ({ id: property.id, name: property.name }))}
      defaultPropertyId={propertyId}
      starter={activeStarter}
      newEventGear={gearPresets.filter((preset) => preset.addToNewEvents)}
      starterPicker={
        <NewEventStarterPicker starters={Object.values(EVENT_STARTERS)} activeKey={activeStarter?.key ?? null} />
      }
      footer={<NewEventTemplatePicker templates={templates} />}
    />
  );

  return (
    <PageShell width="xxl">
      <AdminBreadcrumb
        segments={[
          { label: "Admin", href: "/admin" },
          { label: "Events", href: "/admin/events" },
          { label: "New" },
        ]}
      />
      <EventPageTitle>New event</EventPageTitle>

      {/* Basics form first; the helper chat sits beside it for anyone who'd
          rather describe the event than fill in fields. */}
      <div
        className={`mt-6 grid items-start gap-8 ${
          showHelper ? "xl:grid-cols-[minmax(0,1.6fr)_minmax(22rem,1fr)]" : ""
        }`}
      >
        {manualStart}
        {showHelper && (
          <aside aria-label="Event helper" className="xl:sticky xl:top-6">
            <EventHelperPanel propertyId={propertyId ?? null} />
          </aside>
        )}
      </div>
    </PageShell>
  );
}
