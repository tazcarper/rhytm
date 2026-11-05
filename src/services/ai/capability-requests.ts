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
  // Events this request holds up.
  events: ReadonlyArray<{ id: string; title: string; status: string }>;
}

export async function createCapabilityRequest(
  supabase: SupabaseClient,
  input: CapabilityRequestInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("capability_requests").insert({
    session_id: input.sessionId,
    property_id: input.propertyId,
    summary: input.summary.slice(0, 1000),
    owner_words: input.ownerWords.slice(0, 2000),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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

type RequestRow = {
  id: string;
  summary: string;
  owner_words: string;
  status: string;
  created_at: string;
  properties: { name: string } | { name: string }[] | null;
  capability_request_events?: Array<{ events: LinkedEventRow | LinkedEventRow[] | null }>;
};
type LinkedEventRow = { id: string; title: string; status: string };

export async function getCapabilityRequests(supabase: SupabaseClient): Promise<CapabilityRequestRow[]> {
  let result: { data: unknown[] | null; error: { message: string } | null } = await supabase
    .from("capability_requests")
    .select(`${REQUEST_COLUMNS}, ${LINKED_EVENTS}`)
    .order("created_at", { ascending: false })
    .limit(200);
  // Without the linking table (migration not applied yet), list the requests alone.
  if (result.error) {
    result = await supabase
      .from("capability_requests")
      .select(REQUEST_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(200);
  }
  if (result.error) throw new Error(`Couldn't load feature requests: ${result.error.message}`);

  return ((result.data ?? []) as unknown as RequestRow[]).map((row) => {
    const property = Array.isArray(row.properties) ? row.properties[0] : row.properties;
    const events = (row.capability_request_events ?? [])
      .flatMap((link) => (Array.isArray(link.events) ? link.events : link.events ? [link.events] : []))
      .map((event) => ({ id: event.id, title: event.title, status: event.status }));
    return {
      id: row.id,
      summary: row.summary,
      ownerWords: row.owner_words,
      status: row.status as CapabilityRequestStatus,
      propertyName: property?.name ?? null,
      createdAt: row.created_at,
      events,
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
