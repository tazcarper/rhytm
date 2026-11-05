import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageShell } from "@/lib/ui";
import { EventPageSubhead, EventPageTitle } from "@/src/components/admin/event-page-title";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { getEvent, getEventRoster, getEventTemplates } from "@/src/services/admin/events";
import { getAdminPropertiesList } from "@/src/services/admin/properties";
import { getAdminInstructors, getAssignableDisciplines } from "@/src/services/admin/instructors";
import { EventEditorWorkspace } from "@/src/components/admin/event-editor-workspace";
import { EVENT_HELPER_ROLES } from "@/src/constants/admin/event-helper";
import { createDraftSessionStore } from "@/src/services/ai/draft-session-store";
import { helperTranscript } from "@/src/services/ai/event-helper";
import { EventRoster } from "@/src/components/admin/event-roster";
import { getEventExtras } from "@/src/services/admin/event-extras";
import { getGearPresets } from "@/src/services/admin/gear-presets";
import { sectionFromStepSlug } from "@/src/services/admin/event-form-check";
import { getFeatureRequestsForEvents } from "@/src/services/ai/capability-requests";
import { EventFeatureRequestNotice } from "@/src/components/admin/event-feature-request-notice";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ started?: string; step?: string; helper?: string }>;
}) {
  const { id } = await params;
  const { started, step, helper } = await searchParams;
  const supabase = await createServerSupabaseClient();

  const [event, properties, roster, extras, gearPresets, featureRequests, templates] = await Promise.all([
    getEvent(supabase, id),
    getAdminPropertiesList(supabase),
    getEventRoster(supabase, id),
    getEventExtras(supabase, id),
    getGearPresets(supabase),
    getFeatureRequestsForEvents(supabase, [id]),
    getEventTemplates(supabase).catch(() => []),
  ]);

  if (!event) {
    notFound();
  }

  // The helper's conversation about this event (the caller's own, by RLS),
  // shown in the AI helper tab beside the builder.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const canUseHelper = EVENT_HELPER_ROLES.has((user?.app_metadata?.role as string | undefined) ?? "");
  const helperSession = canUseHelper
    ? await createDraftSessionStore(supabase)
        .latestForEvent(id)
        .catch(() => null)
    : null;

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

      {featureRequests.has(id) && (
        <div className="mt-6">
          <EventFeatureRequestNotice requests={featureRequests.get(id) ?? []} />
        </div>
      )}

      {/* Sign-ups come first once there are any; a fresh draft goes straight to the builder. */}
      {roster.length > 0 && registrations}

      <div className="mt-6">
        <EventEditorWorkspace
          helper={
            canUseHelper
              ? {
                  propertyId: event.propertyId,
                  sessionId: helperSession?.id ?? null,
                  transcript: helperSession ? helperTranscript(helperSession.messages) : [],
                }
              : null
          }
          initialSideTab={helper === "1" ? "helper" : "preview"}
          templateNames={templates.filter((template) => template.id !== id).map((template) => template.title)}
          featuresInProgress={(featureRequests.get(id) ?? [])
            .filter((request) => request.state === "waiting")
            .map((request) => request.summary)}
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
