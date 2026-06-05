import { Button, Card, FormField, Input } from "@/lib/ui";
import { sendInvite } from "../actions";
import { DevSection } from "../_components/dev-section";
import s from "../dev.module.css";

// Sends a real invite email (subject to Supabase's mailer rate limit).
export function SendInviteSection() {
  return (
    <DevSection
      title="Send magic-link invite (email)"
      description={
        <>
          Calls <code>supabaseAdmin.auth.admin.inviteUserByEmail()</code> with{" "}
          <code>redirectTo</code> set to the current host&rsquo;s <code>/auth/callback</code>.
          Subject to Supabase&rsquo;s email rate limit (~3&ndash;4/hour on the built-in mailer). For
          fast iteration use the no-email generator below.
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
  );
}
