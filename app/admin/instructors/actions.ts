"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { canManageTeam, hasAdminAccess } from "@/lib/auth/portal";
import {
  createPublicImageStorage,
  INSTRUCTOR_PHOTO_BUCKET,
} from "@/lib/storage/public-image-storage";
import {
  uploadPublicImage,
  type UploadPublicImageResult,
} from "@/src/services/admin/upload-public-image";
import {
  saveInstructorProfile,
  SaveInstructorProfileSchema,
  type SaveInstructorProfileInput,
  type SaveInstructorProfileResult,
} from "@/src/services/admin/instructors";
import {
  saveInstructorSchedule,
  SaveInstructorScheduleSchema,
  addInstructorException,
  AddInstructorExceptionSchema,
  deleteInstructorException,
  type SaveInstructorScheduleInput,
  type AddInstructorExceptionInput,
  type ScheduleMutationResult,
} from "@/src/services/admin/instructor-schedule";
import { recordDevAuthEmail } from "@/src/services/notifications/send-email";

// Onboarding for the instructor portal — mirrors app/admin/team/actions.ts.
// The difference from staff: alongside stamping app_metadata.role, we link the
// instructors row (user_id + email) at invite time so current_instructor_id()
// resolves on the instructor's very first request. Because the role is
// pre-stamped, /auth/callback needs no instructor branch (it skips the member
// linking path and routes via portalHomeForRole).

type Result = { ok: boolean; error?: string; link?: string; instructorId?: string };

interface ManagedInstructor {
  id: string;
  propertyId: string;
  email: string | null;
  userId: string | null;
}

// Caller must be super_admin/admin, or a property_manager for the instructor's
// own property (matches the instructors write RLS). Loads the instructor via
// service role so the check works regardless of the caller's read scope.
async function requireInstructorManager(
  instructorId: string,
): Promise<{ ok: true; instructor: ManagedInstructor } | { ok: false; error: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You don't have permission to manage instructors." };
  }
  const role = user.app_metadata?.role as string | undefined;
  const propertyClaim = user.app_metadata?.property_id as string | undefined;

  const admin = createServiceRoleClient();
  const { data: instructor } = await admin
    .from("instructors")
    .select("id, property_id")
    .eq("id", instructorId)
    .maybeSingle();
  if (!instructor) {
    return { ok: false, error: "Instructor not found." };
  }

  const isAdmin = role === "super_admin" || role === "admin";
  const isOwningPm =
    role === "property_manager" && propertyClaim === instructor.property_id;
  if (!isAdmin && !isOwningPm) {
    return { ok: false, error: "You don't have permission to manage this instructor." };
  }

  const { data: access } = await admin
    .from("instructor_portal_access")
    .select("user_id, email")
    .eq("instructor_id", instructorId)
    .maybeSingle();

  return {
    ok: true,
    instructor: {
      id: instructor.id as string,
      propertyId: instructor.property_id as string,
      email: (access?.email as string | null) ?? null,
      userId: (access?.user_id as string | null) ?? null,
    },
  };
}

function requestOrigin(requestHeaders: Headers): string {
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = requestHeaders.get("host");
  return host ? `${proto}://${host}` : "";
}

const CreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().email("Enter a valid email."),
  phone: z.string().trim().optional(),
  propertyIds: z.array(z.string().uuid()).min(1, "Pick at least one property."),
});

// Create a new instructor: the catalog row (primary property = first selected),
// the full availability set in instructor_properties, and the access row with
// contact details (email required, phone optional, no login until invited).
// Gated to super_admin/admin — creating the roster (incl. multi-property) is an
// admin job; property managers still invite their property's instructors below.
// The three inserts aren't a single transaction, so a partial failure deletes
// the half-created instructor (cascades clean the children).
export async function createInstructor(input: {
  name: string;
  email: string;
  phone?: string;
  propertyIds: string[];
}): Promise<Result> {
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role as string | undefined;
  if (!canManageTeam(role)) {
    return { ok: false, error: "Only admins can add instructors." };
  }

  const name = parsed.data.name.trim();
  const email = parsed.data.email.toLowerCase();
  const phone = parsed.data.phone?.trim() || null;
  const propertyIds = [...new Set(parsed.data.propertyIds)];
  const [primaryPropertyId] = propertyIds;
  const admin = createServiceRoleClient();

  // Reject a duplicate portal email up front (we always store lowercase) so the
  // partial unique index doesn't surface a raw constraint error.
  const { data: clash } = await admin
    .from("instructor_portal_access")
    .select("instructor_id")
    .eq("email", email)
    .maybeSingle();
  if (clash) {
    return { ok: false, error: "An instructor with that email already exists." };
  }

  const { data: created, error: insertError } = await admin
    .from("instructors")
    .insert({ name, property_id: primaryPropertyId, is_active: true })
    .select("id")
    .single();
  if (insertError || !created) {
    return { ok: false, error: "Couldn't create the instructor." };
  }
  const instructorId = created.id as string;

  const { error: linkError } = await admin
    .from("instructor_properties")
    .insert(
      propertyIds.map((propertyId) => ({
        instructor_id: instructorId,
        property_id: propertyId,
      })),
    );
  if (linkError) {
    await admin.from("instructors").delete().eq("id", instructorId);
    return { ok: false, error: "Couldn't assign the selected properties — try again." };
  }

  const { error: accessError } = await admin
    .from("instructor_portal_access")
    .insert({ instructor_id: instructorId, email, phone, user_id: null, invited_at: null });
  if (accessError) {
    await admin.from("instructors").delete().eq("id", instructorId);
    return { ok: false, error: "Couldn't save contact details — try again." };
  }

  revalidatePath("/admin/instructors");
  return { ok: true, instructorId };
}

const InviteSchema = z.object({
  instructorId: z.string().uuid(),
  email: z.string().email(),
});

// Create the auth user (sends the invite email), stamp role + property so the
// callback routes them to /instructor, and write the portal-access row.
export async function inviteInstructorToPortal(input: {
  instructorId: string;
  email: string;
}): Promise<Result> {
  const parsed = InviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the email." };
  }

  const guard = await requireInstructorManager(parsed.data.instructorId);
  if (!guard.ok) return { ok: false, error: guard.error };
  if (guard.instructor.userId) {
    return { ok: false, error: "This instructor already has portal access." };
  }

  const email = parsed.data.email.toLowerCase();
  const admin = createServiceRoleClient();
  const origin = requestOrigin(await headers());

  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/callback`,
    });
  if (inviteError || !invited?.user) {
    const message = /already|registered|exists/i.test(inviteError?.message ?? "")
      ? "That email already has an account."
      : inviteError?.message ?? "Couldn't send the invite.";
    return { ok: false, error: message };
  }

  const newUserId = invited.user.id;

  const { error: stampError } = await admin.auth.admin.updateUserById(newUserId, {
    app_metadata: { role: "instructor", property_id: guard.instructor.propertyId },
  });
  if (stampError) {
    return { ok: false, error: "Invite sent, but the role couldn't be set — try again." };
  }

  const { error: linkError } = await admin
    .from("instructor_portal_access")
    .upsert(
      {
        instructor_id: guard.instructor.id,
        user_id: newUserId,
        email,
        invited_at: new Date().toISOString(),
      },
      { onConflict: "instructor_id" },
    );
  if (linkError) {
    return { ok: false, error: "Invite sent, but linking the instructor failed." };
  }

  await recordDevAuthEmail({ source: "instructor_invite", type: "invite", to: email });

  revalidatePath("/admin/instructors");
  return { ok: true };
}

// Fresh sign-in link for an already-invited instructor (lost/expired invite).
// Returns the link for the manager to pass along (auto-email once Resend is
// wired), mirroring resendTeamInvite.
export async function resendInstructorInvite(input: {
  instructorId: string;
}): Promise<Result> {
  const guard = await requireInstructorManager(input.instructorId);
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!guard.instructor.email) {
    return { ok: false, error: "No email on file — invite them first." };
  }

  const admin = createServiceRoleClient();
  const origin = requestOrigin(await headers());

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: guard.instructor.email,
    options: { redirectTo: `${origin}/auth/callback` },
  });
  const link = data?.properties?.action_link;
  if (error || !link) {
    return { ok: false, error: error?.message ?? "Couldn't generate a sign-in link." };
  }

  await recordDevAuthEmail({
    source: "instructor_invite_resend",
    type: "magic_link",
    to: guard.instructor.email,
    actionLink: link,
  });

  return { ok: true, link };
}

// Revoke portal access: clear the user_id link first (the FK blocks deleting a
// referenced auth user), then delete the auth account for an immediate
// cut-off. The access row's email is kept so the admin can re-invite without
// retyping; the instructor catalog row (and its bookings) are untouched.
export async function revokeInstructorPortalAccess(input: {
  instructorId: string;
}): Promise<Result> {
  const guard = await requireInstructorManager(input.instructorId);
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!guard.instructor.userId) {
    return { ok: false, error: "This instructor has no portal access." };
  }

  const admin = createServiceRoleClient();

  const { error: unlinkError } = await admin
    .from("instructor_portal_access")
    .update({ user_id: null })
    .eq("instructor_id", guard.instructor.id);
  if (unlinkError) {
    return { ok: false, error: "Couldn't revoke access." };
  }

  const { error: delError } = await admin.auth.admin.deleteUser(
    guard.instructor.userId,
  );
  if (delError) {
    return { ok: false, error: "Link cleared, but removing the account failed." };
  }

  revalidatePath("/admin/instructors");
  return { ok: true };
}

// Replace an instructor's entire recurring weekly schedule. Validate, authorize
// (super_admin/admin anywhere, or the owning property manager), then delegate to
// the atomic save_instructor_schedule RPC via service role.
export async function saveInstructorScheduleAction(
  input: SaveInstructorScheduleInput,
): Promise<ScheduleMutationResult> {
  const parsed = SaveInstructorScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the schedule." };
  }

  const guard = await requireInstructorManager(parsed.data.instructorId);
  if (!guard.ok) return { ok: false, error: guard.error };

  const result = await saveInstructorSchedule(createServiceRoleClient(), parsed.data);
  if (result.ok) {
    revalidatePath(`/admin/instructors/${parsed.data.instructorId}/schedule`);
  }
  return result;
}

// Add one date-specific schedule exception (time off or one-off availability).
export async function addInstructorExceptionAction(
  input: AddInstructorExceptionInput,
): Promise<ScheduleMutationResult> {
  const parsed = AddInstructorExceptionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the exception." };
  }

  const guard = await requireInstructorManager(parsed.data.instructorId);
  if (!guard.ok) return { ok: false, error: guard.error };

  const result = await addInstructorException(createServiceRoleClient(), parsed.data);
  if (result.ok) {
    revalidatePath(`/admin/instructors/${parsed.data.instructorId}/schedule`);
  }
  return result;
}

// Remove one schedule exception.
export async function deleteInstructorExceptionAction(input: {
  instructorId: string;
  exceptionId: string;
}): Promise<ScheduleMutationResult> {
  const guard = await requireInstructorManager(input.instructorId);
  if (!guard.ok) return { ok: false, error: guard.error };

  const result = await deleteInstructorException(
    createServiceRoleClient(),
    input.instructorId,
    input.exceptionId,
  );
  if (result.ok) {
    revalidatePath(`/admin/instructors/${input.instructorId}/schedule`);
  }
  return result;
}

// Upload one instructor photo to the public instructor-photos bucket and
// return its public URL for the editor to store on instructors.photo_url.
// Admin-gated, then writes via service role (the bucket has no INSERT policy
// by design). Thin: auth + extract file + delegate to the shared upload
// service. Mirrors uploadAdventureImageAction.
export async function uploadInstructorPhotoAction(
  formData: FormData,
): Promise<UploadPublicImageResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!hasAdminAccess(user?.app_metadata?.role as string | undefined)) {
    return { ok: false, error: "Not authorized." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file received." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const storage = createPublicImageStorage(
    createServiceRoleClient(),
    INSTRUCTOR_PHOTO_BUCKET,
  );
  return uploadPublicImage(storage, { bytes, contentType: file.type });
}

// Save an instructor's profile (name, bio, photo, active/order) + availability
// set. Authorizes via requireInstructorManager (super_admin/admin anywhere, or
// a property_manager for their own instructor), then writes via service role
// so the instructors UPDATE and the instructor_properties sync both land
// regardless of the caller's RLS write scope. Thin: validate + authorize +
// delegate to the service + revalidate.
export async function saveInstructorProfileAction(
  input: SaveInstructorProfileInput,
): Promise<SaveInstructorProfileResult> {
  const parsed = SaveInstructorProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const guard = await requireInstructorManager(parsed.data.id);
  if (!guard.ok) return { ok: false, error: guard.error };

  const result = await saveInstructorProfile(createServiceRoleClient(), parsed.data);
  if (result.ok) {
    revalidatePath("/admin/instructors");
    revalidatePath(`/admin/instructors/${parsed.data.id}`);
    revalidatePath("/instructors");
  }
  return result;
}

// Hard-delete an instructor profile. Gated to super_admin/admin only (a
// property manager can edit their roster but not remove people — destructive
// + cross-property). Blocks the delete when any booking references the
// instructor: bookings.instructor_id is ON DELETE RESTRICT and we never want
// to lose reservation history — retire via the Active toggle instead. With no
// bookings, deleting the catalog row cascades instructor_properties +
// instructor_portal_access; the linked auth login (which does NOT cascade) is
// removed afterwards so no orphaned instructor account lingers.
export async function deleteInstructorAction(input: {
  instructorId: string;
}): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role as string | undefined;
  if (!canManageTeam(role)) {
    return { ok: false, error: "Only admins can delete instructors." };
  }

  const admin = createServiceRoleClient();

  const { data: bookingRefs } = await admin
    .from("bookings")
    .select("id")
    .eq("instructor_id", input.instructorId)
    .limit(1);
  if (bookingRefs?.length) {
    return {
      ok: false,
      error:
        "This instructor has bookings. Toggle Active off to retire them instead of deleting — that keeps the booking history intact.",
    };
  }

  // Capture the linked auth account before the cascade removes the access row,
  // so we can delete the now-orphaned login afterwards.
  const { data: access } = await admin
    .from("instructor_portal_access")
    .select("user_id")
    .eq("instructor_id", input.instructorId)
    .maybeSingle();
  const linkedUserId = (access?.user_id as string | null) ?? null;

  const { error: delError } = await admin
    .from("instructors")
    .delete()
    .eq("id", input.instructorId);
  if (delError) {
    return { ok: false, error: "Couldn't delete the instructor." };
  }

  // The access row that referenced this auth user is gone via cascade, so the
  // delete is now unblocked. Non-fatal if it fails — the profile is already
  // removed; at worst a dangling auth account remains for cleanup.
  if (linkedUserId) {
    await admin.auth.admin.deleteUser(linkedUserId);
  }

  revalidatePath("/admin/instructors");
  return { ok: true };
}
