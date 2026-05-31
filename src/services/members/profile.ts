import type { SupabaseClient } from "@supabase/supabase-js";

// Member profile service. The "display name" is an APP-ONLY override
// stored in people.display_name — how this application addresses the
// member in the top bar, the member identity strip, and on their
// bookings. It is independent of the Supabase Auth identity (e.g. a
// Google-provided name), which we never modify. Reads elsewhere prefer
// display_name, then first_name, then the email local-part.

export interface MemberProfile {
  displayName: string | null;
  firstName: string | null;
}

export interface UpdateProfileResult {
  error: { message: string } | null;
}

// Reads the caller's own profile row. RLS ("people: self read") scopes
// this to the signed-in user; admins/partners have no people row and
// get nulls back, leaving the greeting decision to the caller.
export async function getMyProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<MemberProfile> {
  const { data } = await supabase
    .from("people")
    .select("first_name, display_name")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    displayName: data?.display_name?.trim() || null,
    firstName: data?.first_name?.trim() || null,
  };
}

// Writes the caller's display name via the set_my_display_name
// SECURITY DEFINER function. The function scopes the write to
// auth.uid() and touches only the display_name column, so a member
// can't edit their first/last name — or anyone else's row — through it.
export async function updateMyDisplayName(
  supabase: SupabaseClient,
  displayName: string,
): Promise<UpdateProfileResult> {
  const { error } = await supabase.rpc("set_my_display_name", {
    new_display_name: displayName,
  });
  return { error: error ? { message: error.message } : null };
}
