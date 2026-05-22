import { requireDevAuth } from "@/lib/dev/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  Alert,
  Badge,
  Button,
  Card,
  Eyebrow,
  FormField,
  Heading,
  Input,
  PageShell,
} from "@/lib/ui";
import {
  addAuthorizedPerson,
  createTestMember,
  forceExpireInvite,
  generateMagicLink,
  logoutDev,
  resetTestUser,
  sendInvite,
  signOutUser,
  stampRole,
} from "./actions";
import { MembershipPicker } from "./membership-picker";
import s from "./dev.module.css";

export const dynamic = "force-dynamic";

const ROLES = [
  "super_admin",
  "admin",
  "property_manager",
  "concierge",
  "membership_coordinator",
  "member",
  "partner",
];

export default async function DevDashboard({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; link?: string }>;
}) {
  await requireDevAuth();

  const { ok, error, link } = await searchParams;

  const supabase = await createServerSupabaseClient();
  const admin = createServiceRoleClient();

  const [
    {
      data: { user },
    },
    { data: properties },
    { data: junction },
    { data: allMemberships },
  ] = await Promise.all([
    supabase.auth.getUser(),
    admin.from("properties").select("id, name, slug").order("name"),
    admin
      .from("membership_people")
      .select(
        `id, role, status,
         people(id, email, user_id, invited_at, invite_accepted_at, invite_expires_at, created_at),
         memberships(id, member_number, status, property_id, properties(name))`,
      )
      .order("created_at", { ascending: false })
      .limit(30),
    admin
      .from("memberships")
      .select("id, member_number, property_id, properties(name)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <PageShell width="wide">
      <header className={s.header}>
        <Eyebrow variant="crest" as="div">
          Internal Tool
        </Eyebrow>
        <Heading level={1} size="h1" underline center>
          Developer <em>Dashboard</em>
        </Heading>
        <p className={s.headerSubtitle}>
          Temporary scaffolding for testing the auth flow against the
          live Supabase project. Removed before launch — the entire{" "}
          <code>/dev</code> tree.
        </p>
      </header>

      {ok && (
        <Alert variant="success" title="Done">
          {ok}
        </Alert>
      )}
      {error && (
        <Alert variant="error" title="Action failed">
          {error}
        </Alert>
      )}
      {link && (
        <Alert variant="info" title="Magic link generated">
          <p>
            Single-use. Opens the sign-in flow when clicked. Use the same
            browser you're testing in.
          </p>
          <p>
            <a className={s.linkOut} href={link}>
              {link}
            </a>
          </p>
        </Alert>
      )}

      <Card warm padding="loose" className={`${s.note} mb-8`}>
        <Eyebrow as="div" className="mb-3">
          Schema model
        </Eyebrow>
        <p className="mt-0">
          A <code>people</code> row is a human (email + auth account). A{" "}
          <code>memberships</code> row is a club account (member number,
          tier, dues) scoped to one property. A{" "}
          <code>membership_people</code> junction row binds a person to a
          membership with a role (<em>primary</em> / <em>spouse</em> /{" "}
          <em>dependent</em> / <em>authorized</em>). One membership can have
          multiple authorized people (household). One person can be on
          multiple memberships (cross-property).
        </p>
        <Eyebrow as="div" className="mt-6 mb-2">
          Recommended workflow
        </Eyebrow>
        <ol>
          <li>
            <strong>Create person + membership(s)</strong> — seeds a person
            and a membership at each checked property, with that person as
            primary.
          </li>
          <li>
            <strong>(Optional) Add authorized person</strong> — for
            household testing. Adds a spouse / dependent to an existing
            membership.
          </li>
          <li>
            <strong>Generate magic-link URL</strong> — for each email you
            want to test as. Creates the auth user if new; returns a
            one-click link at the top of this page.
          </li>
          <li>
            <strong>Click that link</strong> — runs <code>/auth/callback</code>
            , links the person to their auth user, stamps role, lands them
            on <code>/member</code>.
          </li>
        </ol>
        <p>
          Use <strong>Reset test user</strong> to wipe a person, their
          memberships (where they're primary), their junction rows, and
          their <code>auth.users</code> row.
        </p>
      </Card>

      <DevSection eyebrow="01" title="Current session">
        <Card padding="loose">
          {user ? (
            <div className={s.sessionRow}>
              <p className="m-0">
                Signed in as <strong>{user.email}</strong>{" "}
                <code>({user.id})</code>
              </p>
              <Eyebrow as="div">app_metadata</Eyebrow>
              <pre className={s.pre}>
                {JSON.stringify(user.app_metadata, null, 2)}
              </pre>
              <div className={s.actions}>
                <form action={signOutUser}>
                  <Button variant="secondary" size="sm" type="submit">
                    Sign out of Supabase
                  </Button>
                </form>
                <form action={logoutDev}>
                  <Button variant="ghost" size="sm" type="submit">
                    Exit dev dashboard
                  </Button>
                </form>
              </div>
            </div>
          ) : (
            <div className={s.sessionRow}>
              <p className="m-0 text-gray">
                No Supabase session. Generate a link below to sign in.
              </p>
              <div className={s.actions}>
                <form action={logoutDev}>
                  <Button variant="ghost" size="sm" type="submit">
                    Exit dev dashboard
                  </Button>
                </form>
              </div>
            </div>
          )}
        </Card>
      </DevSection>

      <DevSection
        eyebrow="02"
        title="Create person + membership(s)"
        description={
          <>
            Inserts one <code>people</code> row and one{" "}
            <code>memberships</code> row per selected property, plus the
            junction rows binding the person as <em>primary</em> on each
            membership.
          </>
        }
      >
        <Card padding="loose">
          <form action={createTestMember} className={s.formStack}>
            <FormField label="Email" required>
              {(p) => <Input {...p} name="email" type="email" required />}
            </FormField>

            <fieldset className={s.fieldset}>
              <legend>Properties (select one or more)</legend>
              {properties?.map((p) => (
                <label key={p.id} className={s.checkRow}>
                  <input type="checkbox" name="property_ids" value={p.id} />
                  {p.name}
                </label>
              ))}
            </fieldset>

            <FormField
              label="Member number"
              helper="Reused across selected properties."
              required
            >
              {(p) => (
                <Input
                  {...p}
                  name="member_number"
                  required
                  placeholder="TEST-0001"
                />
              )}
            </FormField>

            <FormField label="First name">
              {(p) => <Input {...p} name="first_name" placeholder="Test" />}
            </FormField>

            <FormField label="Last name">
              {(p) => <Input {...p} name="last_name" placeholder="Person" />}
            </FormField>

            <div className={s.actions}>
              <Button type="submit" variant="primary" size="sm">
                Create person + membership(s)
              </Button>
            </div>
          </form>
        </Card>
      </DevSection>

      <DevSection
        eyebrow="03"
        title="Add authorized person to existing membership"
        description={
          <>
            Household test. Adds a second person (spouse / dependent /
            authorized user) to a membership that already has a primary. If
            a <code>people</code> row already exists for the email (e.g.,
            they're on another membership) it's reused; otherwise created
            fresh. Type the member number to narrow the dropdown.
          </>
        }
      >
        <Card padding="loose">
          <form action={addAuthorizedPerson} className={s.formStack}>
            <FormField label="Email" required>
              {(p) => <Input {...p} name="email" type="email" required />}
            </FormField>

            <MembershipPicker memberships={allMemberships ?? []} />

            <FormField label="Role">
              {(p) => (
                <select
                  {...p}
                  name="role"
                  defaultValue="spouse"
                  className={s.select}
                >
                  <option value="spouse">spouse</option>
                  <option value="dependent">dependent</option>
                  <option value="authorized">authorized</option>
                </select>
              )}
            </FormField>

            <FormField label="First name">
              {(p) => <Input {...p} name="first_name" />}
            </FormField>
            <FormField label="Last name">
              {(p) => <Input {...p} name="last_name" />}
            </FormField>

            <div className={s.actions}>
              <Button type="submit" variant="primary" size="sm">
                Add authorized person
              </Button>
            </div>
          </form>
        </Card>
      </DevSection>

      <DevSection
        eyebrow="04"
        title="Send magic-link invite (email)"
        description={
          <>
            Calls <code>supabaseAdmin.auth.admin.inviteUserByEmail()</code>{" "}
            with <code>redirectTo</code> set to the current host's{" "}
            <code>/auth/callback</code>. Subject to Supabase's email rate
            limit (~3–4/hour on the built-in mailer). For fast iteration
            use the no-email generator below.
          </>
        }
      >
        <Card padding="loose">
          <form action={sendInvite} className={s.formStack}>
            <FormField label="Email" required>
              {(p) => <Input {...p} name="email" type="email" required />}
            </FormField>
            <div className={s.actions}>
              <Button type="submit" variant="primary" size="sm">
                Send invite
              </Button>
            </div>
          </form>
        </Card>
      </DevSection>

      <DevSection
        eyebrow="05"
        title="Generate magic-link URL (no email)"
        description={
          <>
            Calls{" "}
            <code>
              supabaseAdmin.auth.admin.generateLink({"{ type: ... }"})
            </code>{" "}
            (auto-picking <code>invite</code> for new emails or{" "}
            <code>magiclink</code> for existing auth users) and constructs
            the callback URL from the returned <code>hashed_token</code>. The
            link is rendered at the top of this page — click it to complete
            sign-in.
          </>
        }
      >
        <Card padding="loose">
          <form action={generateMagicLink} className={s.formStack}>
            <FormField label="Email" required>
              {(p) => <Input {...p} name="email" type="email" required />}
            </FormField>
            <div className={s.actions}>
              <Button type="submit" variant="primary" size="sm">
                Generate link
              </Button>
            </div>
          </form>
        </Card>
      </DevSection>

      <DevSection
        eyebrow="06"
        title="Force-expire invite"
        description={
          <>
            Sets <code>invite_expires_at = 2000-01-01</code> on the people
            row (if unlinked) so the next magic-link click hits the
            expired-invite path.
          </>
        }
      >
        <Card padding="loose">
          <form action={forceExpireInvite} className={s.formStack}>
            <FormField label="Email" required>
              {(p) => <Input {...p} name="email" type="email" required />}
            </FormField>
            <div className={s.actions}>
              <Button type="submit" variant="secondary" size="sm">
                Expire invite
              </Button>
            </div>
          </form>
        </Card>
      </DevSection>

      <DevSection
        eyebrow="07"
        title="Stamp app_metadata role"
        description={
          <>
            Directly sets <code>app_metadata</code> on an existing auth
            user. Lets you test <code>/admin</code> and{" "}
            <code>/partner</code> bounces without setting up real staff /
            partner accounts.
          </>
        }
      >
        <Card padding="loose">
          <form action={stampRole} className={s.formStack}>
            <FormField label="Email" required>
              {(p) => <Input {...p} name="email" type="email" required />}
            </FormField>

            <FormField label="Role" required>
              {(p) => (
                <select {...p} name="role" required className={s.select}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              label="Property"
              helper="Required for property_manager / partner."
            >
              {(p) => (
                <select {...p} name="property_id" className={s.select}>
                  <option value="">— none —</option>
                  {properties?.map((prop) => (
                    <option key={prop.id} value={prop.id}>
                      {prop.name}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              label="Partner org ID"
              helper="Required for partner — UUID of a partner_organizations row."
            >
              {(p) => (
                <Input {...p} name="partner_org_id" placeholder="UUID" />
              )}
            </FormField>

            <div className={s.actions}>
              <Button type="submit" variant="primary" size="sm">
                Stamp role
              </Button>
            </div>
          </form>
        </Card>
      </DevSection>

      <DevSection
        eyebrow="08"
        title="Reset test user"
        description={
          <>
            Deletes the <code>people</code> row for this email, every{" "}
            <code>memberships</code> row where they were primary, every
            junction row that touched them, and the corresponding{" "}
            <code>auth.users</code> row. Memberships where they were only a
            spouse / authorized are kept (they're just removed from the
            junction).
          </>
        }
      >
        <Card padding="loose">
          <form action={resetTestUser} className={s.formStack}>
            <FormField label="Email" required>
              {(p) => <Input {...p} name="email" type="email" required />}
            </FormField>
            <div className={s.actions}>
              <Button type="submit" variant="secondary" size="sm">
                Delete person + memberships + auth user
              </Button>
            </div>
          </form>
        </Card>
      </DevSection>

      <DevSection
        eyebrow="09"
        title="Recent membership_people rows (latest 30)"
        description="One row per junction entry. A single person on multiple memberships shows multiple rows, sharing the same email."
      >
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Linked?</th>
                <th>Property</th>
                <th>Member #</th>
                <th>Role</th>
                <th>Invited</th>
                <th>Accepted</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {junction?.map((j) => {
                const person = Array.isArray(j.people) ? j.people[0] : j.people;
                const membership = Array.isArray(j.memberships)
                  ? j.memberships[0]
                  : j.memberships;
                const property = membership
                  ? Array.isArray(membership.properties)
                    ? membership.properties[0]
                    : membership.properties
                  : null;
                return (
                  <tr key={j.id}>
                    <td>{person?.email ?? "—"}</td>
                    <td>
                      {person?.user_id ? (
                        <Badge variant="open">Yes</Badge>
                      ) : (
                        <Badge variant="draft">Pending</Badge>
                      )}
                    </td>
                    <td>{property?.name ?? "—"}</td>
                    <td>
                      <code className={s.code}>
                        {membership?.member_number ?? "—"}
                      </code>
                    </td>
                    <td>{j.role}</td>
                    <td>
                      <code className={s.code}>{formatTimestamp(person?.invited_at)}</code>
                    </td>
                    <td>
                      <code className={s.code}>
                        {formatTimestamp(person?.invite_accepted_at)}
                      </code>
                    </td>
                    <td>
                      <code className={s.code}>
                        {formatTimestamp(person?.invite_expires_at)}
                      </code>
                    </td>
                  </tr>
                );
              })}
              {(!junction || junction.length === 0) && (
                <tr>
                  <td colSpan={8} className={s.tableEmpty}>
                    No junction rows yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DevSection>
    </PageShell>
  );
}

function DevSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <div className={s.sectionTitle}>
        <Eyebrow as="div">{eyebrow}</Eyebrow>
        <Heading level={2} size="h3" underline>
          {title}
        </Heading>
      </div>
      {description && <p className={s.sectionDescription}>{description}</p>}
      {children}
    </section>
  );
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toISOString().replace("T", " ").slice(0, 19);
  } catch {
    return value;
  }
}
