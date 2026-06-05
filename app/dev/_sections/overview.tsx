import { Card, Eyebrow } from "@/lib/ui";
import { DevSection } from "../_components/dev-section";
import s from "../dev.module.css";

// Static help: the schema model + the recommended testing workflow.
export function OverviewSection() {
  return (
    <DevSection title="Overview &amp; workflow">
      <Card warm padding="loose" className={s.note}>
        <Eyebrow as="div" className="mb-3">
          Schema model
        </Eyebrow>
        <p className="mt-0">
          A <code>people</code> row is a human (email + auth account). A{" "}
          <code>memberships</code> row is a club account (member number, tier, dues) scoped to one
          property. A <code>membership_people</code> junction row binds a person to a membership
          with a role (<em>primary</em> / <em>spouse</em> / <em>dependent</em> /{" "}
          <em>authorized</em>). One membership can have multiple authorized people (household). One
          person can be on multiple memberships (cross-property).
        </p>
        <Eyebrow as="div" className="mt-6 mb-2">
          Recommended workflow
        </Eyebrow>
        <ol>
          <li>
            <strong>Create person + membership(s)</strong> — seeds a person and a membership at
            each checked property, with that person as primary.
          </li>
          <li>
            <strong>(Optional) Add authorized person</strong> — for household testing. Adds a
            spouse / dependent to an existing membership.
          </li>
          <li>
            <strong>Generate magic-link URL</strong> — for each email you want to test as. Creates
            the auth user if new; returns a one-click link at the top of this page.
          </li>
          <li>
            <strong>Click that link</strong> — runs <code>/auth/callback</code>, links the person
            to their auth user, stamps role, lands them on <code>/member</code>.
          </li>
        </ol>
        <p>
          Use <strong>Reset test user</strong> to wipe a person, their memberships (where they&rsquo;re
          primary), their junction rows, and their <code>auth.users</code> row.
        </p>
      </Card>
    </DevSection>
  );
}
