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
      <Eyebrow as="div" className="mb-2">
        Partner
      </Eyebrow>
      <Heading level={1} size="h2" underline>
        Partner Portal
      </Heading>
      <p className="text-gray mt-4">
        Signed in as <strong>{user?.email}</strong>.
      </p>
      <Card padding="loose" className="mt-6">
        <Eyebrow as="div" className="mb-3">
          Session claims
        </Eyebrow>
        <ul className="m-0 pl-5 text-olive">
          <li>
            role: <code className="font-mono">{(meta.role as string | undefined) ?? "—"}</code>
          </li>
          <li>
            partner_org_id:{" "}
            <code className="font-mono">
              {(meta.partner_org_id as string | undefined) ?? "—"}
            </code>
          </li>
          <li>
            property_id:{" "}
            <code className="font-mono">
              {(meta.property_id as string | undefined) ?? "—"}
            </code>
          </li>
        </ul>
      </Card>
    </PageShell>
  );
}
