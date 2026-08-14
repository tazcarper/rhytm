"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { canManageTeam, STAFF_ROLES, type StaffRole } from "@/lib/auth/portal";
import { recordDevAuthEmail } from "@/src/services/notifications/send-email";

// Confirms the caller may manage the team; returns their own user id (so
// actions can refuse to let someone change/disable/remove themselves).
async function requireManager(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role as string | undefined;
  if (!user || !canManageTeam(role)) {
    return { ok: false, error: "You don't have permission to manage the team." };
  }
  return { ok: true, userId: user.id };
}

// Merge changes into a user's app_metadata (read-modify-write, so we never
// clobber unrelated claims regardless of gotrue merge semantics). Returns
// whether it succeeded — most callers fire-and-forget, but callers that
// need to report a failure back to the UI can check it.
async function patchAppMetadata(
  admin: SupabaseClient,
  userId: string,
  changes: Record<string, unknown>,
): Promise<{ ok: boolean }> {
  const { data } = await admin.auth.admin.getUserById(userId);
  const current = (data?.user?.app_metadata ?? {}) as Record<string, unknown>;
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...current, ...changes },
  });
  return { ok: !error };
}

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.string(),
  propertyId: z.string().optional(),
});

// GoTrue's invite endpoint refuses an email that already has an auth user —
// including someone who simply signed in with Google/etc. on the public
// site before ever being made staff. listUsers has no email filter, so we
// paginate to find the match. Only runs on the "already registered"
// failure path, so cost is bounded by how often that happens, not by
// every invite.
async function findExistingAuthUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<{ id: string } | null> {
  const perPage = 200;
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) return null;
    const match = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (match) return { id: match.id };
    if (data.users.length < perPage) return null;
  }
  return null;
}

// Add a staff member: either create a brand-new auth user (sends the invite
// email) or, if the email already has an auth account (e.g. they signed in
// with Google before being made staff), attach the role to that existing
// account instead of failing. Either way we stamp their role so the
// callback routes them to /admin, and seed their staff_profiles row
// (status 'invited', no name yet — they set it at /admin/welcome on first
// sign-in). Gated to super_admin + admin.
export async function inviteTeamMember(input: {
  email: string;
  role: string;
  propertyId?: string;
}): Promise<{ ok: boolean; error?: string; message?: string }> {
  const parsed = InviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the email and role." };
  }
  if (!STAFF_ROLES.includes(parsed.data.role as StaffRole)) {
    return { ok: false, error: "Pick a valid role." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const callerRole = user?.app_metadata?.role as string | undefined;
  if (!user || !canManageTeam(callerRole)) {
    return { ok: false, error: "You don't have permission to add team members." };
  }

  const email = parsed.data.email.toLowerCase();
  const propertyId = parsed.data.propertyId?.trim() || undefined;
  const admin = createServiceRoleClient();

  // Build the invite link origin from the request host (works in dev + prod).
  const requestHeaders = await headers();
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = requestHeaders.get("host");
  const origin = host ? `${proto}://${host}` : "";

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    { redirectTo: `${origin}/auth/callback` },
  );

  let newUserId: string;
  let attachedToExistingAccount = false;

  if (inviteError || !invited?.user) {
    const alreadyRegistered = /already|registered|exists/i.test(inviteError?.message ?? "");
    if (!alreadyRegistered) {
      return { ok: false, error: inviteError?.message ?? "Couldn't send the invite." };
    }
    const existing = await findExistingAuthUserByEmail(admin, email);
    if (!existing) {
      // Genuinely can't find the account GoTrue says exists — surface the
      // original message rather than silently pretending it worked.
      return { ok: false, error: "That email already has an account." };
    }
    newUserId = existing.id;
    attachedToExistingAccount = true;
  } else {
    newUserId = invited.user.id;
  }

  // Stamp role (+ property for property managers) BEFORE they click — the
  // callback then routes them straight to /admin (skips member linking).
  // Always a merge (patchAppMetadata), never a raw overwrite: an existing
  // account (the attachedToExistingAccount branch) already carries GoTrue's
  // own provider/providers claims, and a raw updateUserById would clobber
  // them.
  const appMetadata: Record<string, unknown> = { role: parsed.data.role };
  if (propertyId) appMetadata.property_id = propertyId;
  const { ok: stamped } = await patchAppMetadata(admin, newUserId, appMetadata);
  if (!stamped) {
    return { ok: false, error: "Invite sent, but the role couldn't be set — try again." };
  }

  const { error: rowError } = await admin.from("staff_profiles").upsert(
    {
      user_id: newUserId,
      email,
      role: parsed.data.role,
      status: "invited",
      invited_by: user.id,
    },
    { onConflict: "user_id" },
  );
  if (rowError) {
    return { ok: false, error: "Invite sent, but saving the profile failed." };
  }

  if (attachedToExistingAccount) {
    // No invite email went out — they already had an account. Use
    // "Resend invite" on their new row to hand them a fresh sign-in link.
    revalidatePath("/admin/team");
    return {
      ok: true,
      message:
        "That email already had an account (e.g. signed in with Google before). " +
        "Granted them staff access — use “Resend invite” on their row to send a sign-in link.",
    };
  }

  await recordDevAuthEmail({ source: "team_invite", type: "invite", to: email });

  revalidatePath("/admin/team");
  return { ok: true };
}

// Change a teammate's role (+ property for property managers). Stamps
// app_metadata (the auth source of truth) + staff_profiles. Can't change
// your own role. The change takes effect on the member's next JWT refresh.
export async function updateTeamMemberRole(input: {
  userId: string;
  role: string;
  propertyId?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const caller = await requireManager();
  if (!caller.ok) return { ok: false, error: caller.error };
  if (!STAFF_ROLES.includes(input.role as StaffRole)) {
    return { ok: false, error: "Pick a valid role." };
  }
  if (input.userId === caller.userId) {
    return { ok: false, error: "You can't change your own role." };
  }

  const admin = createServiceRoleClient();
  const propertyId = input.propertyId?.trim() || null;
  await patchAppMetadata(admin, input.userId, { role: input.role, property_id: propertyId });
  const { error } = await admin
    .from("staff_profiles")
    .update({ role: input.role, updated_at: new Date().toISOString() })
    .eq("user_id", input.userId);
  if (error) return { ok: false, error: "Couldn't update the role." };

  revalidatePath("/admin/team");
  return { ok: true };
}

// Deactivate (revoke portal access by clearing the role claim) or reactivate
// (restore it from staff_profiles.role). Soft + reversible; the row is kept
// for audit. Note: an already-signed-in member keeps access until their JWT
// refreshes — use Remove for an immediate cut-off.
export async function setTeamMemberActive(input: {
  userId: string;
  active: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const caller = await requireManager();
  if (!caller.ok) return { ok: false, error: caller.error };
  if (input.userId === caller.userId) {
    return { ok: false, error: "You can't change your own access." };
  }

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("staff_profiles")
    .select("role")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!profile) return { ok: false, error: "Team member not found." };

  await patchAppMetadata(admin, input.userId, {
    role: input.active ? (profile.role as string) : null,
  });
  const { error } = await admin
    .from("staff_profiles")
    .update({
      status: input.active ? "active" : "disabled",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", input.userId);
  if (error) return { ok: false, error: "Couldn't update access." };

  revalidatePath("/admin/team");
  return { ok: true };
}

// Permanently remove a teammate — deletes the auth user (their staff_profiles
// row cascades). Immediate cut-off. Can't remove yourself.
export async function removeTeamMember(input: {
  userId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const caller = await requireManager();
  if (!caller.ok) return { ok: false, error: caller.error };
  if (input.userId === caller.userId) {
    return { ok: false, error: "You can't remove your own account." };
  }

  const admin = createServiceRoleClient();
  const { error } = await admin.auth.admin.deleteUser(input.userId);
  if (error) return { ok: false, error: "Couldn't remove the team member." };

  revalidatePath("/admin/team");
  return { ok: true };
}

// Generate a fresh sign-in link for a teammate (e.g. their invite expired or
// they lost it). Returns the link for the manager to pass along — production
// can auto-email it once Resend is wired.
export async function resendTeamInvite(input: {
  userId: string;
}): Promise<{ ok: boolean; link?: string; error?: string }> {
  const caller = await requireManager();
  if (!caller.ok) return { ok: false, error: caller.error };

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("staff_profiles")
    .select("email")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!profile?.email) return { ok: false, error: "Team member not found." };

  const requestHeaders = await headers();
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = requestHeaders.get("host");
  const origin = host ? `${proto}://${host}` : "";

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: profile.email,
    options: { redirectTo: `${origin}/auth/callback` },
  });
  const link = data?.properties?.action_link;
  if (error || !link) {
    return { ok: false, error: error?.message ?? "Couldn't generate a sign-in link." };
  }

  await recordDevAuthEmail({
    source: "team_invite_resend",
    type: "magic_link",
    to: profile.email,
    actionLink: link,
  });

  return { ok: true, link };
}
