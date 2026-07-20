import type { SupabaseClient } from "@supabase/supabase-js";

// Admin queries + mutations for inquiries (see the inquiries migration).
// "Resolve" and "add a note" are each one service call that writes both the
// status (resolve only) and an audit row in inquiry_events — not a DB
// trigger, so the note stays optional/free-text at write time.

export type InquiryType = "membership" | "private_event";
export type InquiryStatus = "new" | "resolved";
export type InquiryEventType = "note" | "contacted" | "denied" | "resolved";

export interface AdminInquiryListRow {
  id: string;
  inquiryType: InquiryType;
  name: string;
  email: string;
  propertyName: string;
  sourceLabel: string | null;
  status: InquiryStatus;
  createdAt: string;
}

export interface AdminInquiryDetail {
  id: string;
  propertyId: string;
  propertyName: string;
  inquiryType: InquiryType;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  details: Record<string, unknown>;
  sourcePage: string | null;
  sourceLabel: string | null;
  status: InquiryStatus;
  createdAt: string;
}

export interface AdminInquiryEvent {
  id: string;
  eventType: InquiryEventType;
  note: string | null;
  createdAt: string;
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const LIST_COLUMNS =
  "id, inquiry_type, name, email, status, created_at, source_label, properties ( name )";

export async function getInquiriesList(
  supabase: SupabaseClient,
  { status }: { status: InquiryStatus },
): Promise<AdminInquiryListRow[]> {
  const { data, error } = await supabase
    .from("inquiries")
    .select(LIST_COLUMNS)
    .eq("status", status)
    .order("created_at", { ascending: status === "new" });

  if (error) throw new Error(`Couldn't load inquiries: ${error.message}`);

  return (data ?? []).map((row) => {
    const property = pickOne(row.properties as { name: string } | { name: string }[] | null);
    return {
      id: row.id,
      inquiryType: row.inquiry_type,
      name: row.name,
      email: row.email,
      propertyName: property?.name ?? "—",
      sourceLabel: row.source_label,
      status: row.status,
      createdAt: row.created_at,
    };
  });
}

type UnactionedRow = {
  id: string;
  inquiry_type: InquiryType;
  name: string;
  email: string;
  status: InquiryStatus;
  created_at: string;
  source_label: string | null;
  properties: { name: string } | { name: string }[] | null;
  inquiry_events: { id: string }[] | null;
};

// "Unactioned" is narrower than status = "new": a "new" inquiry that staff
// has already logged a Contacted/Denied/Note update against (see
// InquiryDetail) has been responded to even if it isn't formally resolved
// yet. The nav badge and dashboard "needs attention" queue both track this
// set, not the full "New" status bucket the /admin/inquiries tab shows.
export async function getUnactionedInquiries(
  supabase: SupabaseClient,
): Promise<AdminInquiryListRow[]> {
  const { data, error } = await supabase
    .from("inquiries")
    .select(`${LIST_COLUMNS}, inquiry_events ( id )`)
    .eq("status", "new")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Couldn't load inquiries: ${error.message}`);

  return ((data ?? []) as unknown as UnactionedRow[])
    .filter((row) => (row.inquiry_events ?? []).length === 0)
    .map((row) => {
      const property = pickOne(row.properties);
      return {
        id: row.id,
        inquiryType: row.inquiry_type,
        name: row.name,
        email: row.email,
        propertyName: property?.name ?? "—",
        sourceLabel: row.source_label,
        status: row.status,
        createdAt: row.created_at,
      };
    });
}

export async function getUnactionedInquiryCount(supabase: SupabaseClient): Promise<number> {
  const rows = await getUnactionedInquiries(supabase);
  return rows.length;
}

const DETAIL_COLUMNS =
  "id, property_id, inquiry_type, name, email, phone, message, details, source_page, source_label, status, created_at, properties ( name )";

export async function getInquiry(
  supabase: SupabaseClient,
  id: string,
): Promise<AdminInquiryDetail | null> {
  const { data, error } = await supabase
    .from("inquiries")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Couldn't load inquiry: ${error.message}`);
  if (!data) return null;

  const property = pickOne(data.properties as { name: string } | { name: string }[] | null);
  return {
    id: data.id,
    propertyId: data.property_id,
    propertyName: property?.name ?? "—",
    inquiryType: data.inquiry_type,
    name: data.name,
    email: data.email,
    phone: data.phone,
    message: data.message,
    details: (data.details ?? {}) as Record<string, unknown>,
    sourcePage: data.source_page,
    sourceLabel: data.source_label,
    status: data.status,
    createdAt: data.created_at,
  };
}

export async function getInquiryEvents(
  supabase: SupabaseClient,
  inquiryId: string,
): Promise<AdminInquiryEvent[]> {
  const { data, error } = await supabase
    .from("inquiry_events")
    .select("id, event_type, note, created_at")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Couldn't load inquiry history: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    note: row.note,
    createdAt: row.created_at,
  }));
}

export async function addInquiryNote(
  supabase: SupabaseClient,
  input: { inquiryId: string; eventType: InquiryEventType; note: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("inquiry_events").insert({
    inquiry_id: input.inquiryId,
    event_type: input.eventType,
    note: input.note,
    created_by_admin_id: user?.id ?? null,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Marks the inquiry resolved and logs a matching audit event in one call.
// Not a DB transaction across two PostgREST requests, but low-concurrency
// admin writes make a partial failure (status flips, audit row doesn't)
// an acceptable, correctable edge case — same tradeoff promotions makes
// for its property-targeting rows.
export async function resolveInquiry(
  supabase: SupabaseClient,
  input: { inquiryId: string; note: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const { error: updateError } = await supabase
    .from("inquiries")
    .update({ status: "resolved" })
    .eq("id", input.inquiryId);
  if (updateError) return { ok: false, error: updateError.message };

  return addInquiryNote(supabase, {
    inquiryId: input.inquiryId,
    eventType: "resolved",
    note: input.note,
  });
}
