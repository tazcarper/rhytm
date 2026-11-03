import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAnthropicEventHelperModel } from "@/lib/ai/anthropic-event-helper-model";
import { checkRateLimit } from "@/src/services/security/rate-limit";
import { getAdminPropertiesList } from "@/src/services/admin/properties";
import { saveEvent, saveRecurringEvents, SaveEventSchema } from "@/src/services/admin/events";
import { saveEventExtras } from "@/src/services/admin/event-extras";
import { createDraftSessionStore } from "@/src/services/ai/draft-session-store";
import { createCapabilityRequest } from "@/src/services/ai/capability-requests";
import { HELPER_LIMITS, runEventHelperTurn } from "@/src/services/ai/event-helper";

// The AI event helper's endpoint. Thin by design: check who is asking and
// how often, then hand off to the helper service with its dependencies.
// A turn is one Claude call (sometimes two or three, when a draft fails a
// check), well inside this limit.
export const maxDuration = 120;
export const dynamic = "force-dynamic";

// Pilot decision (2026-11-03): admins and property managers use the helper.
const HELPER_ROLES = new Set(["super_admin", "admin", "property_manager"]);
const DAILY_REQUESTS_PER_PERSON = 60;
const BUSINESS_NAME = "Rhythm Outdoors";
const TIMEZONE = "America/Chicago";

const BodySchema = z.object({
  sessionId: z.string().uuid().nullable(),
  message: z.string().max(HELPER_LIMITS.maxMessageChars + 1000),
  propertyId: z.string().max(100).nullable(),
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
  const propertyHint = properties.find((property) => property.id === body.data.propertyId) ?? null;

  try {
    const result = await runEventHelperTurn(
      {
        model: createAnthropicEventHelperModel(),
        sessions: createDraftSessionStore(supabase),
        saveDraft: async (inputs) => {
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
          return { ok: true, id: saved.ids[0], count: saved.ids.length };
        },
        recordCapabilityRequest: (input) => createCapabilityRequest(supabase, input),
        profile: { businessName: BUSINESS_NAME, timezone: TIMEZONE, properties },
        today: todayIn(TIMEZONE),
      },
      { sessionId: body.data.sessionId, message: body.data.message, propertyHint },
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("[event-helper] turn failed", { userId: user.id, error });
    return NextResponse.json(
      { kind: "error", sessionId: body.data.sessionId, text: "The helper hit a problem. Try again in a moment." },
      { status: 500 },
    );
  }
}
