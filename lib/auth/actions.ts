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

export type UpdatePasswordResult = { ok: boolean; error?: string };

// bcrypt caps the meaningful input at 72 bytes; below that we set a sane
// floor. The authoritative policy is the Supabase dashboard's password
// settings — this is a friendly first line of defense.
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

// Sets (or changes) the signed-in member's password so they can sign in
// directly next time instead of waiting for a magic link. Works on the
// existing invited auth user — no new user, no email re-confirmation. The
// session must be present (the member is on /member/profile, i.e. already
// authenticated), so the cookie-aware server client carries it into
// updateUser. Magic link remains available as the recovery path, so there's
// no separate reset flow.
export async function updatePassword(
  password: string,
): Promise<UpdatePasswordResult> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`,
    };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
