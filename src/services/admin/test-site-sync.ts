import type { SupabaseClient } from "@supabase/supabase-js";
import { copyEventsToPreview } from "@/src/services/admin/copy-events-to-preview";
import { writeSkippingMissingColumns } from "@/src/services/admin/write-skipping-missing-columns";

// Nightly copy of the live site's content and settings into the test
// (preview) database, so test sites look like the real one (Taz,
// 2026-11-10). Data only, never the structure, and never anything about
// people: no members, bookings, bids, registrations, payments or logins.
//
// Both databases were seeded separately, so the same club, service or FAQ
// has a different id in each. Rows are matched by id first, then by a
// natural key (a club's slug, a service's club + name, …). A matched test
// row is updated in place and keeps its id; an unmatched one is added with
// the live id. Ids that rows point at are translated along the way.
// Nothing is deleted on the test site, so test-only rows stay.

type Row = Record<string, unknown>;

interface TableSpec {
  table: string;
  // Columns that identify the same row in both databases (after the
  // references below are translated).
  key: string[];
  // Column → the table its id points at.
  references?: Record<string, string>;
  // Columns never copied (e.g. a staff inbox, so test sites don't email it).
  omit?: string[];
  // Columns set to null (e.g. who saved it: logins aren't copied).
  clear?: string[];
  // False for tables keyed only by their references (no id column).
  hasId?: boolean;
}

// In order: a table comes after the tables it points at.
export const CONTENT_TABLES: ReadonlyArray<TableSpec> = [
  { table: "properties", key: ["slug"], omit: ["notification_email"] },
  { table: "property_page_content", key: ["property_id", "page_key", "section_key"], references: { property_id: "properties" } },
  { table: "property_faq_entries", key: ["property_id", "question"], references: { property_id: "properties" } },
  { table: "property_gear_presets", key: ["property_id", "name"], references: { property_id: "properties" } },
  {
    table: "property_travel_times",
    key: ["from_property_id", "to_property_id"],
    references: { from_property_id: "properties", to_property_id: "properties" },
    hasId: false,
  },
  { table: "services", key: ["property_id", "name"], references: { property_id: "properties" } },
  { table: "add_ons", key: ["property_id", "name"], references: { property_id: "properties" } },
  {
    table: "service_add_ons",
    key: ["service_id", "add_on_id"],
    references: { service_id: "services", add_on_id: "add_ons" },
    hasId: false,
  },
  { table: "time_slots", key: ["property_id", "day_of_week", "slot_start"], references: { property_id: "properties" } },
  { table: "pricing_rules", key: ["property_id", "booking_type", "audience_type"], references: { property_id: "properties" } },
  { table: "promotions", key: ["title"] },
  {
    table: "promotion_properties",
    key: ["promotion_id", "property_id"],
    references: { promotion_id: "promotions", property_id: "properties" },
    hasId: false,
  },
  { table: "member_adventures", key: ["property_id", "title", "start_date"], references: { property_id: "properties" } },
  { table: "instructors", key: ["property_id", "name"], references: { property_id: "properties" } },
  {
    table: "instructor_properties",
    key: ["instructor_id", "property_id"],
    references: { instructor_id: "instructors", property_id: "properties" },
    hasId: false,
  },
  {
    table: "instructor_disciplines",
    key: ["instructor_id", "service_id"],
    references: { instructor_id: "instructors", service_id: "services" },
    hasId: false,
  },
  {
    table: "instructor_availability",
    key: ["instructor_id", "property_id", "day_of_week", "start_time"],
    references: { instructor_id: "instructors", property_id: "properties" },
  },
  { table: "homepage_hero", key: ["id"] },
  {
    table: "waiver_templates",
    key: ["property_id", "version"],
    references: { property_id: "properties" },
    clear: ["created_by"],
  },
  { table: "bid_faq_templates", key: ["dedupe_key"] },
  {
    table: "bid_faq_template_scopes",
    key: ["template_id", "property_id", "service_id"],
    references: { template_id: "bid_faq_templates", property_id: "properties", service_id: "services" },
  },
  { table: "bid_gear_templates", key: ["dedupe_key"] },
  {
    table: "bid_gear_template_scopes",
    key: ["template_id", "property_id", "service_id"],
    references: { template_id: "bid_gear_templates", property_id: "properties", service_id: "services" },
  },
];

export interface TableSyncReport {
  table: string;
  updated: number;
  added: number;
  skipped: number;
  // Rows left as they are on the test site on purpose (events being
  // tested with a build that's still open).
  kept?: number;
  // Live columns the test database doesn't have yet, so they were left out.
  missingColumns?: string[];
  error?: string;
}

const PAGE = 1000;

async function readAll(client: SupabaseClient, table: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from(table).select("*").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) return rows;
  }
}

const keyOf = (row: Row, key: string[]) => JSON.stringify(key.map((column) => row[column] ?? null));

// live id → test id, per table.
type IdMaps = Map<string, Map<string, string>>;

async function syncTable(
  spec: TableSpec,
  { source, target, ids }: { source: SupabaseClient; target: SupabaseClient; ids: IdMaps },
): Promise<TableSyncReport> {
  const report: TableSyncReport = { table: spec.table, updated: 0, added: 0, skipped: 0 };
  const hasId = spec.hasId !== false;
  const idMap = new Map<string, string>();
  ids.set(spec.table, idMap);

  const [liveRows, testRows] = await Promise.all([readAll(source, spec.table), readAll(target, spec.table)]);
  const testById = new Map(testRows.map((row) => [String(row.id), row]));
  const testByKey = new Map(testRows.map((row) => [keyOf(row, spec.key), row]));
  const missing = new Set<string>();

  for (const live of liveRows) {
    const row: Row = { ...live };
    for (const column of spec.omit ?? []) delete row[column];
    for (const column of spec.clear ?? []) row[column] = null;

    let missingReference = false;
    for (const [column, table] of Object.entries(spec.references ?? {})) {
      const value = row[column];
      if (value === null || value === undefined) continue;
      const translated = ids.get(table)?.get(String(value));
      if (!translated) missingReference = true;
      else row[column] = translated;
    }
    if (missingReference) {
      report.skipped += 1;
      continue;
    }

    const match = (hasId ? testById.get(String(live.id)) : undefined) ?? testByKey.get(keyOf(row, spec.key));
    if (match) {
      if (hasId) {
        const { id: _liveId, ...changes } = row;
        const { error } = await writeSkippingMissingColumns(
          [changes],
          ([only]) => target.from(spec.table).update(only).eq("id", match.id),
          missing,
        );
        if (error) throw new Error(error);
        idMap.set(String(live.id), String(match.id));
      } else {
        const { error } = await writeSkippingMissingColumns(
          [row],
          ([only]) => {
            let query = target.from(spec.table).update(only);
            for (const column of spec.key) query = query.eq(column, row[column]);
            return query;
          },
          missing,
        );
        if (error) throw new Error(error);
      }
      report.updated += 1;
    } else {
      const { error } = await writeSkippingMissingColumns([row], (batch) => target.from(spec.table).insert(batch), missing);
      if (error) throw new Error(error);
      if (hasId) idMap.set(String(live.id), String(live.id));
      report.added += 1;
    }
  }
  if (missing.size) report.missingColumns = [...missing];
  return report;
}

// Drafts that a build is being made or tested on right now: linked to a
// feature request whose build has started and whose pull request isn't
// merged or closed. Staff may be trying the new feature on them on the test
// site, so the nightly copy leaves them alone until the build is done.
// (Build it already copied them once when it started.)
export async function eventsWithOpenBuilds(source: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await source
    .from("capability_requests")
    .select("build_pr_state, capability_request_events ( event_id )")
    .not("build_issue_number", "is", null);
  if (error) throw new Error(`Couldn't read which builds are open: ${error.message}`);
  const ids = new Set<string>();
  for (const request of (data ?? []) as Array<{
    build_pr_state: string | null;
    capability_request_events: Array<{ event_id: string }> | null;
  }>) {
    if (request.build_pr_state === "merged" || request.build_pr_state === "closed") continue;
    for (const link of request.capability_request_events ?? []) ids.add(link.event_id);
  }
  return ids;
}

// Copies every content table, then every event (with its info boxes,
// tickets, gear and questions). One table failing is reported and the
// rest still run; rows pointing at something that didn't copy are skipped.
export async function syncTestSite({
  source,
  target,
}: {
  source: SupabaseClient;
  target: SupabaseClient;
}): Promise<TableSyncReport[]> {
  const ids: IdMaps = new Map();
  const reports: TableSyncReport[] = [];
  for (const spec of CONTENT_TABLES) {
    try {
      reports.push(await syncTable(spec, { source, target, ids }));
    } catch (error) {
      reports.push({ table: spec.table, updated: 0, added: 0, skipped: 0, error: (error as Error).message });
    }
  }

  // In batches, so each request's list of ids stays short.
  const eventReport: TableSyncReport = { table: "events", updated: 0, added: 0, skipped: 0 };
  try {
    // Only left alone once they're on the test site; a draft that isn't
    // there yet is copied so it can be tested.
    const openBuildIds = [...(await eventsWithOpenBuilds(source))];
    const { data: alreadyThere, error: thereError } = openBuildIds.length
      ? await target.from("events").select("id").in("id", openBuildIds)
      : { data: [], error: null };
    if (thereError) throw new Error(thereError.message);
    const protectedIds = new Set((alreadyThere ?? []).map((row) => String(row.id)));
    eventReport.kept = protectedIds.size;
    const eventIds = (await readAll(source, "events"))
      .map((event) => String(event.id))
      .filter((id) => !protectedIds.has(id));
    for (let start = 0; start < eventIds.length; start += 100) {
      const copied = await copyEventsToPreview(eventIds.slice(start, start + 100), { source, target });
      if (!copied.ok) throw new Error(copied.error);
      eventReport.updated += copied.copied;
      if (copied.skippedColumns.length) {
        eventReport.missingColumns = [...new Set([...(eventReport.missingColumns ?? []), ...copied.skippedColumns])];
      }
    }
  } catch (error) {
    eventReport.error = (error as Error).message;
  }
  reports.push(eventReport);
  return reports;
}
