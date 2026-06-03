import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdminProperty {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  bookingHorizonDays: number;
  maxConcurrentGroups: number;
  tagline: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  // Pre-event reminder content (App 9 W3). Static per property; rendered in
  // the cadence emails. Null omits the corresponding section.
  directions: string | null;
  parking: string | null;
  arrivalContact: string | null;
  // Admin-pasted Google Maps share link; rendered as the "Open in Google
  // Maps" link in the pre-event emails.
  mapUrl: string | null;
  // Staff inbox for "new booking request" review alerts. Null → no alert.
  notificationEmail: string | null;
}

type AdminPropertyRow = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  booking_horizon_days: number;
  max_concurrent_groups: number;
  tagline: string | null;
  support_email: string | null;
  support_phone: string | null;
  directions: string | null;
  parking: string | null;
  arrival_contact: string | null;
  map_url: string | null;
  notification_email: string | null;
};

const SELECT_COLUMNS =
  "id, name, slug, timezone, booking_horizon_days, max_concurrent_groups, tagline, support_email, support_phone, directions, parking, arrival_contact, map_url, notification_email";

function rowToProperty(row: AdminPropertyRow): AdminProperty {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    timezone: row.timezone,
    bookingHorizonDays: row.booking_horizon_days,
    maxConcurrentGroups: row.max_concurrent_groups,
    tagline: row.tagline,
    supportEmail: row.support_email,
    supportPhone: row.support_phone,
    directions: row.directions,
    parking: row.parking,
    arrivalContact: row.arrival_contact,
    mapUrl: row.map_url,
    notificationEmail: row.notification_email,
  };
}

export async function getAdminPropertyById(
  supabase: SupabaseClient,
  id: string,
): Promise<AdminProperty | null> {
  const { data, error } = await supabase
    .from("properties")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`Admin property read failed: ${error.message}`);
  }
  return data ? rowToProperty(data as AdminPropertyRow) : null;
}

export async function getAdminPropertiesList(
  supabase: SupabaseClient,
): Promise<AdminProperty[]> {
  const { data, error } = await supabase
    .from("properties")
    .select(SELECT_COLUMNS)
    .order("name");

  if (error) {
    throw new Error(`Admin properties list failed: ${error.message}`);
  }
  return ((data ?? []) as AdminPropertyRow[]).map(rowToProperty);
}

const nullableTrimmed = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined) return null;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    })
    .refine(
      (value) => value === null || value.length <= max,
      `Must be ${max} characters or fewer`,
    );

const optionalEmail = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  })
  .refine(
    (value) => value === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    "Not a valid email",
  );

// Google Maps share link — must be an http(s) URL when present.
const optionalUrl = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  })
  .refine(
    (value) => value === null || /^https?:\/\/\S+$/.test(value),
    "Must be a link starting with http:// or https://",
  );

export const UpdateAdminPropertyInputSchema = z.object({
  propertyId: z.string().uuid(),
  bookingHorizonDays: z.coerce
    .number()
    .int()
    .min(1, "Must be at least 1 day")
    .max(365, "Must be 365 days or fewer"),
  maxConcurrentGroups: z.coerce
    .number()
    .int()
    .min(1, "Must be at least 1"),
  tagline: nullableTrimmed(500),
  supportEmail: optionalEmail,
  supportPhone: nullableTrimmed(50),
  directions: nullableTrimmed(2000),
  parking: nullableTrimmed(2000),
  arrivalContact: nullableTrimmed(500),
  mapUrl: optionalUrl,
  notificationEmail: optionalEmail,
});

export type UpdateAdminPropertyInput = z.infer<
  typeof UpdateAdminPropertyInputSchema
>;
export type UpdateAdminPropertyRawInput = z.input<
  typeof UpdateAdminPropertyInputSchema
>;

export interface UpdateAdminPropertyResult {
  ok: boolean;
  error?: string;
}

export async function updateAdminProperty(
  supabase: SupabaseClient,
  input: UpdateAdminPropertyInput,
): Promise<UpdateAdminPropertyResult> {
  const { error } = await supabase
    .from("properties")
    .update({
      booking_horizon_days: input.bookingHorizonDays,
      max_concurrent_groups: input.maxConcurrentGroups,
      tagline: input.tagline,
      support_email: input.supportEmail,
      support_phone: input.supportPhone,
      directions: input.directions,
      parking: input.parking,
      arrival_contact: input.arrivalContact,
      map_url: input.mapUrl,
      notification_email: input.notificationEmail,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.propertyId);

  if (error) {
    return { ok: false, error: `Couldn't save property: ${error.message}` };
  }
  return { ok: true };
}
