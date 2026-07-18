import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

// Admin CRUD for events (see the events migration). Pure data layer: takes
// the caller's RLS-scoped client (admin/super_admin + the owning
// property_manager write is enforced by policy), validates at the action
// boundary, returns clean domain types. Cloned from the promotions
// service's shape; info boxes are replaced wholesale on save the same way
// promotions replaces its property-targeting join rows.

export type EventStatus = "draft" | "published" | "sold_out" | "cancelled" | "completed";
export type EventInfoBoxType = "description" | "list";

// The editor's datetime-local inputs ("2026-08-15T10:00") carry no
// timezone — they're the property's local wall clock, same convention as
// the booking system's date+slot picker (see
// supabase/migrations/20260520160000_create_public_booking_function.sql,
// which does `(p_date + p_slot_start) AT TIME ZONE 'America/Chicago'` in
// SQL for the identical problem). Supabase's connection defaults to UTC,
// so writing the naive string straight through silently mis-stores it —
// "10:00" lands as 10:00 UTC (5:00 AM Central), not 10:00 AM Central.
// This converts the wall-clock string to a proper UTC instant before it
// ever reaches Postgres, using the standard double-format offset trick
// (no timezone library in this project's dependencies). Hardcodes
// America/Chicago, matching the SQL function's own hardcoded literal —
// every property is Texas Hill Country today.
function chicagoWallClockToUtcIso(wallClock: string): string {
  const [datePart, timePart] = wallClock.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = (timePart ?? "00:00").split(":").map(Number);

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(new Date(utcGuess));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asIfLocal = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offset = asIfLocal - utcGuess;
  return new Date(utcGuess - offset).toISOString();
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

const optionalMoney = z
  .union([z.number(), z.literal("")])
  .optional()
  .nullable()
  .transform((value) => (value === "" || value === null || value === undefined ? null : value))
  .refine((value) => value === null || value >= 0, "Price can't be negative");

const InfoBoxSchema = z
  .object({
    id: z.string().uuid().optional(),
    boxType: z.enum(["description", "list"]),
    heading: z.string().trim().min(1, "Heading is required").max(120),
    body: z.string().trim().max(4000).optional().nullable(),
    items: z.array(z.string().trim().max(300)).max(30).optional().nullable(),
    sortOrder: z.number().int().min(0).max(999),
  })
  .refine(
    (box) =>
      box.boxType === "description"
        ? Boolean(box.body?.trim())
        : Boolean(box.items && box.items.filter((item) => item.trim()).length > 0),
    { message: "A description box needs body text; a list box needs at least one item", path: ["body"] },
  );

export const SaveEventSchema = z
  .object({
    id: z.string().uuid().optional(),
    propertyId: z.string().uuid("Choose a property"),
    title: z.string().trim().min(1, "Title is required").max(200),
    summary: optionalText(300),
    description: optionalText(8000),
    startAt: z.string().trim().min(1, "Start date/time is required"),
    endAt: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((value) => (value ? value : null)),
    location: optionalText(200),
    instructors: optionalText(200),
    type: optionalText(80),
    discipline: optionalText(80),
    featured: z.boolean(),
    maxCapacity: z.number().int().positive("Capacity must be at least 1"),
    maxGuestsPerRegistration: z.number().int().positive("Must be at least 1"),
    memberPrice: optionalMoney,
    nonMemberPrice: optionalMoney,
    status: z.enum(["draft", "published", "sold_out", "cancelled", "completed"]),
    isManuallySoldOut: z.boolean(),
    isTemplate: z.boolean(),
    imageUrl: optionalText(2000),
    infoBoxes: z.array(InfoBoxSchema).max(20),
  })
  .refine(
    (value) => !value.endAt || new Date(value.endAt) >= new Date(value.startAt),
    { message: "End must be on or after the start", path: ["endAt"] },
  )
  .refine((value) => value.maxGuestsPerRegistration <= value.maxCapacity, {
    message: "Can't exceed the event's total capacity",
    path: ["maxGuestsPerRegistration"],
  });

export type SaveEventInput = z.infer<typeof SaveEventSchema>;
export type SaveEventRawInput = z.input<typeof SaveEventSchema>;

export type SaveEventResult = { ok: true; id: string } | { ok: false; error: string };

export interface AdminEventListRow {
  id: string;
  title: string;
  propertyName: string;
  startAt: string;
  status: EventStatus;
  maxCapacity: number;
  confirmedCount: number;
  memberPrice: number | null;
  nonMemberPrice: number | null;
  isTemplate: boolean;
}

export interface AdminEventInfoBox {
  id: string;
  boxType: EventInfoBoxType;
  heading: string;
  body: string | null;
  items: string[] | null;
  sortOrder: number;
}

export interface AdminEventDetail {
  id: string;
  propertyId: string;
  title: string;
  summary: string | null;
  description: string | null;
  startAt: string;
  endAt: string | null;
  location: string | null;
  instructors: string | null;
  type: string | null;
  discipline: string | null;
  featured: boolean;
  maxCapacity: number;
  maxGuestsPerRegistration: number;
  memberPrice: number | null;
  nonMemberPrice: number | null;
  status: EventStatus;
  isManuallySoldOut: boolean;
  isTemplate: boolean;
  imageUrl: string | null;
  infoBoxes: AdminEventInfoBox[];
}

export interface AdminEventTemplateOption {
  id: string;
  title: string;
  propertyName: string;
}

export interface EventRosterRow {
  registrationId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  guestCount: number;
  status: "confirmed" | "waitlisted" | "cancelled";
  isMemberRate: boolean;
  priceQuoted: number | null;
  createdAt: string;
}

const LIST_COLUMNS =
  "id, title, start_at, status, max_capacity, member_price, non_member_price, is_template, properties ( name )";

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getEventsList(
  supabase: SupabaseClient,
): Promise<AdminEventListRow[]> {
  const { data, error } = await supabase
    .from("events")
    .select(LIST_COLUMNS)
    .order("start_at", { ascending: false });

  if (error) throw new Error(`Couldn't load events: ${error.message}`);

  const rows = data ?? [];
  const ids = rows.map((row) => row.id as string);

  const confirmedByEvent = new Map<string, number>();
  if (ids.length > 0) {
    const { data: registrations } = await supabase
      .from("event_registrations")
      .select("event_id, guest_count")
      .in("event_id", ids)
      .eq("status", "confirmed");
    for (const registration of registrations ?? []) {
      confirmedByEvent.set(
        registration.event_id,
        (confirmedByEvent.get(registration.event_id) ?? 0) + registration.guest_count,
      );
    }
  }

  return rows.map((row) => {
    const property = pickOne(row.properties as { name: string } | { name: string }[] | null);
    return {
      id: row.id,
      title: row.title,
      propertyName: property?.name ?? "—",
      startAt: row.start_at,
      status: row.status as EventStatus,
      maxCapacity: row.max_capacity,
      confirmedCount: confirmedByEvent.get(row.id) ?? 0,
      memberPrice: row.member_price === null ? null : Number(row.member_price),
      nonMemberPrice: row.non_member_price === null ? null : Number(row.non_member_price),
      isTemplate: row.is_template,
    };
  });
}

// Upcoming events for one property's workspace "Events" tab — same row
// shape as getEventsList (reuses EventsDataTable as-is), but scoped to a
// single property and to events that haven't started yet, soonest first
// (the opposite ordering of the global list, which favors "most recent
// first" for a mixed-property history view).
export async function getUpcomingEventsForProperty(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<AdminEventListRow[]> {
  const { data, error } = await supabase
    .from("events")
    .select(LIST_COLUMNS)
    .eq("property_id", propertyId)
    .eq("is_template", false)
    .gte("start_at", new Date().toISOString())
    .order("start_at", { ascending: true });

  if (error) throw new Error(`Couldn't load upcoming events: ${error.message}`);

  const rows = data ?? [];
  const ids = rows.map((row) => row.id as string);

  const confirmedByEvent = new Map<string, number>();
  if (ids.length > 0) {
    const { data: registrations } = await supabase
      .from("event_registrations")
      .select("event_id, guest_count")
      .in("event_id", ids)
      .eq("status", "confirmed");
    for (const registration of registrations ?? []) {
      confirmedByEvent.set(
        registration.event_id,
        (confirmedByEvent.get(registration.event_id) ?? 0) + registration.guest_count,
      );
    }
  }

  return rows.map((row) => {
    const property = pickOne(row.properties as { name: string } | { name: string }[] | null);
    return {
      id: row.id,
      title: row.title,
      propertyName: property?.name ?? "—",
      startAt: row.start_at,
      status: row.status as EventStatus,
      maxCapacity: row.max_capacity,
      confirmedCount: confirmedByEvent.get(row.id) ?? 0,
      memberPrice: row.member_price === null ? null : Number(row.member_price),
      nonMemberPrice: row.non_member_price === null ? null : Number(row.non_member_price),
      isTemplate: row.is_template,
    };
  });
}

export async function getEventTemplates(
  supabase: SupabaseClient,
): Promise<AdminEventTemplateOption[]> {
  const { data, error } = await supabase
    .from("events")
    .select("id, title, properties ( name )")
    .eq("is_template", true)
    .order("title");

  if (error) throw new Error(`Couldn't load event templates: ${error.message}`);

  return (data ?? []).map((row) => {
    const property = pickOne(row.properties as { name: string } | { name: string }[] | null);
    return { id: row.id, title: row.title, propertyName: property?.name ?? "—" };
  });
}

const DETAIL_COLUMNS =
  "id, property_id, title, summary, description, start_at, end_at, location, instructors, type, discipline, featured, max_capacity, max_guests_per_registration, member_price, non_member_price, status, is_manually_sold_out, is_template, image_url, event_info_boxes ( id, box_type, heading, body, items, sort_order )";

type DetailRow = {
  id: string;
  property_id: string;
  title: string;
  summary: string | null;
  description: string | null;
  start_at: string;
  end_at: string | null;
  location: string | null;
  instructors: string | null;
  type: string | null;
  discipline: string | null;
  featured: boolean;
  max_capacity: number;
  max_guests_per_registration: number;
  member_price: string | number | null;
  non_member_price: string | number | null;
  status: EventStatus;
  is_manually_sold_out: boolean;
  is_template: boolean;
  image_url: string | null;
  event_info_boxes: {
    id: string;
    box_type: EventInfoBoxType;
    heading: string;
    body: string | null;
    items: string[] | null;
    sort_order: number;
  }[];
};

function rowToDetail(row: DetailRow): AdminEventDetail {
  return {
    id: row.id,
    propertyId: row.property_id,
    title: row.title,
    summary: row.summary,
    description: row.description,
    startAt: row.start_at,
    endAt: row.end_at,
    location: row.location,
    instructors: row.instructors,
    type: row.type,
    discipline: row.discipline,
    featured: row.featured,
    maxCapacity: row.max_capacity,
    maxGuestsPerRegistration: row.max_guests_per_registration,
    memberPrice: row.member_price === null ? null : Number(row.member_price),
    nonMemberPrice: row.non_member_price === null ? null : Number(row.non_member_price),
    status: row.status,
    isManuallySoldOut: row.is_manually_sold_out,
    isTemplate: row.is_template,
    imageUrl: row.image_url,
    infoBoxes: [...row.event_info_boxes]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((box) => ({
        id: box.id,
        boxType: box.box_type,
        heading: box.heading,
        body: box.body,
        items: box.items,
        sortOrder: box.sort_order,
      })),
  };
}

export async function getEvent(
  supabase: SupabaseClient,
  id: string,
): Promise<AdminEventDetail | null> {
  const { data, error } = await supabase
    .from("events")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Couldn't load event: ${error.message}`);
  if (!data) return null;
  return rowToDetail(data as unknown as DetailRow);
}

// Insert or update an event plus its info boxes. Boxes are replaced
// wholesale on each save (delete-then-insert) since the editor always
// submits the full desired set — same approach as promotions' targeting
// join rows.
export async function saveEvent(
  supabase: SupabaseClient,
  input: SaveEventInput,
): Promise<SaveEventResult> {
  const columns = {
    property_id: input.propertyId,
    title: input.title,
    summary: input.summary,
    description: input.description,
    start_at: chicagoWallClockToUtcIso(input.startAt),
    end_at: input.endAt ? chicagoWallClockToUtcIso(input.endAt) : null,
    location: input.location,
    instructors: input.instructors,
    type: input.type,
    discipline: input.discipline,
    featured: input.featured,
    max_capacity: input.maxCapacity,
    max_guests_per_registration: input.maxGuestsPerRegistration,
    member_price: input.memberPrice,
    non_member_price: input.nonMemberPrice,
    status: input.status,
    is_manually_sold_out: input.isManuallySoldOut,
    is_template: input.isTemplate,
    image_url: input.imageUrl,
  };

  let eventId: string;

  if (input.id) {
    const { error } = await supabase.from("events").update(columns).eq("id", input.id);
    if (error) return { ok: false, error: `Couldn't save the event: ${error.message}` };
    eventId = input.id;
  } else {
    const { data, error } = await supabase.from("events").insert(columns).select("id").single();
    if (error || !data) {
      return { ok: false, error: `Couldn't create the event: ${error?.message ?? "no id returned"}` };
    }
    eventId = (data as { id: string }).id;
  }

  const { error: clearError } = await supabase.from("event_info_boxes").delete().eq("event_id", eventId);
  if (clearError) return { ok: false, error: `Couldn't update info boxes: ${clearError.message}` };

  if (input.infoBoxes.length > 0) {
    const { error: boxError } = await supabase.from("event_info_boxes").insert(
      input.infoBoxes.map((box) => ({
        event_id: eventId,
        box_type: box.boxType,
        heading: box.heading,
        body: box.boxType === "description" ? box.body : null,
        items: box.boxType === "list" ? (box.items ?? []).filter((item) => item.trim()) : null,
        sort_order: box.sortOrder,
      })),
    );
    if (boxError) return { ok: false, error: `Couldn't save info boxes: ${boxError.message}` };
  }

  return { ok: true, id: eventId };
}

export async function deleteEvent(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  // event_info_boxes rows cascade on delete. event_registrations does not
  // (no ON DELETE CASCADE) — deleting an event with existing registrations
  // fails the FK constraint rather than silently orphaning registrant data;
  // staff must cancel the event instead of deleting it once anyone has signed up.
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Clone a template event into a fresh draft — snapshot copy, not a live
// link, same principle as bid_content_library. The new row starts as an
// unpublished, non-template draft the admin edits before publishing.
export async function duplicateEventFromTemplate(
  supabase: SupabaseClient,
  templateId: string,
): Promise<SaveEventResult> {
  const template = await getEvent(supabase, templateId);
  if (!template) return { ok: false, error: "Template not found." };

  return saveEvent(supabase, {
    propertyId: template.propertyId,
    title: `${template.title} (copy)`,
    summary: template.summary,
    description: template.description,
    startAt: template.startAt,
    endAt: template.endAt,
    location: template.location,
    instructors: template.instructors,
    type: template.type,
    discipline: template.discipline,
    // A cloned draft never starts featured — that's a per-event editorial
    // choice, not something a template should carry forward automatically.
    featured: false,
    maxCapacity: template.maxCapacity,
    maxGuestsPerRegistration: template.maxGuestsPerRegistration,
    memberPrice: template.memberPrice,
    nonMemberPrice: template.nonMemberPrice,
    status: "draft",
    isManuallySoldOut: false,
    isTemplate: false,
    imageUrl: template.imageUrl,
    infoBoxes: template.infoBoxes.map((box) => ({
      boxType: box.boxType,
      heading: box.heading,
      body: box.body,
      items: box.items,
      sortOrder: box.sortOrder,
    })),
  });
}

export async function getEventRoster(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventRosterRow[]> {
  const { data, error } = await supabase
    .from("event_registrations")
    .select("id, contact_name, contact_email, contact_phone, guest_count, status, is_member_rate, price_quoted, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Couldn't load registrations: ${error.message}`);

  return (data ?? []).map((row) => ({
    registrationId: row.id,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    guestCount: row.guest_count,
    status: row.status,
    isMemberRate: row.is_member_rate,
    priceQuoted: row.price_quoted === null ? null : Number(row.price_quoted),
    createdAt: row.created_at,
  }));
}

export async function cancelEventRegistration(
  supabase: SupabaseClient,
  registrationId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("event_registrations")
    .update({ status: "cancelled" })
    .eq("id", registrationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
