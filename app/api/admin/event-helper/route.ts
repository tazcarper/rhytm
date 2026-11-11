import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAnthropicEventHelperModel } from "@/lib/ai/anthropic-event-helper-model";
import { checkRateLimit } from "@/src/services/security/rate-limit";
import { getAdminPropertiesList } from "@/src/services/admin/properties";
import { getEvent, saveEvent, saveRecurringEvents, SaveEventSchema } from "@/src/services/admin/events";
import { getEventExtras, saveEventExtras } from "@/src/services/admin/event-extras";
import { eventToDraftSnapshot, mergeDraftIntoEvent } from "@/src/services/ai/event-draft-schema";
import { createDraftSessionStore } from "@/src/services/ai/draft-session-store";
import {
  createCapabilityRequest,
  getLiveFeature,
  getOpenCapabilityRequests,
  linkCapabilityRequestsToEvents,
  markMoreRequested,
} from "@/src/services/ai/capability-requests";
import { HELPER_LIMITS, runEventHelperTurn } from "@/src/services/ai/event-helper";
import { EVENT_HELPER_ROLES } from "@/src/constants/admin/event-helper";
import { describeHelperError } from "@/src/services/ai/helper-errors";

// The AI event helper's endpoint. Thin by design: check who is asking and
// how often, then hand off to the helper service with its dependencies.
// A turn is one Claude call (sometimes two or three, when a draft fails a
// check), well inside this limit.
export const maxDuration = 120;
export const dynamic = "force-dynamic";

// Pilot decision (2026-11-03): admins and property managers use the helper.
const HELPER_ROLES = EVENT_HELPER_ROLES;
const DAILY_REQUESTS_PER_PERSON = 60;
const BUSINESS_NAME = "Rhythm Outdoors";
const TIMEZONE = "America/Chicago";

const BodySchema = z.object({
  sessionId: z.string().uuid().nullable(),
  message: z.string().max(HELPER_LIMITS.maxMessageChars + 1000),
  propertyId: z.string().max(100).nullable(),
  // Set when the helper runs beside a saved event's builder.
  eventId: z.string().uuid().nullable().optional(),
  // Set from "Add more" on a live feature's card.
  extendsRequestId: z.string().uuid().nullable().optional(),
});

function todayIn(timezone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role as string | undefined;
  if (!user || !role || !HELPER_ROLES.has(role)) {
    return NextResponse.json({ kind: "error", text: "Not authorized." }, { status: 403 });
  }

  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ kind: "error", text: "Invalid request." }, { status: 400 });
  }

  const allowed = await checkRateLimit(`event-helper:${user.id}`, DAILY_REQUESTS_PER_PERSON, 24 * 60 * 60);
  if (!allowed) {
    return NextResponse.json(
      { kind: "error", text: "You've reached today's helper limit. You can still create events with a starter." },
      { status: 429 },
    );
  }

  // Property managers only draft for their own property, matching what
  // RLS lets them save.
  const managedPropertyId = role === "property_manager" ? (user.app_metadata?.property_id as string | undefined) : undefined;
  const properties = (await getAdminPropertiesList(supabase))
    .filter((property) => !managedPropertyId || property.id === managedPropertyId)
    .map((property) => ({ id: property.id, name: property.name }));
  // Beside a saved event, the helper edits that event, starting from what
  // is saved now (RLS limits which events this person can load).
  const editingEvent = body.data.eventId ? await getEvent(supabase, body.data.eventId) : null;
  if (body.data.eventId && !editingEvent) {
    return NextResponse.json({ kind: "error", text: "That event couldn't be found." }, { status: 404 });
  }
  const editing = editingEvent
    ? {
        eventId: editingEvent.id,
        snapshot: eventToDraftSnapshot(editingEvent, await getEventExtras(supabase, editingEvent.id), TIMEZONE),
      }
    : null;
  // "Add more": the live feature the conversation extends.
  const extending = body.data.extendsRequestId ? await getLiveFeature(supabase, body.data.extendsRequestId) : null;
  if (body.data.extendsRequestId && !extending) {
    return NextResponse.json({ kind: "error", text: "That feature isn't live, so nothing can be added to it." }, { status: 404 });
  }
  const propertyHint =
    properties.find((property) => property.id === (editingEvent?.propertyId ?? body.data.propertyId)) ?? null;

  try {
    const result = await runEventHelperTurn(
      {
        model: createAnthropicEventHelperModel(),
        sessions: createDraftSessionStore(supabase),
        saveDraft: async (inputs, { updateEventId }) => {
          if (updateEventId) {
            const current = await getEvent(supabase, updateEventId);
            if (!current) return { ok: false, error: "The event no longer exists." };
            const updated = await saveEvent(supabase, SaveEventSchema.parse(mergeDraftIntoEvent(current, inputs.event)));
            if (!updated.ok) return { ok: false, error: updated.error };
            const extras = await saveEventExtras(supabase, updateEventId, inputs.extras);
            if (!extras.ok) return { ok: false, error: extras.error };
            return { ok: true, id: updateEventId, count: 1, ids: [updateEventId] };
          }
          const event = SaveEventSchema.parse(inputs.event);
          const saved =
            inputs.repeatDates.length > 1
              ? await saveRecurringEvents(supabase, event, inputs.repeatDates)
              : await saveEvent(supabase, event).then((result) =>
                  result.ok ? { ok: true as const, ids: [result.id] } : result,
                );
          if (!saved.ok) return { ok: false, error: saved.error };
          // Each date is its own event, so each gets its own tickets, gear and questions.
          for (const id of saved.ids) {
            const extras = await saveEventExtras(supabase, id, inputs.extras);
            if (!extras.ok) return { ok: false, error: extras.error };
          }
          return { ok: true, id: saved.ids[0], count: saved.ids.length, ids: saved.ids };
        },
        recordCapabilityRequest: async (input) => {
          const recorded = await createCapabilityRequest(supabase, input);
          if (recorded.ok && extending && input.duplicateOf === extending.id) {
            const marked = await markMoreRequested(supabase, extending.id);
            if (!marked.ok) return { ok: false, error: marked.error };
          }
          return recorded;
        },
        openCapabilityRequests: async () => {
          const open = await getOpenCapabilityRequests(supabase);
          return extending ? [extending, ...open.filter((request) => request.id !== extending.id)] : open;
        },
        linkCapabilityRequests: async (sessionId, eventIds) => {
          const linked = await linkCapabilityRequestsToEvents(supabase, sessionId, eventIds);
          if (!linked.ok) console.error("[event-helper] couldn't link feature requests", linked.error);
        },
        profile: { businessName: BUSINESS_NAME, timezone: TIMEZONE, properties },
        today: todayIn(TIMEZONE),
      },
      { sessionId: body.data.sessionId, message: body.data.message, propertyHint, editing, extending },
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("[event-helper] turn failed", { userId: user.id, error });
    const { text, detail } = describeHelperError(error);
    return NextResponse.json({ kind: "error", sessionId: body.data.sessionId, text, detail }, { status: 500 });
  }
}
