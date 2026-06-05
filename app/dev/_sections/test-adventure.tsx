import { Button, Card, FormField, Input } from "@/lib/ui";
import { createTestAdventure } from "../actions";
import { getDevProperties } from "../_lib/queries";
import { DevSection } from "../_components/dev-section";
import s from "../dev.module.css";

// Seeds a published adventure with a controlled capacity for RSVP testing.
export async function TestAdventureSection() {
  const properties = await getDevProperties();
  const defaultPropertyId =
    properties.find((property) => property.slug === "horseshoe-bay")?.id ?? "";

  return (
    <DevSection
      title="Create test adventure (RSVP capacity testing)"
      description={
        <>
          Inserts one published <code>member_adventures</code> row at the chosen property with a
          controlled capacity, so you can exercise the RSVP capacity-race / sold-out flip (scenario
          I4). Set <strong>capacity = 1</strong> and reserve it from two sessions to see one succeed
          and the other get &ldquo;just filled up,&rdquo; with the card flipping to{" "}
          <em>Waitlist Only</em> on reload. Tagged <code>details.placeholder=true</code>, so it&rsquo;s
          cleaned up by the same delete as the seed set.
        </>
      }
    >
      <Card padding="loose">
        <form action={createTestAdventure} className={s.formStack}>
          <FormField label="Property" required>
            {(p) => (
              <select
                {...p}
                name="property_id"
                required
                defaultValue={defaultPropertyId}
                className={s.select}
              >
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField label="Title">
            {(p) => <Input {...p} name="title" placeholder="DEV Test Adventure" />}
          </FormField>

          <FormField label="Max capacity" helper="Total spots. Use 1 for the capacity-race test.">
            {(p) => <Input {...p} name="max_capacity" type="number" min="1" defaultValue="1" />}
          </FormField>

          <FormField
            label="Max guests per RSVP"
            helper="Clamped to ≤ capacity. Blank = same as capacity."
          >
            {(p) => <Input {...p} name="max_guests_per_rsvp" type="number" min="1" />}
          </FormField>

          <FormField label="Price" helper="0 renders as “Included”.">
            {(p) => (
              <Input {...p} name="price" type="number" min="0" step="0.01" defaultValue="0" />
            )}
          </FormField>

          <div className={s.actions}>
            <Button type="submit" variant="primary" size="sm">
              Create test adventure
            </Button>
          </div>
        </form>
      </Card>
    </DevSection>
  );
}
