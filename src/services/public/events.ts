import type { SupabaseClient } from "@supabase/supabase-js";

// Public read path for events (see the events migration). RLS restricts
// the base rows to published/sold_out; this adds property scoping and
// shapes the row into a clean domain type. No payment fields — v1
// registration is capacity-tracking signup only.

export type PublicEventStatus = "published" | "sold_out";
export type PublicEventInfoBoxType = "description" | "list";

export interface PublicEventInfoBox {
  id: string;
  boxType: PublicEventInfoBoxType;
  heading: string;
  body: string | null;
  items: string[] | null;
}

export type PublicEventAudience = "members_and_public" | "members_only";

export interface PublicEventListItem {
  id: string;
  title: string;
  summary: string | null;
  startAt: string | null;
  scheduleText: string | null;
  endAt: string | null;
  location: string | null;
  type: string | null;
  discipline: string | null;
  featured: boolean;
  includedWithMembership: boolean;
  audience: PublicEventAudience;
  status: PublicEventStatus;
  memberPrice: number | null;
  nonMemberPrice: number | null;
  imageUrl: string | null;
  isSoldOut: boolean;
}

export interface PublicEventDetail extends PublicEventListItem {
  description: string | null;
  instructors: string | null;
  maxCapacity: number;
  maxGuestsPerRegistration: number;
  infoBoxes: PublicEventInfoBox[];
}

type ListRow = {
  id: string;
  title: string;
  summary: string | null;
  start_at: string | null;
  schedule_text: string | null;
  end_at: string | null;
  location: string | null;
  type: string | null;
  discipline: string | null;
  featured: boolean;
  included_with_membership: boolean;
  audience: PublicEventAudience;
  status: PublicEventStatus;
  member_price: string | number | null;
  non_member_price: string | number | null;
  image_url: string | null;
};

function toMoney(value: string | number | null): number | null {
  return value === null ? null : Number(value);
}

function rowToListItem(row: ListRow): PublicEventListItem {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    startAt: row.start_at,
    scheduleText: row.schedule_text,
    endAt: row.end_at,
    location: row.location,
    type: row.type,
    discipline: row.discipline,
    featured: row.featured,
    includedWithMembership: row.included_with_membership,
    audience: row.audience,
    status: row.status,
    memberPrice: toMoney(row.member_price),
    nonMemberPrice: toMoney(row.non_member_price),
    imageUrl: row.image_url,
    isSoldOut: row.status === "sold_out",
  };
}

const LIST_COLUMNS =
  "id, title, summary, start_at, schedule_text, end_at, location, type, discipline, featured, included_with_membership, audience, status, member_price, non_member_price, image_url";

// Soonest-first, upcoming only (past events never show), capped at 6 —
// keeps the calendar page short. Callers that want fewer (e.g. Club
// Life's 3-up "What's Next" strip) slice further client-side.
const UPCOMING_EVENTS_LIMIT = 6;

export async function getPublicEvents(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<PublicEventListItem[]> {
  const { data, error } = await supabase
    .from("events")
    .select(LIST_COLUMNS)
    .eq("property_id", propertyId)
    .not("start_at", "is", null)
    .gte("start_at", new Date().toISOString())
    .order("start_at", { ascending: true })
    .limit(UPCOMING_EVENTS_LIMIT);

  if (error || !data) return [];
  return (data as ListRow[]).map(rowToListItem);
}

// Standing (indefinite, schedule-only) programmes for one property — no
// start_at, so "upcoming" doesn't apply; they're always current and shown
// in their own calendar section rather than mixed into the dated list.
export async function getPublicStandingPrograms(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<PublicEventListItem[]> {
  const { data, error } = await supabase
    .from("events")
    .select(LIST_COLUMNS)
    .eq("property_id", propertyId)
    .is("start_at", null)
    .order("title", { ascending: true });

  if (error || !data) return [];
  return (data as ListRow[]).map(rowToListItem);
}

const DETAIL_COLUMNS =
  "id, title, summary, description, start_at, schedule_text, end_at, location, instructors, type, discipline, featured, included_with_membership, audience, status, member_price, non_member_price, image_url, max_capacity, max_guests_per_registration, event_info_boxes ( id, box_type, heading, body, items )";

type DetailRow = ListRow & {
  description: string | null;
  instructors: string | null;
  max_capacity: number;
  max_guests_per_registration: number;
  event_info_boxes: {
    id: string;
    box_type: PublicEventInfoBoxType;
    heading: string;
    body: string | null;
    items: string[] | null;
  }[];
};

export async function getPublicEvent(
  supabase: SupabaseClient,
  id: string,
): Promise<PublicEventDetail | null> {
  const { data, error } = await supabase
    .from("events")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as DetailRow;
  return {
    ...rowToListItem(row),
    description: row.description,
    instructors: row.instructors,
    maxCapacity: row.max_capacity,
    maxGuestsPerRegistration: row.max_guests_per_registration,
    infoBoxes: row.event_info_boxes.map((box) => ({
      id: box.id,
      boxType: box.box_type,
      heading: box.heading,
      body: box.body,
      items: box.items,
    })),
  };
}
