import { Button, Card, FormField, Input } from "@/lib/ui";
import { resetTestUser } from "../actions";
import { DevSection } from "../_components/dev-section";
import s from "../dev.module.css";

// Wipes a person + their primary memberships + junction rows + auth user.
export function ResetUserSection() {
  return (
    <DevSection
      title="Reset test user"
      description={
        <>
          Deletes the <code>people</code> row for this email, every <code>memberships</code> row
          where they were primary, every junction row that touched them, and the corresponding{" "}
          <code>auth.users</code> row. Memberships where they were only a spouse / authorized are
          kept (they&rsquo;re just removed from the junction).
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
  );
}
