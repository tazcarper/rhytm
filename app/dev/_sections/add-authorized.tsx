import { Button, Card, FormField, Input } from "@/lib/ui";
import { addAuthorizedPerson } from "../actions";
import { getDevMemberships } from "../_lib/queries";
import { MembershipPicker } from "../membership-picker";
import { DevSection } from "../_components/dev-section";
import s from "../dev.module.css";

// Household test — adds a second person to an existing membership.
export async function AddAuthorizedSection() {
  const memberships = await getDevMemberships();

  return (
    <DevSection
      title="Add authorized person to existing membership"
      description={
        <>
          Household test. Adds a second person (spouse / dependent / authorized user) to a
          membership that already has a primary. If a <code>people</code> row already exists for the
          email (e.g., they&rsquo;re on another membership) it&rsquo;s reused; otherwise created
          fresh. Type the member number to narrow the dropdown.
        </>
      }
    >
      <Card padding="loose">
        <form action={addAuthorizedPerson} className={s.formStack}>
          <FormField label="Email" required>
            {(p) => <Input {...p} name="email" type="email" required />}
          </FormField>

          <MembershipPicker memberships={memberships} />

          <FormField label="Role">
            {(p) => (
              <select {...p} name="role" defaultValue="spouse" className={s.select}>
                <option value="spouse">spouse</option>
                <option value="dependent">dependent</option>
                <option value="authorized">authorized</option>
              </select>
            )}
          </FormField>

          <FormField label="First name">{(p) => <Input {...p} name="first_name" />}</FormField>
          <FormField label="Last name">{(p) => <Input {...p} name="last_name" />}</FormField>

          <div className={s.actions}>
            <Button type="submit" variant="primary" size="sm">
              Add authorized person
            </Button>
          </div>
        </form>
      </Card>
    </DevSection>
  );
}
