"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  clearDevAuthCookie,
  requireDevAuth,
  setDevAuthCookie,
} from "@/lib/dev/auth";

// FormData.get returns string | File | null. Casting to `string` lies
// to the type system and would crash at `.trim()` if a File were ever
// sent. This narrows safely and trims in one step.
function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

// Multi-valued form fields (checkbox groups, <select multiple>). Drops
// non-string entries and empties.
function fieldList(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

type AdminClient = ReturnType<typeof createServiceRoleClient>;

async function findAuthUserByEmail(admin: AdminClient, email: string) {
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) throw new Error(error.message);
  return data?.users.find((user) => user.email?.toLowerCase() === email) ?? null;
}

// ─────────────────────────────────────────────────────────────
// Gate
// ─────────────────────────────────────────────────────────────

export async function authenticate(formData: FormData) {
  const passwordField = formData.get("password");
  const password = typeof passwordField === "string" ? passwordField : "";
  if (password.length === 0) {
    redirect("/dev/login?error=missing");
  }

  const ok = await setDevAuthCookie(password);
  if (!ok) {
    redirect("/dev/login?error=invalid");
  }
  redirect("/dev");
}

export async function logoutDev() {
  await clearDevAuthCookie();
  redirect("/dev/login");
}

// ─────────────────────────────────────────────────────────────
// Supabase Auth — current user
// ─────────────────────────────────────────────────────────────

export async function signOutUser() {
  await requireDevAuth();
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/dev");
}

// ─────────────────────────────────────────────────────────────
// Seed: create person + memberships + junction
// ─────────────────────────────────────────────────────────────

const INVITE_TTL_DAYS = 7;

// Creates a `people` row (the human) AND a `memberships` row per
// selected property AND a `membership_people` junction row binding
// the person to each membership as `primary`. This mirrors what the
// Excel roster import + Inngest seed-member-invites flow will do in
// production: one person, N memberships, one primary on each.
export async function createTestMember(formData: FormData) {
  await requireDevAuth();

  const email = field(formData, "email").toLowerCase();
  const propertyIds = fieldList(formData, "property_ids");
  const memberNumber = field(formData, "member_number");
  const firstName = field(formData, "first_name") || "Test";
  const lastName = field(formData, "last_name") || "Person";

  if (!email || propertyIds.length === 0 || !memberNumber) {
    redirect("/dev?error=missing+required+fields");
  }

  const admin = createServiceRoleClient();
  const expires = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Step 1: insert the person.
  const { data: person, error: personError } = await admin
    .from("people")
    .insert({
      email,
      first_name: firstName,
      last_name: lastName,
      invited_at: null,
      invite_expires_at: expires,
    })
    .select("id")
    .single();

  if (personError) {
    redirect(`/dev?error=${encodeURIComponent(personError.message)}`);
  }

  // Step 2: insert one membership per selected property. Each gets the
  // same member_number — fine, since UNIQUE is per (property_id,
  // member_number) not global.
  const membershipsToInsert = propertyIds.map((property_id) => ({
    property_id,
    member_number: memberNumber,
    status: "active" as const,
  }));

  const { data: memberships, error: membershipError } = await admin
    .from("memberships")
    .insert(membershipsToInsert)
    .select("id");

  if (membershipError) {
    // Roll back the people row so this isn't half-applied.
    await admin.from("people").delete().eq("id", person!.id);
    redirect(`/dev?error=${encodeURIComponent(membershipError.message)}`);
  }

  // Step 3: junction — primary role on every new membership.
  const junctionRows = (memberships ?? []).map((membership) => ({
    membership_id: membership.id,
    person_id: person!.id,
    role: "primary" as const,
    status: "active" as const,
  }));

  const { error: junctionError } = await admin
    .from("membership_people")
    .insert(junctionRows);

  if (junctionError) {
    // Roll back person + memberships. Junction is cascade-deleted by
    // the FK ON DELETE so we don't need to clean it up explicitly.
    await admin
      .from("memberships")
      .delete()
      .in(
        "id",
        (memberships ?? []).map((membership) => membership.id),
      );
    await admin.from("people").delete().eq("id", person!.id);
    redirect(`/dev?error=${encodeURIComponent(junctionError.message)}`);
  }

  revalidatePath("/dev");
  redirect(
    `/dev?ok=created+person+%2B+${memberships?.length ?? 0}+membership(s)`,
  );
}

// Add a second person (e.g., spouse) to an existing membership. Tests
// the household-sharing scenario.
export async function addAuthorizedPerson(formData: FormData) {
  await requireDevAuth();

  const email = field(formData, "email").toLowerCase();
  const membershipId = field(formData, "membership_id");
  const role = field(formData, "role") || "authorized";
  const firstName = field(formData, "first_name") || "Test";
  const lastName = field(formData, "last_name") || "Person";

  if (!email || !membershipId) {
    redirect("/dev?error=missing+required+fields");
  }
  if (!["spouse", "dependent", "authorized"].includes(role)) {
    redirect("/dev?error=invalid+role+for+authorized+person");
  }

  const admin = createServiceRoleClient();
  const expires = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Check if person already exists for this email (e.g., already on
  // another membership). If yes, reuse them. If no, create.
  const { data: existing, error: lookupError } = await admin
    .from("people")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (lookupError) {
    redirect(`/dev?error=${encodeURIComponent(lookupError.message)}`);
  }

  let personId: string;
  if (existing) {
    personId = existing.id;
  } else {
    const { data: person, error: createError } = await admin
      .from("people")
      .insert({
        email,
        first_name: firstName,
        last_name: lastName,
        invited_at: null,
        invite_expires_at: expires,
      })
      .select("id")
      .single();

    if (createError) {
      redirect(`/dev?error=${encodeURIComponent(createError.message)}`);
    }
    personId = person!.id;
  }

  const { error: junctionError } = await admin
    .from("membership_people")
    .insert({
      membership_id: membershipId,
      person_id: personId,
      role,
      status: "active",
    });

  if (junctionError) {
    redirect(`/dev?error=${encodeURIComponent(junctionError.message)}`);
  }

  revalidatePath("/dev");
  redirect("/dev?ok=authorized+person+added");
}

// ─────────────────────────────────────────────────────────────
// Auth-flow: send invite OR generate link
// ─────────────────────────────────────────────────────────────

function deriveOrigin(h: Headers): string {
  const host = h.get("host");
  if (!host) {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  }
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function sendInvite(formData: FormData) {
  await requireDevAuth();

  const email = field(formData, "email").toLowerCase();
  if (!email) {
    redirect("/dev?error=missing+email");
  }

  const origin = deriveOrigin(await headers());
  const admin = createServiceRoleClient();
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    { redirectTo: `${origin}/auth/callback` },
  );

  if (inviteError) {
    redirect(`/dev?error=${encodeURIComponent(inviteError.message)}`);
  }

  // Stamp invited_at / invite_expires_at on the person row if it
  // exists and isn't linked. Mirrors what production Inngest will do.
  const expires = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  await admin
    .from("people")
    .update({
      invited_at: new Date().toISOString(),
      invite_expires_at: expires,
    })
    .eq("email", email)
    .is("user_id", null);

  revalidatePath("/dev");
  redirect("/dev?ok=invite+sent");
}

export async function generateMagicLink(formData: FormData) {
  await requireDevAuth();

  const email = field(formData, "email").toLowerCase();
  if (!email) {
    redirect("/dev?error=missing+email");
  }

  const origin = deriveOrigin(await headers());
  const admin = createServiceRoleClient();

  let existing;
  try {
    existing = await findAuthUserByEmail(admin, email);
  } catch (error) {
    redirect(`/dev?error=${encodeURIComponent((error as Error).message)}`);
  }
  const linkType: "invite" | "magiclink" = existing ? "magiclink" : "invite";

  const { data, error } = await admin.auth.admin.generateLink({
    type: linkType,
    email,
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    redirect(`/dev?error=${encodeURIComponent(error.message)}`);
  }

  const tokenHash = data?.properties?.hashed_token;
  if (!tokenHash) {
    redirect("/dev?error=no+hashed_token+in+response");
  }

  // Stamp invited_at / invite_expires_at on the people row (only when
  // this is a fresh invite — magiclink retries don't need it).
  if (linkType === "invite") {
    const expires = new Date(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    await admin
      .from("people")
      .update({
        invited_at: new Date().toISOString(),
        invite_expires_at: expires,
      })
      .eq("email", email)
      .is("user_id", null);
  }

  const link = `${origin}/auth/callback?token_hash=${tokenHash}&type=${linkType}`;

  revalidatePath("/dev");
  redirect(
    `/dev?ok=${linkType}+link+generated&link=${encodeURIComponent(link)}`,
  );
}

export async function forceExpireInvite(formData: FormData) {
  await requireDevAuth();

  const email = field(formData, "email").toLowerCase();
  if (!email) {
    redirect("/dev?error=missing+email");
  }

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("people")
    .update({ invite_expires_at: "2000-01-01T00:00:00Z" })
    .eq("email", email)
    .is("user_id", null);

  if (error) {
    redirect(`/dev?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dev");
  redirect("/dev?ok=invite+expired");
}

// ─────────────────────────────────────────────────────────────
// app_metadata role stamping
// ─────────────────────────────────────────────────────────────

const VALID_ROLES = new Set([
  "super_admin",
  "admin",
  "property_manager",
  "concierge",
  "membership_coordinator",
  "member",
  "partner",
]);

export async function stampRole(formData: FormData) {
  await requireDevAuth();

  const email = field(formData, "email").toLowerCase();
  const role = field(formData, "role");
  const propertyId = field(formData, "property_id") || null;
  const partnerOrgId = field(formData, "partner_org_id") || null;

  if (!email || !VALID_ROLES.has(role)) {
    redirect("/dev?error=missing+or+invalid+role");
  }

  const admin = createServiceRoleClient();

  let user;
  try {
    user = await findAuthUserByEmail(admin, email);
  } catch (error) {
    redirect(`/dev?error=${encodeURIComponent((error as Error).message)}`);
  }
  if (!user) {
    redirect(`/dev?error=no+auth+user+for+${encodeURIComponent(email)}`);
  }

  const app_metadata: Record<string, unknown> = { role };
  if (propertyId) app_metadata.property_id = propertyId;
  if (partnerOrgId) app_metadata.partner_org_id = partnerOrgId;

  const { error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata,
  });
  if (error) {
    redirect(`/dev?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dev");
  redirect("/dev?ok=role+stamped");
}

// ─────────────────────────────────────────────────────────────
// Reset — delete person + their memberships + auth user
// ─────────────────────────────────────────────────────────────
//
// Cascade order: junction → memberships → people → auth.users. The
// memberships drop their junction rows via ON DELETE CASCADE. People
// only get dropped if they have no remaining junction rows — but
// since this reset is "wipe everything for an email," we drop the
// junction and memberships first, then the person, then auth.users.

export async function resetTestUser(formData: FormData) {
  await requireDevAuth();

  const email = field(formData, "email").toLowerCase();
  if (!email) {
    redirect("/dev?error=missing+email");
  }

  const admin = createServiceRoleClient();

  // Find the person row.
  const { data: person, error: lookupError } = await admin
    .from("people")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (lookupError) {
    redirect(`/dev?error=${encodeURIComponent(lookupError.message)}`);
  }

  if (person) {
    // Find every membership where this person is the *primary*.
    // Those memberships are "owned" by them and get dropped wholesale.
    // Junction rows where they're spouse/dependent/authorized just get
    // removed from the junction (the membership lives on for others).
    const { data: primaryMemberships } = await admin
      .from("membership_people")
      .select("membership_id")
      .eq("person_id", person.id)
      .eq("role", "primary");

    const primaryMembershipIds = (primaryMemberships ?? []).map(
      (row) => row.membership_id,
    );

    // Drop memberships where they were primary (cascades junction).
    if (primaryMembershipIds.length > 0) {
      await admin
        .from("memberships")
        .delete()
        .in("id", primaryMembershipIds);
    }

    // Drop any junction rows where they were non-primary on other
    // memberships (those memberships are kept for other people on them).
    await admin
      .from("membership_people")
      .delete()
      .eq("person_id", person.id);

    // Finally drop the people row.
    const { error: delPersonError } = await admin
      .from("people")
      .delete()
      .eq("id", person.id);
    if (delPersonError) {
      redirect(
        `/dev?error=${encodeURIComponent(delPersonError.message)}`,
      );
    }
  }

  // Drop the auth user too (if it exists).
  let user;
  try {
    user = await findAuthUserByEmail(admin, email);
  } catch (error) {
    redirect(`/dev?error=${encodeURIComponent((error as Error).message)}`);
  }
  if (user) {
    const { error: delUserError } = await admin.auth.admin.deleteUser(user.id);
    if (delUserError) {
      redirect(`/dev?error=${encodeURIComponent(delUserError.message)}`);
    }
  }

  revalidatePath("/dev");
  redirect("/dev?ok=user+reset");
}

// ─────────────────────────────────────────────────────────────
// Seed: test adventure (RSVP capacity / waitlist testing)
// ─────────────────────────────────────────────────────────────
//
// The placeholder-seed migration covers every *visual* state, but the
// capacity-race / sold-out-flip path (scenario I4) needs an adventure
// with a controlled small capacity. This inserts one published
// member_adventures row via the service role. Tagged
// details.placeholder=true (so the bulk cleanup catches it) plus
// details.devTest=true. No capacityLabel override — that way, once the
// confirmed RSVPs fill the cap, the sync trigger flips status→sold_out
// and the card visibly becomes "Waitlist Only" on the next load.

export async function createTestAdventure(formData: FormData) {
  await requireDevAuth();

  const propertyId = field(formData, "property_id");
  if (!propertyId) {
    redirect("/dev?error=missing+property");
  }

  const title = field(formData, "title") || "DEV Test Adventure";

  const capacityRaw = parseInt(field(formData, "max_capacity"), 10);
  const maxCapacity =
    Number.isFinite(capacityRaw) && capacityRaw > 0 ? capacityRaw : 1;

  // max_guests_per_rsvp must satisfy the CHECK (<= max_capacity). Clamp.
  const guestsRaw = parseInt(field(formData, "max_guests_per_rsvp"), 10);
  const requestedGuests =
    Number.isFinite(guestsRaw) && guestsRaw > 0 ? guestsRaw : maxCapacity;
  const maxGuests = Math.max(1, Math.min(requestedGuests, maxCapacity));

  const priceRaw = parseFloat(field(formData, "price"));
  const price = Number.isFinite(priceRaw) && priceRaw >= 0 ? priceRaw : 0;

  const dayMs = 24 * 60 * 60 * 1000;
  const toDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const startMs = Date.now() + 30 * dayMs;

  const admin = createServiceRoleClient();
  const { error } = await admin.from("member_adventures").insert({
    property_id: propertyId,
    title,
    description: "Dev-only adventure for RSVP capacity / waitlist testing.",
    start_date: toDate(startMs),
    end_date: toDate(startMs + 2 * dayMs),
    max_capacity: maxCapacity,
    max_guests_per_rsvp: maxGuests,
    price,
    status: "published",
    details: { placeholder: true, devTest: true, category: "Dev" },
  });

  if (error) {
    redirect(`/dev?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dev");
  redirect(
    `/dev?ok=test+adventure+created+(cap+${maxCapacity}%2C+max+party+${maxGuests})`,
  );
}
