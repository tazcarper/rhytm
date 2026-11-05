import type { SupabaseClient } from "@supabase/supabase-js";
import { saveRecurringEvents, type SaveEventInput, type SaveRecurringEventsResult } from "@/src/services/admin/events";
import { getEventExtras, saveEventExtras } from "@/src/services/admin/event-extras";

// Copies an existing event onto more dates: one new event per date, each
// with the source event's tickets, gear and questions. `baseInput` is the
// event as the editor has it (wall-clock times), so the copies keep its
// time of day; only the date changes. The source event itself is untouched.
export async function copyEventToDates(
  supabase: SupabaseClient,
  sourceEventId: string,
  baseInput: SaveEventInput,
  wallClockStartDates: ReadonlyArray<string>,
): Promise<SaveRecurringEventsResult> {
  const created = await saveRecurringEvents(supabase, { ...baseInput, id: undefined }, wallClockStartDates);
  if (!created.ok) return created;

  const extras = await getEventExtras(supabase, sourceEventId);
  for (const id of created.ids) {
    const saved = await saveEventExtras(supabase, id, extras);
    if (!saved.ok) return { ok: false, error: saved.error, createdIds: created.ids };
  }
  return created;
}
