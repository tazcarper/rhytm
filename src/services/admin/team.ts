import { createServiceRoleClient } from "@/lib/supabase/service";

// Team / staff-profile reads. Service-role only — staff_profiles has no RLS
// policies (deny-by-default); callers are gated in app code (the /admin
// proxy + canManageTeam where it matters).

export type StaffStatus = "invited" | "active" | "disabled";

export interface TeamMember {
  userId: string;
  email: string;
  role: string;
  fullName: string | null;
  status: StaffStatus;
  invitedAt: string;
  acceptedAt: string | null;
}

interface StaffProfileRow {
  user_id: string;
  email: string;
  role: string;
  full_name: string | null;
  status: StaffStatus;
  invited_at: string;
  accepted_at: string | null;
}

function toMember(row: StaffProfileRow): TeamMember {
  return {
    userId: row.user_id,
    email: row.email,
    role: row.role,
    fullName: row.full_name,
    status: row.status,
    invitedAt: row.invited_at,
    acceptedAt: row.accepted_at,
  };
}

export async function getStaffProfile(userId: string): Promise<TeamMember | null> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("staff_profiles")
    .select("user_id, email, role, full_name, status, invited_at, accepted_at")
    .eq("user_id", userId)
    .maybeSingle();
  return data ? toMember(data as StaffProfileRow) : null;
}

export async function getTeam(): Promise<TeamMember[]> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("staff_profiles")
    .select("user_id, email, role, full_name, status, invited_at, accepted_at")
    .order("created_at", { ascending: true });
  return ((data as StaffProfileRow[] | null) ?? []).map(toMember);
}

// True when a signed-in staff user still needs to set their name (no row yet,
// or full_name not set). Fails open: a DB error (e.g. the migration not
// applied yet) must not lock staff out of the portal.
export async function staffNeedsOnboarding(userId: string): Promise<boolean> {
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("staff_profiles")
      .select("full_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return false;
    return !data?.full_name?.trim();
  } catch {
    return false;
  }
}
