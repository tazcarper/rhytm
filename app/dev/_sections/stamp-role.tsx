import { Button, Card, FormField, Input } from "@/lib/ui";
import { stampRole } from "../actions";
import { getDevProperties } from "../_lib/queries";
import { DevSection } from "../_components/dev-section";
import s from "../dev.module.css";

const ROLES = [
  "super_admin",
  "admin",
  "property_manager",
  "concierge",
  "membership_coordinator",
  "member",
  "partner",
];

// Directly sets app_metadata (role + property + partner org) on an auth user.
export async function StampRoleSection() {
  const properties = await getDevProperties();

  return (
    <DevSection
      title="Stamp app_metadata role"
      description={
        <>
          Directly sets <code>app_metadata</code> on an existing auth user. Lets you test{" "}
          <code>/admin</code> and <code>/partner</code> bounces without setting up real staff /
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
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField label="Property" helper="Required for property_manager.">
            {(p) => (
              <select {...p} name="property_id" className={s.select}>
                <option value="">— none —</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
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
  );
}
