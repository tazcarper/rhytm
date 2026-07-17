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

const LIST_COLUMNS = "id, inquiry_type, name, email, status, created_at, properties ( name )";

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
      status: row.status,
      createdAt: row.created_at,
    };
  });
}

export async function getNewInquiryCount(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");
  if (error) throw new Error(`Couldn't count new inquiries: ${error.message}`);
  return count ?? 0;
}

const DETAIL_COLUMNS =
  "id, property_id, inquiry_type, name, email, phone, message, details, status, created_at, properties ( name )";

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
