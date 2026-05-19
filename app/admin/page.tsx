import { signOut } from "@/lib/auth/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button, Card, Eyebrow, Heading, PageShell } from "@/lib/ui";

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
      <Eyebrow as="div" className="mb-2">
        Staff
      </Eyebrow>
      <Heading level={1} size="h2" underline>
        Admin Portal
      </Heading>
      <div className="flex items-center justify-between flex-wrap gap-4 mt-4">
        <p className="text-gray m-0">
          Signed in as <strong>{user?.email}</strong>.
        </p>
        <form action={signOut}>
          <Button type="submit" variant="secondary" size="sm">
            Sign out
          </Button>
        </form>
      </div>
      <Card padding="loose" className="mt-6">
        <Eyebrow as="div" className="mb-3">
          Session claims
        </Eyebrow>
        <ul className="m-0 pl-5 text-olive">
          <li>
            role: <code className="font-mono">{(meta.role as string | undefined) ?? "—"}</code>
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
