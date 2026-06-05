import { createServiceRoleClient } from "@/lib/supabase/service";

// Resolves a staff/admin auth user id (e.g. bookings.created_by_admin_id) to
// a display name + email. Source of truth is the staff_profiles row (name set
// during onboarding); falls back to the auth user's metadata / email
// local-part if no profile exists yet.

export interface StaffIdentity {
  name: string;
  email: string;
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
