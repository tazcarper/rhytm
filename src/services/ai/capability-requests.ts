import type { SupabaseClient } from "@supabase/supabase-js";

// "The event builder can't do this yet" requests collected by the helper.
// A developer reviews them; frequent requests mean the business is missing
// something that should become a default or a starter.

export type CapabilityRequestStatus = "new" | "reviewing" | "planned" | "built" | "declined";

export interface CapabilityRequestInput {
  // The helper conversation it came from; a draft saved later in the same
  // conversation is linked to it.
  sessionId: string;
  propertyId: string | null;
  // Set when an open request already covers this ask: it's filed as a
  // duplicate of that one, and follows its status.
  duplicateOf?: string | null;
  summary: string;
  ownerWords: string;
}

export interface CapabilityRequestRow {
  id: string;
  summary: string;
  ownerWords: string;
  status: CapabilityRequestStatus;
  propertyName: string | null;
  createdAt: string;
  // Events this request holds up, including through its duplicates.
  events: ReadonlyArray<{ id: string; title: string; status: string }>;
  // Later asks for the same feature, filed as duplicates of this one.
  alsoAsked: ReadonlyArray<{ id: string; ownerWords: string; createdAt: string }>;
  // Set once an admin pressed Build it (migration 20261105170000).
  build: FeatureBuild | null;
}

export interface FeatureBuild {
  issueUrl: string;
  requestedAt: string | null;
  // The pull request Claude opened, once there is one.
  pullRequest: { url: string; state: "open" | "merged" | "closed" } | null;
  // The Vercel preview of the build and Claude's steps for testing it
  // there (migration 20261105190000). Empty until they arrive.
  previewUrl: string | null;
  testSteps: ReadonlyArray<string>;
}

export async function createCapabilityRequest(
  supabase: SupabaseClient,
  input: CapabilityRequestInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("capability_requests").insert({
    session_id: input.sessionId,
    property_id: input.propertyId,
    // Only sent when set, so inserts work before migration 20261105150000.
    ...(input.duplicateOf ? { duplicate_of: input.duplicateOf } : {}),
    summary: input.summary.slice(0, 1000),
    owner_words: input.ownerWords.slice(0, 2000),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface OpenCapabilityRequest {
  id: string;
  summary: string;
}

// The open requests (migration 20261105150000), so the helper can spot a
// repeat ask. Empty if the lookup fails.
export async function getOpenCapabilityRequests(supabase: SupabaseClient): Promise<OpenCapabilityRequest[]> {
  const { data, error } = await supabase.rpc("open_capability_requests");
  if (error) return [];
  return ((data ?? []) as OpenCapabilityRequest[]).map((row) => ({ id: row.id, summary: row.summary }));
}

// Links this conversation's requests to the draft event(s) they hold up
// (migration 20261104193000). The function only links the caller's own
// requests to events they can edit.
export async function linkCapabilityRequestsToEvents(
  supabase: SupabaseClient,
  sessionId: string,
  eventIds: ReadonlyArray<string>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (eventIds.length === 0) return { ok: true };
  const { error } = await supabase.rpc("link_capability_requests_to_events", {
    p_session_id: sessionId,
    p_event_ids: eventIds,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// A feature request as the event pages show it: still being built, or built
// and ready to add to the event.
export type EventFeatureRequestState = "waiting" | "ready";

export interface EventFeatureRequest {
  requestId: string;
  summary: string;
  state: EventFeatureRequestState;
}

const STATE_BY_STATUS: Record<Exclude<CapabilityRequestStatus, "declined">, EventFeatureRequestState> = {
  new: "waiting",
  reviewing: "waiting",
  planned: "waiting",
  built: "ready",
};

// The feature requests linked to each event, keyed by event id. Declined
// requests are left out. Returns an empty map if the lookup fails, so the
// events pages still load (e.g. before the migration is applied).
export async function getFeatureRequestsForEvents(
  supabase: SupabaseClient,
  eventIds: ReadonlyArray<string>,
): Promise<Map<string, EventFeatureRequest[]>> {
  const byEvent = new Map<string, EventFeatureRequest[]>();
  if (eventIds.length === 0) return byEvent;
  const { data, error } = await supabase.rpc("feature_requests_for_events", { p_event_ids: eventIds });
  if (error) {
    console.error("[feature-requests] lookup failed", error.message);
    return byEvent;
  }
  for (const row of (data ?? []) as Array<{ event_id: string; request_id: string; summary: string; status: string }>) {
    const state = STATE_BY_STATUS[row.status as keyof typeof STATE_BY_STATUS];
    if (!state) continue;
    const list = byEvent.get(row.event_id) ?? [];
    list.push({ requestId: row.request_id, summary: row.summary, state });
    byEvent.set(row.event_id, list);
  }
  return byEvent;
}

const REQUEST_COLUMNS = "id, summary, owner_words, status, created_at, properties ( name )";
// The draft(s) each request holds up (migration 20261104193000).
const LINKED_EVENTS = "capability_request_events ( events ( id, title, status ) )";
// Build it (migration 20261105170000).
const BUILD_COLUMNS = "build_issue_url, build_requested_at, build_pr_url, build_pr_state";
const BUILD_PREVIEW_COLUMNS = "build_preview_url, build_test_steps";

type RequestRow = {
  id: string;
  summary: string;
  owner_words: string;
  status: string;
  created_at: string;
  duplicate_of?: string | null;
  build_issue_url?: string | null;
  build_requested_at?: string | null;
  build_pr_url?: string | null;
  build_pr_state?: "open" | "merged" | "closed" | null;
  build_preview_url?: string | null;
  build_test_steps?: string | null;
  properties: { name: string } | { name: string }[] | null;
  capability_request_events?: Array<{ events: LinkedEventRow | LinkedEventRow[] | null }>;
};
type LinkedEventRow = { id: string; title: string; status: string };

export async function getCapabilityRequests(supabase: SupabaseClient): Promise<CapabilityRequestRow[]> {
  // Newest schema first, then older ones, so the page still loads before
  // a migration is applied: preview and test steps (20261105190000), the
  // build columns (20261105170000),
  // duplicate_of (20261105150000), then the linking table (20261104193000).
  const selections = [
    `${REQUEST_COLUMNS}, duplicate_of, ${BUILD_COLUMNS}, ${BUILD_PREVIEW_COLUMNS}, ${LINKED_EVENTS}`,
    `${REQUEST_COLUMNS}, duplicate_of, ${BUILD_COLUMNS}, ${LINKED_EVENTS}`,
    `${REQUEST_COLUMNS}, duplicate_of, ${LINKED_EVENTS}`,
    `${REQUEST_COLUMNS}, ${LINKED_EVENTS}`,
    REQUEST_COLUMNS,
  ];
  let result: { data: unknown[] | null; error: { message: string } | null } = { data: null, error: null };
  for (const selection of selections) {
    result = await supabase
      .from("capability_requests")
      .select(selection)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!result.error) break;
    console.error("[feature-requests] list query failed, trying an older shape", result.error.message);
  }
  if (result.error) throw new Error(`Couldn't load feature requests: ${result.error.message}`);

  const rows = (result.data ?? []) as unknown as RequestRow[];
  const linkedEvents = (row: RequestRow) =>
    (row.capability_request_events ?? [])
      .flatMap((link) => (Array.isArray(link.events) ? link.events : link.events ? [link.events] : []))
      .map((event) => ({ id: event.id, title: event.title, status: event.status }));
  const originalIds = new Set(rows.filter((row) => !row.duplicate_of).map((row) => row.id));
  // A duplicate whose original is gone is shown as its own request.
  const isDuplicate = (row: RequestRow) => Boolean(row.duplicate_of && originalIds.has(row.duplicate_of));

  return rows
    .filter((row) => !isDuplicate(row))
    .map((row) => {
      const property = Array.isArray(row.properties) ? row.properties[0] : row.properties;
      const duplicates = rows.filter((other) => isDuplicate(other) && other.duplicate_of === row.id);
      const events = [row, ...duplicates].flatMap(linkedEvents);
      return {
        id: row.id,
        summary: row.summary,
        ownerWords: row.owner_words,
        status: row.status as CapabilityRequestStatus,
        propertyName: property?.name ?? null,
        createdAt: row.created_at,
        events: events.filter((event, index) => events.findIndex((other) => other.id === event.id) === index),
        alsoAsked: duplicates.map((other) => ({ id: other.id, ownerWords: other.owner_words, createdAt: other.created_at })),
        build: row.build_issue_url
          ? {
              issueUrl: row.build_issue_url,
              requestedAt: row.build_requested_at ?? null,
              pullRequest:
                row.build_pr_url && row.build_pr_state ? { url: row.build_pr_url, state: row.build_pr_state } : null,
              previewUrl: row.build_preview_url ?? null,
              testSteps: (row.build_test_steps ?? "").split("\n").filter((step) => step.trim() !== ""),
            }
          : null,
      };
    });
}

export const CAPABILITY_REQUEST_STATUSES: ReadonlyArray<CapabilityRequestStatus> = [
  "new",
  "reviewing",
  "planned",
  "built",
  "declined",
];

// The developer moves a request along. "built" marks its drafts Feature
// ready and lets them be published; "declined" drops it from the drafts.
export async function updateCapabilityRequestStatus(
  supabase: SupabaseClient,
  id: string,
  status: CapabilityRequestStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("capability_requests").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Summaries of the features still being built for an event. An event with
// any can't leave draft (Taz, 2026-11-04: it must be fully feature-ready
// before publishing). A failed lookup counts as none, so publishing isn't
// blocked where the feature-request tables don't exist yet.
export async function getFeaturesInProgress(supabase: SupabaseClient, eventId: string): Promise<string[]> {
  const byEvent = await getFeatureRequestsForEvents(supabase, [eventId]);
  return (byEvent.get(eventId) ?? []).filter((request) => request.state === "waiting").map((request) => request.summary);
}

// Folds one request into another (the developer spotted two asks for the
// same feature). Its own duplicates move along with it.
export async function markCapabilityRequestDuplicate(
  supabase: SupabaseClient,
  id: string,
  originalId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (id === originalId) return { ok: false, error: "A request can't be the same as itself." };
  const moved = await supabase.from("capability_requests").update({ duplicate_of: originalId }).eq("duplicate_of", id);
  if (moved.error) return { ok: false, error: moved.error.message };
  const { error } = await supabase.from("capability_requests").update({ duplicate_of: originalId }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
