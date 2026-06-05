import { Button, Card, FormField, Input } from "@/lib/ui";
import { forceExpireInvite } from "../actions";
import { DevSection } from "../_components/dev-section";
import s from "../dev.module.css";

// Back-dates an invite's expiry so the next magic-link click hits the
// expired-invite path.
export function ExpireInviteSection() {
  return (
    <DevSection
      title="Force-expire invite"
      description={
        <>
          Sets <code>invite_expires_at = 2000-01-01</code> on the people row (if unlinked) so the
          next magic-link click hits the expired-invite path.
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
  );
}
