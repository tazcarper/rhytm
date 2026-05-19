import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, Eyebrow, Heading, PageShell } from "@/lib/ui";

export const dynamic = "force-dynamic";

// Admin portal stub. Confirms the staff role claim is in place. The
// middleware has already restricted this route to one of the five
// staff roles, so the role display below is for verification only.
// Real admin views (booking review, bid editor, member management)
// land with App 3.
export default async function AdminHome() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const meta = user?.app_metadata ?? {};

  return (
    <PageShell width="narrow">
      <Eyebrow as="div" style={{ marginBottom: "0.5rem" }}>
        Staff
      </Eyebrow>
      <Heading level={1} size="h2" underline>
        Admin Portal
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
