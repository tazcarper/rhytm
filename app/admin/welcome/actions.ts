"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { hasAdminAccess } from "@/lib/auth/portal";

// First-sign-in onboarding: a staff member sets their full name. Upserts the
// staff_profiles row (creating it for staff who pre-date the team feature),
// flips status to 'active'. Self-service — keyed to the caller's own id.
export async function completeStaffProfile(
  fullName: string,
): Promise<{ ok: boolean; error?: string }> {
  const name = fullName.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: "Enter your full name (2–80 characters)." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role as string | undefined;
  if (!user || !hasAdminAccess(role)) {
    return { ok: false, error: "Not authorized." };
  }

  const now = new Date().toISOString();
  const admin = createServiceRoleClient();
  const { error } = await admin.from("staff_profiles").upsert(
    {
      user_id: user.id,
      email: user.email ?? "",
      role: role!,
      full_name: name,
      status: "active",
      accepted_at: now,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );
  if (error) {
    return { ok: false, error: "Couldn't save your name. Please try again." };
  }

  // Re-render the admin layout so the onboarding gate clears.
  revalidatePath("/admin", "layout");
  return { ok: true };
}
