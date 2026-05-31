"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { updateMyDisplayName } from "@/src/services/members/profile";

// Signs the current Supabase user out and sends them back to /login.
// Used by the logout buttons in the member and admin portals (and
// anywhere else an authenticated surface needs an exit). Calling it
// from a <form action={signOut}> keeps the trigger a server-driven
// POST so we don't need a client component.
export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type UpdateDisplayNameResult = { ok: boolean; error?: string };

// Sets the member's app display name (people.display_name) — the name
// shown in the top bar, the member identity strip, and on their
// bookings. This is an app-only override; it does NOT change the
// Supabase Auth / OAuth identity. Thin like signOut: validate, delegate
// the write to the member profile service (a SECURITY DEFINER setter
// scoped to auth.uid()), then revalidate the /member layout so the
// strip re-renders.
export async function updateDisplayName(
  displayName: string,
): Promise<UpdateDisplayNameResult> {
  const trimmed = displayName.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Display name can’t be empty." };
  }
  if (trimmed.length > 80) {
    return { ok: false, error: "Display name must be 80 characters or fewer." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await updateMyDisplayName(supabase, trimmed);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/member", "layout");
  return { ok: true };
}
