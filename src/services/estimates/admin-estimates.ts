import type { SupabaseClient } from "@supabase/supabase-js";

// Admin-side reads + status mutation for the estimate-request queue.
// Takes an injected (cookie-aware) Supabase client so RLS scopes to the
// signed-in staff member via the `estimate_requests: staff …` policies.
// Returns clean domain types — never raw PostgREST shapes.

export const ESTIMATE_STATUSES = [
  "new",
  "building",
  "sent",
  "accepted",
  "declined",
  "converted",
] as const;
export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export const ESTIMATE_CHANNELS = [
  "member",
  "non_member",
  "public_group",
  "partner",
] as const;
export type EstimateChannel = (typeof ESTIMATE_CHANNELS)[number];

// Human labels for the channel/status enums (admin display).
export const ESTIMATE_CHANNEL_LABELS: Record<EstimateChannel, string> = {
  member: "Member",
  non_member: "Non-member",
  public_group: "Public group",
  partner: "Partner",
};

export const ESTIMATE_STATUS_LABELS: Record<EstimateStatus, string> = {
  new: "New",
  building: "Building",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  converted: "Converted",
};

export interface EstimateCustomLine {
  label: string;
  amount: number;
}

export interface EstimateRequestRow {
  id: string;
  status: EstimateStatus;
  sourceChannel: EstimateChannel;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  adults: number;
  juniors: number;
  // Party composition (nullable on rows created before the composition
  // migration — fall back to adults/juniors in the UI).
  members: number | null;
  guestAdults: number | null;
  guestJuniors: number | null;
  lessonHours: number | null;
  customLines: EstimateCustomLine[];
  experiences: string[];
  addons: Record<string, unknown>;
  catering: unknown;
  preferredDate: string | null;
  backupDate: string | null;
  arrival: string | null;
  notes: string | null;
  indicativeTotal: string | null;
  createdByLabel: string;
  createdAt: string;
  propertyId: string | null;
  propertyName: string | null;
}

// Raw row shape from the select (joined property name).
interface RawRow {
  id: string;
  status: EstimateStatus;
  source_channel: EstimateChannel;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  adults: number;
  juniors: number;
  members: number | null;
  guest_adults: number | null;
  guest_juniors: number | null;
  lesson_hours: number | null;
  custom_lines: unknown;
  experiences: unknown;
  addons: unknown;
  catering: unknown;
  preferred_date: string | null;
  backup_date: string | null;
  arrival: string | null;
  notes: string | null;
  indicative_total: string | null;
  created_by_label: string;
  created_at: string;
  property_id: string | null;
  properties: { name: string } | null;
}

const SELECT_COLUMNS =
  "id, status, source_channel, contact_name, contact_email, contact_phone, " +
  "adults, juniors, members, guest_adults, guest_juniors, lesson_hours, custom_lines, " +
  "experiences, addons, catering, preferred_date, backup_date, " +
  "arrival, notes, indicative_total, created_by_label, created_at, property_id, " +
  "properties(name)";

function toRow(r: RawRow): EstimateRequestRow {
  return {
    id: r.id,
    status: r.status,
    sourceChannel: r.source_channel,
    contactName: r.contact_name,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
    adults: r.adults,
    juniors: r.juniors,
    members: r.members,
    guestAdults: r.guest_adults,
    guestJuniors: r.guest_juniors,
    lessonHours: r.lesson_hours,
    customLines: Array.isArray(r.custom_lines)
      ? (r.custom_lines as EstimateCustomLine[])
      : [],
    experiences: Array.isArray(r.experiences) ? (r.experiences as string[]) : [],
    addons:
      r.addons && typeof r.addons === "object"
        ? (r.addons as Record<string, unknown>)
        : {},
    catering: r.catering ?? null,
    preferredDate: r.preferred_date,
    backupDate: r.backup_date,
    arrival: r.arrival,
    notes: r.notes,
    indicativeTotal: r.indicative_total,
    createdByLabel: r.created_by_label,
    createdAt: r.created_at,
    propertyId: r.property_id,
    propertyName: r.properties?.name ?? null,
  };
}

// All estimate requests, newest first. The admin page groups by status.
export async function listEstimateRequests(
  supabase: SupabaseClient,
): Promise<EstimateRequestRow[]> {
  const { data, error } = await supabase
    .from("estimate_requests")
    .select(SELECT_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[estimates/admin-estimates] list failed", { error });
    return [];
  }
  return ((data ?? []) as unknown as RawRow[]).map(toRow);
}

// One estimate request by id, or null if not found / not visible.
export async function getEstimateRequest(
  supabase: SupabaseClient,
  id: string,
): Promise<EstimateRequestRow | null> {
  const { data, error } = await supabase
    .from("estimate_requests")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[estimates/admin-estimates] get failed", { id, error });
    return null;
  }
  return data ? toRow(data as unknown as RawRow) : null;
}

export type UpdateEstimateStatusResult =
  | { ok: true }
  | { ok: false; error: string };

// Move a lead along the pipeline. RLS (staff update policy) is the real
// gate; the explicit status allowlist guards against a bad value reaching
// the enum column.
export async function updateEstimateStatus(
  supabase: SupabaseClient,
  id: string,
  status: EstimateStatus,
): Promise<UpdateEstimateStatusResult> {
  if (!ESTIMATE_STATUSES.includes(status)) {
    return { ok: false, error: "Invalid status." };
  }

  const { error } = await supabase
    .from("estimate_requests")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("[estimates/admin-estimates] status update failed", {
      id,
      status,
      error,
    });
    return { ok: false, error: "Could not update the status. Please try again." };
  }
  return { ok: true };
}
