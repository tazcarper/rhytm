import { signOut } from "@/lib/auth/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  Alert,
  Badge,
  Button,
  Card,
  Eyebrow,
  Heading,
  PageShell,
} from "@/lib/ui";

export const dynamic = "force-dynamic";

// Member portal stub. Shows every membership the signed-in person is
// authorized on, with their role on each, plus the other people on
// each membership (household members — spouse, dependents, etc.).
//
// Query shape:
//   membership_people (mine, active)
//     → memberships (the account)
//        → properties (display name)
//        → membership_people (everyone on this membership)
//             → people (their identity)
//
// RLS guarantees:
//   - I see my own active junction rows (membership_people member-read)
//   - I see those memberships (memberships member-read)
//   - I see ALL active junctions on those memberships (same policy —
//     the household visibility on membership_people is broad enough)
//   - I see the people rows for everyone on my memberships
//     (people: member read household — set by the household RLS migration)
export default async function MemberHome() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: mine, error } = await supabase
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

  return (
    <PageShell width="narrow">
      <Eyebrow as="div" className="mb-2">
        Member
      </Eyebrow>
      <Heading level={1} size="h1" underline>
        Welcome <em>back</em>
      </Heading>
      <div className="flex items-center justify-between flex-wrap gap-4 mt-4">
        <p className="text-gray m-0 font-serif italic text-[18px]">
          Signed in as <strong className="text-olive">{user?.email}</strong>{" "}
          &middot; role:{" "}
          <code className="font-mono not-italic text-[0.85em]">
            {(user?.app_metadata?.role as string | undefined) ?? "—"}
          </code>
        </p>
        <form action={signOut}>
          <Button type="submit" variant="secondary" size="sm">
            Sign out
          </Button>
        </form>
      </div>

      <div className="mt-12">
        <Eyebrow as="div" className="mb-2">
          Your memberships
        </Eyebrow>
        <Heading level={2} size="h3" underline>
          Where you belong
        </Heading>
      </div>

      {error && (
        <div className="mt-6">
          <Alert variant="error" title="Could not load memberships">
            {error.message}
          </Alert>
        </div>
      )}

      {mine && mine.length === 0 && (
        <p className="text-gray font-serif italic mt-6">
          No memberships are linked to this account yet.
        </p>
      )}

      {mine && mine.length > 0 && (
        <div className="flex flex-col gap-4 mt-6">
          {mine.map((row) => {
            const membership = pickOne(row.memberships);
            if (!membership) return null;
            const property = pickOne(membership.properties);

            const householdJunctions = (membership.membership_people ?? [])
              .filter((j) => j.status === "active");
            const otherHousehold = householdJunctions.filter((j) => {
              const p = pickOne(j.people);
              return p && p.email !== user?.email;
            });

            return (
              <Card key={row.id} padding="loose">
                <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
                  <Heading level={3} size="h3">
                    {property?.name ?? "—"}
                  </Heading>
                  {membership.membership_tier && (
                    <Badge pill variant="tierMember">
                      {membership.membership_tier}
                    </Badge>
                  )}
                </div>
                <div className="font-sans text-[13px] text-gray tracking-[0.5px]">
                  Member{" "}
                  <code className="font-mono text-olive">
                    #{membership.member_number}
                  </code>
                  {" · "}
                  {membership.status}
                  {" · "}
                  your role: <em className="text-tan-deep">{row.role}</em>
                </div>

                {otherHousehold.length > 0 && (
                  <div className="mt-5 pt-5 border-t border-rule">
                    <Eyebrow as="div" className="mb-2">
                      Also on this membership
                    </Eyebrow>
                    <ul className="m-0 pl-5 text-[14px] text-olive">
                      {otherHousehold.map((j) => {
                        const p = pickOne(j.people);
                        if (!p) return null;
                        return (
                          <li key={j.role + p.email}>
                            {p.first_name} {p.last_name}{" "}
                            <code className="font-mono text-gray text-[0.85em]">
                              ({p.email})
                            </code>{" "}
                            &middot; <em className="text-tan-deep">{j.role}</em>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {otherHousehold.length === 0 && (
                  <p className="mt-4 font-serif italic text-[14px] text-gray">
                    You are the only person on this membership.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}

// Supabase's PostgREST embeds can come back as either a single object
// or an array depending on the FK shape. Normalize.
function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}
