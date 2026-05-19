import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, Eyebrow, Heading, PageShell } from "@/lib/ui";

export const dynamic = "force-dynamic";

// Partner portal stub. Confirms the partner role claim is in place and
// shows the partner_org_id / property_id claims that downstream RLS
// policies will key off. Real concierge views (book-on-behalf-of-guest)
// land with App 5.
export default async function PartnerHome() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const meta = user?.app_metadata ?? {};

  return (
    <PageShell width="narrow">
      <Eyebrow as="div" style={{ marginBottom: "0.5rem" }}>
        Partner
      </Eyebrow>
      <Heading level={1} size="h2" underline>
        Partner Portal
      </Heading>
      <p style={{ color: "var(--gray)", marginTop: "1rem" }}>
        Signed in as <strong>{user?.email}</strong>.
      </p>
      <Card padding="loose" style={{ marginTop: "1.5rem" }}>
        <Eyebrow as="div" style={{ marginBottom: "0.75rem" }}>
          Session claims
        </Eyebrow>
        <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "var(--olive)" }}>
          <li>
            role:{" "}
            <code style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>
              {(meta.role as string | undefined) ?? "—"}
            </code>
          </li>
          <li>
            partner_org_id:{" "}
            <code style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>
              {(meta.partner_org_id as string | undefined) ?? "—"}
            </code>
          </li>
          <li>
            property_id:{" "}
            <code style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>
              {(meta.property_id as string | undefined) ?? "—"}
            </code>
          </li>
        </ul>
      </Card>
    </PageShell>
  );
}
