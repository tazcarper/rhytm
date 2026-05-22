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
function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
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
    const membership = pickOne(row.memberships);
    if (!membership) return [];
    const property = pickOne(membership.properties);

    const household: HouseholdMember[] = (membership.membership_people ?? [])
      .filter((junction) => junction.status === "active")
      .map((junction): HouseholdMember | null => {
        const person = pickOne(junction.people);
        if (!person) return null;
        return {
          email: person.email,
          firstName: person.first_name,
          lastName: person.last_name,
          role: junction.role,
        };
      })
      .filter(
        (householdMember): householdMember is HouseholdMember =>
          householdMember !== null &&
          householdMember.email !== currentUserEmail,
      );

    return [
      {
        id: row.id,
        memberNumber: membership.member_number,
        membershipTier: membership.membership_tier,
        status: membership.status,
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
