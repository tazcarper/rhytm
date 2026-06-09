import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// Admin view of an instructor row, with just enough portal-access state to
// drive the invite/resend/revoke controls. `hasPortalAccess` is true once an
// auth account is linked (user_id set at invite time) — note this means
// "invited or active", not strictly "has signed in".
export interface AdminInstructorRow {
  id: string;
  name: string;
  // Every property the instructor is available for (from instructor_properties).
  properties: Array<{ id: string; name: string }>;
  email: string | null;
  phone: string | null;
  hasPortalAccess: boolean;
  isActive: boolean;
}

type InstructorRow = {
  id: string;
  name: string;
  is_active: boolean;
  // Reverse one-to-many embed → array.
  instructor_properties: Array<{ properties: { id: string; name: string } | null }> | null;
  // Reverse one-to-one embed (instructor_id is the access table's PK) →
  // PostgREST returns an object, or null when the instructor has no row yet.
  instructor_portal_access: {
    user_id: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

// Instructors visible to the caller, ordered by display order. Reads through
// the caller's RLS scope: super_admin/admin see all; a property manager sees
// their property's roster. Availability comes from instructor_properties
// (public read); contact + login state from instructor_portal_access (staff
// read).
export async function getAdminInstructors(
  supabase: SupabaseClient,
): Promise<AdminInstructorRow[]> {
  const { data, error } = await supabase
    .from("instructors")
    .select(
      "id, name, is_active, instructor_properties ( properties ( id, name ) ), instructor_portal_access ( user_id, email, phone )",
    )
    .order("display_order", { ascending: true });

  if (error) {
    throw new Error(`Admin instructors failed: ${error.message}`);
  }

  return ((data ?? []) as unknown as InstructorRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    properties: (row.instructor_properties ?? [])
      .map((link) => link.properties)
      .filter((property): property is { id: string; name: string } => property !== null),
    email: row.instructor_portal_access?.email ?? null,
    phone: row.instructor_portal_access?.phone ?? null,
    hasPortalAccess: (row.instructor_portal_access?.user_id ?? null) !== null,
    isActive: row.is_active,
  }));
}

// The editable profile of a single instructor, hydrated for the profile
// editor. `propertyIds` is the full availability set (instructor_properties);
// `primaryPropertyId` is the instructors.property_id anchor (always within
// the set). Contact (email/phone) is read-only context here — it's edited via
// the invite flow, not the profile editor — and stays on the private
// instructor_portal_access table (never the public instructors row).
export interface AdminInstructorEditable {
  id: string;
  name: string;
  bio: string | null;
  photoUrl: string | null;
  isActive: boolean;
  displayOrder: number;
  primaryPropertyId: string;
  propertyIds: string[];
  // The services (disciplines) this instructor is qualified to teach
  // (instructor_disciplines). Always a subset of services at `propertyIds`.
  disciplineIds: string[];
  email: string | null;
  phone: string | null;
  hasPortalAccess: boolean;
}

type EditableInstructorRow = {
  id: string;
  name: string;
  bio: string | null;
  photo_url: string | null;
  is_active: boolean;
  display_order: number;
  property_id: string;
  instructor_properties: Array<{ property_id: string }> | null;
  instructor_disciplines: Array<{ service_id: string }> | null;
  instructor_portal_access: {
    user_id: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

// One instructor's editable profile, or null if not visible/found. Reads
// through the caller's RLS scope: super_admin/admin see all; a property
// manager sees their property's roster. Public columns (bio/photo_url) come
// off the instructors row; contact off the private access table.
export async function getAdminInstructor(
  supabase: SupabaseClient,
  id: string,
): Promise<AdminInstructorEditable | null> {
  const { data, error } = await supabase
    .from("instructors")
    .select(
      "id, name, bio, photo_url, is_active, display_order, property_id, instructor_properties ( property_id ), instructor_disciplines ( service_id ), instructor_portal_access ( user_id, email, phone )",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Admin instructor failed: ${error.message}`);
  }
  if (!data) return null;

  const row = data as unknown as EditableInstructorRow;
  return {
    id: row.id,
    name: row.name,
    bio: row.bio,
    photoUrl: row.photo_url,
    isActive: row.is_active,
    displayOrder: row.display_order,
    primaryPropertyId: row.property_id,
    propertyIds: (row.instructor_properties ?? []).map((link) => link.property_id),
    disciplineIds: (row.instructor_disciplines ?? []).map((link) => link.service_id),
    email: row.instructor_portal_access?.email ?? null,
    phone: row.instructor_portal_access?.phone ?? null,
    hasPortalAccess: (row.instructor_portal_access?.user_id ?? null) !== null,
  };
}

// The disciplines (active services) an instructor can be assigned, for the
// profile editor's qualification picker. Returns options across the given
// properties so the editor can react to property-checkbox changes without a
// round-trip; the form groups them by property and only shows currently
// selected properties. Active-only — an inactive discipline isn't assignable.
export interface AdminDisciplineOption {
  id: string;
  name: string;
  propertyId: string;
}

export async function getAssignableDisciplines(
  supabase: SupabaseClient,
  propertyIds: ReadonlyArray<string>,
): Promise<AdminDisciplineOption[]> {
  if (propertyIds.length === 0) return [];

  const { data, error } = await supabase
    .from("services")
    .select("id, name, property_id")
    .in("property_id", propertyIds as string[])
    .eq("is_active", true)
    .order("property_id")
    .order("display_order")
    .order("name");

  if (error) {
    throw new Error(`Assignable disciplines failed: ${error.message}`);
  }

  return (
    (data ?? []) as Array<{ id: string; name: string; property_id: string }>
  ).map((service) => ({
    id: service.id,
    name: service.name,
    propertyId: service.property_id,
  }));
}

export const SaveInstructorProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required.").max(120),
  bio: z.string().trim().max(2000).optional(),
  photoUrl: z.string().trim().url("Photo must be a valid URL.").or(z.literal("")).optional(),
  isActive: z.boolean(),
  displayOrder: z.number().int().min(0).max(9999),
  propertyIds: z.array(z.string().uuid()).min(1, "Pick at least one property."),
  // Disciplines the instructor can teach. Pruned server-side to services at the
  // selected properties, so a stale client can't persist a cross-property pair.
  disciplineIds: z.array(z.string().uuid()).max(200).default([]),
});

export type SaveInstructorProfileInput = z.infer<typeof SaveInstructorProfileSchema>;

export type SaveInstructorProfileResult =
  | { ok: true }
  | { ok: false; error: string };

// Persist an instructor's editable profile atomically. Takes a service-role
// client (Dependency Inversion) — the caller (Server Action) authorizes first
// via requireInstructorManager, then injects service role so the
// save_instructor_profile RPC runs with RLS bypassed.
//
// Thin wrapper: the catalog-row update + both junction reconciliations
// (availability properties + teachable disciplines) run in one transaction
// inside the RPC, so a partial save is impossible. The RPC re-anchors the
// primary property if the admin deselected it, and prunes disciplines to
// services at the selected properties (a stale client can't persist a
// cross-property qualification).
export async function saveInstructorProfile(
  admin: SupabaseClient,
  input: SaveInstructorProfileInput,
): Promise<SaveInstructorProfileResult> {
  const { error } = await admin.rpc("save_instructor_profile", {
    p_instructor_id: input.id,
    p_name: input.name.trim(),
    p_bio: input.bio?.trim() || null,
    p_photo_url: input.photoUrl?.trim() || null,
    p_is_active: input.isActive,
    p_display_order: input.displayOrder,
    p_property_ids: [...new Set(input.propertyIds)],
    p_discipline_ids: [...new Set(input.disciplineIds)],
  });

  if (error) {
    // P0002 — the function's "instructor not found" raise.
    if (error.code === "P0002") {
      return { ok: false, error: "Instructor not found." };
    }
    return { ok: false, error: "Couldn't save the profile — try again." };
  }
  return { ok: true };
}
