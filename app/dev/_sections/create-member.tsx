import { Button, Card, FormField, Input } from "@/lib/ui";
import { createTestMember } from "../actions";
import { getDevProperties } from "../_lib/queries";
import { DevSection } from "../_components/dev-section";
import s from "../dev.module.css";

// Seeds a person + a membership per selected property, binding the person
// as primary on each.
export async function CreateMemberSection() {
  const properties = await getDevProperties();

  return (
    <DevSection
      title="Create person + membership(s)"
      description={
        <>
          Inserts one <code>people</code> row and one <code>memberships</code> row per selected
          property, plus the junction rows binding the person as <em>primary</em> on each
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
            {properties.map((property) => (
              <label key={property.id} className={s.checkRow}>
                <input type="checkbox" name="property_ids" value={property.id} />
                {property.name}
              </label>
            ))}
          </fieldset>

          <FormField label="Member number" helper="Reused across selected properties." required>
            {(p) => <Input {...p} name="member_number" required placeholder="TEST-0001" />}
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
  );
}
