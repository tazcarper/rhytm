import { Button, Card, FormField, Input } from "@/lib/ui";
import { generateMagicLink } from "../actions";
import { DevSection } from "../_components/dev-section";
import s from "../dev.module.css";

// Generates a no-email magic-link URL (rendered in the banner up top).
export function MagicLinkSection() {
  return (
    <DevSection
      title="Generate magic-link URL (no email)"
      description={
        <>
          Calls <code>supabaseAdmin.auth.admin.generateLink({"{ type: ... }"})</code> (auto-picking{" "}
          <code>invite</code> for new emails or <code>magiclink</code> for existing auth users) and
          constructs the callback URL from the returned <code>hashed_token</code>. The link is
          rendered at the top of this page — click it to complete sign-in.
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
  );
}
