import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service";

// Resolves a staff/admin auth user id (e.g. bookings.created_by_admin_id) to
// a display name + email. Source of truth is the staff_profiles row (name set
// during onboarding); falls back to the auth user's metadata / email
// local-part if no profile exists yet.

export interface StaffIdentity {
  name: string;
  email: string;
}

// The signed-in staff member stamped onto an audit record (pricing events,
// override rows). id is the auth user id; email is denormalized at write time so
// the audit reads without a join back to auth.users.
export interface StaffActor {
  id: string;
  email: string;
}

// Resolve the current session's staff actor from a request-scoped Supabase
// client. Returns null when no user is signed in. One definition for the
// "who is doing this?" resolution shared by every admin write action, so the
// id/email pair is assembled the same way everywhere.
export async function resolveStaffActor(
  supabase: SupabaseClient,
): Promise<StaffActor | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;
  const identity = await getStaffIdentity(user.id);
  return { id: user.id, email: identity?.email ?? user.email ?? "unknown" };
}

export async function getStaffIdentity(userId: string): Promise<StaffIdentity | null> {
  const admin = createServiceRoleClient();

  // Preferred: the staff profile (real name captured at onboarding).
  const { data: profile } = await admin
    .from("staff_profiles")
    .select("full_name, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile?.email) {
    const name = profile.full_name?.trim() || profile.email.split("@")[0];
    return { name, email: profile.email };
  }

  // Fallback: the auth user (no profile row yet).
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user) return null;
  const user = data.user;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const namedClaim = [meta.full_name, meta.name, meta.display_name].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  const email = user.email ?? "";
  const name = namedClaim?.trim() || (email ? email.split("@")[0] : "Staff");
  return { name, email };
}
