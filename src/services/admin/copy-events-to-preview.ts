import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { writeSkippingMissingColumns } from "@/src/services/admin/write-skipping-missing-columns";

// Copies events from the live database into the preview (test) database
// (Taz, 2026-11-10). Previews run on their own database, so a build asked
// for on a live draft had nothing to test against: the draft's link 404'd
// on the test site. When Build it starts, the drafts the request came from
// are copied over with the same ids, so the test site has them.
//
// Copies the event row and what it's built from (info boxes, ticket
// options, gear, questions). Never registrations or anything about
// members. Properties are matched by slug, since each database made its
// own property ids.

const CHILD_TABLES = ["event_info_boxes", "event_ticket_types", "event_gear_items", "event_questions"] as const;

// The preview database, or null when this isn't the live site or the
// preview's keys aren't set (PREVIEW_SUPABASE_URL and
// PREVIEW_SUPABASE_SECRET_KEY, Production scope in Vercel).
export function createPreviewDatabaseClient(
  env: Record<string, string | undefined> = process.env,
): SupabaseClient | null {
  if (env.VERCEL_ENV !== "production") return null;
  const url = env.PREVIEW_SUPABASE_URL;
  const key = env.PREVIEW_SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// skippedColumns: live columns the test database doesn't have yet (left out).
export type CopyEventsResult =
  | { ok: true; copied: number; skippedColumns: string[] }
  | { ok: false; error: string };

export async function copyEventsToPreview(
  eventIds: ReadonlyArray<string>,
  { source, target }: { source: SupabaseClient; target: SupabaseClient },
): Promise<CopyEventsResult> {
  const ids = [...new Set(eventIds)];
  if (ids.length === 0) return { ok: true, copied: 0, skippedColumns: [] };

  const { data: events, error: eventsError } = await source
    .from("events")
    .select("*, properties ( slug )")
    .in("id", ids);
  if (eventsError) return { ok: false, error: `Couldn't read the events: ${eventsError.message}` };
  if (!events?.length) return { ok: true, copied: 0, skippedColumns: [] };

  const { data: targetProperties, error: propertiesError } = await target.from("properties").select("id, slug");
  if (propertiesError) return { ok: false, error: `Couldn't read the test site's clubs: ${propertiesError.message}` };
  const propertyBySlug = new Map((targetProperties ?? []).map((row) => [row.slug as string, row.id as string]));

  const rows: Array<Record<string, unknown> & { id: string; property_id: string }> = [];
  for (const { properties, ...event } of events as Array<Record<string, unknown> & { properties: { slug: string } | null }>) {
    const propertyId = properties ? propertyBySlug.get(properties.slug) : undefined;
    if (!propertyId) return { ok: false, error: `The test site has no club "${properties?.slug ?? "unknown"}".` };
    rows.push({ ...event, id: event.id as string, property_id: propertyId });
  }

  const skipped = new Set<string>();
  const saved = await writeSkippingMissingColumns(
    rows,
    (batch) => target.from("events").upsert(batch, { onConflict: "id" }),
    skipped,
  );
  if (saved.error) return { ok: false, error: `Couldn't save the events on the test site: ${saved.error}` };

  const copiedIds = rows.map((row) => row.id);
  for (const table of CHILD_TABLES) {
    const { data: children, error: readError } = await source.from(table).select("*").in("event_id", copiedIds);
    if (readError) return { ok: false, error: `Couldn't read ${table}: ${readError.message}` };
    const { error: clearError } = await target.from(table).delete().in("event_id", copiedIds);
    if (clearError) return { ok: false, error: `Couldn't clear ${table} on the test site: ${clearError.message}` };
    if (children?.length) {
      const childSkipped = new Set<string>();
      const inserted = await writeSkippingMissingColumns(children, (batch) => target.from(table).insert(batch), childSkipped);
      if (inserted.error) return { ok: false, error: `Couldn't copy ${table}: ${inserted.error}` };
      childSkipped.forEach((column) => skipped.add(`${table}.${column}`));
    }
  }
  return { ok: true, copied: rows.length, skippedColumns: [...skipped] };
}
