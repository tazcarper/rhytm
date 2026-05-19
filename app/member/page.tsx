import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  Alert,
  Badge,
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
      <Eyebrow as="div" style={{ marginBottom: "0.5rem" }}>
        Member
      </Eyebrow>
      <Heading level={1} size="h1" underline>
        Welcome <em>back</em>
      </Heading>
      <p
        style={{
          color: "var(--gray)",
          marginTop: "1rem",
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: 18,
        }}
      >
        Signed in as <strong style={{ color: "var(--olive)" }}>{user?.email}</strong>{" "}
        &middot; role:{" "}
        <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontStyle: "normal", fontSize: "0.85em" }}>
          {(user?.app_metadata?.role as string | undefined) ?? "—"}
        </code>
      </p>

      <div style={{ marginTop: "3rem" }}>
        <Eyebrow as="div" style={{ marginBottom: "0.5rem" }}>
          Your memberships
        </Eyebrow>
        <Heading level={2} size="h3" underline>
          Where you belong
        </Heading>
      </div>

      {error && (
        <div style={{ marginTop: "1.5rem" }}>
          <Alert variant="error" title="Could not load memberships">
            {error.message}
          </Alert>
        </div>
      )}

      {mine && mine.length === 0 && (
        <p
          style={{
            color: "var(--gray)",
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            marginTop: "1.5rem",
          }}
        >
          No memberships are linked to this account yet.
        </p>
      )}

      {mine && mine.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            marginTop: "1.5rem",
          }}
        >
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <Heading level={3} size="h3">
                    {property?.name ?? "—"}
                  </Heading>
                  {membership.membership_tier && (
                    <Badge pill variant="tierMember">
                      {membership.membership_tier}
                    </Badge>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: "var(--sans)",
                    fontSize: 13,
                    color: "var(--gray)",
                    letterSpacing: "0.5px",
                  }}
                >
                  Member <code style={{ fontFamily: "ui-monospace, Menlo, monospace", color: "var(--olive)" }}>#{membership.member_number}</code>
                  {" · "}
                  {membership.status}
                  {" · "}
                  your role: <em style={{ color: "var(--tan-deep)" }}>{row.role}</em>
                </div>

                {otherHousehold.length > 0 && (
                  <div
                    style={{
                      marginTop: "1.25rem",
                      paddingTop: "1.25rem",
                      borderTop: "1px solid var(--border)",
                    }}
                  >
                    <Eyebrow as="div" style={{ marginBottom: "0.5rem" }}>
                      Also on this membership
                    </Eyebrow>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: "1.25rem",
                        fontSize: 14,
                        color: "var(--olive)",
                      }}
                    >
                      {otherHousehold.map((j) => {
                        const p = pickOne(j.people);
                        if (!p) return null;
                        return (
                          <li key={j.role + p.email}>
                            {p.first_name} {p.last_name}{" "}
                            <code style={{ fontFamily: "ui-monospace, Menlo, monospace", color: "var(--gray)", fontSize: "0.85em" }}>
                              ({p.email})
                            </code>{" "}
                            &middot;{" "}
                            <em style={{ color: "var(--tan-deep)" }}>
                              {j.role}
                            </em>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {otherHousehold.length === 0 && (
                  <p
                    style={{
                      marginTop: "1rem",
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 14,
                      color: "var(--gray)",
                    }}
                  >
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
