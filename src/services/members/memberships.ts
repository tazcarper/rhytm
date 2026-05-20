import type { SupabaseClient } from "@supabase/supabase-js";

// Domain shape returned to the member portal — already normalized
// out of PostgREST's array-or-object embed quirks and stripped of
// the current user from the household list. Consumers (components,
// tests) work against this shape, never against raw query output.

export interface HouseholdMember {
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

export interface MembershipForMember {
  id: string;
  memberNumber: string;
  membershipTier: string | null;
  status: string;
  myRole: string;
  property: { name: string; slug: string } | null;
  household: HouseholdMember[];
}

export interface GetMyMembershipsResult {
  data: MembershipForMember[] | null;
  error: { message: string } | null;
}

// PostgREST embeds come back as a single object or a one-element array
// depending on the FK shape. Normalize to "one object or null" so the
// rest of the service doesn't branch on it.
function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

// Fetches every active membership the signed-in person is on, with the
// other (active) household members alongside each one. RLS enforces
// scope — this query trusts that policies have already filtered rows
// to what the caller is allowed to see. The service's job is just to
// reshape the response into the domain model above.
export async function getMyMemberships(
  supabase: SupabaseClient,
  currentUserEmail: string | null,
): Promise<GetMyMembershipsResult> {
  const { data, error } = await supabase
    .from("membership_people")
    .select(
      `id, role, status,
       memberships(
         id, member_number, membership_tier, status,
         properties(name, slug),
         membership_people(role, status, people(id, email, first_name, last_name))
       )`,
    )
    .eq("status", "active");

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  const normalized: MembershipForMember[] = (data ?? []).flatMap((row) => {
    const m = pickOne(row.memberships);
    if (!m) return [];
    const property = pickOne(m.properties);

    const household: HouseholdMember[] = (m.membership_people ?? [])
      .filter((j) => j.status === "active")
      .map((j): HouseholdMember | null => {
        const p = pickOne(j.people);
        if (!p) return null;
        return {
          email: p.email,
          firstName: p.first_name,
          lastName: p.last_name,
          role: j.role,
        };
      })
      .filter(
        (h): h is HouseholdMember =>
          h !== null && h.email !== currentUserEmail,
      );

    return [
      {
        id: row.id,
        memberNumber: m.member_number,
        membershipTier: m.membership_tier,
        status: m.status,
        myRole: row.role,
        property: property
          ? { name: property.name, slug: property.slug }
          : null,
        household,
      },
    ];
  });

  return { data: normalized, error: null };
}
