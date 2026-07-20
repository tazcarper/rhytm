import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminAdventuresList } from "@/src/services/admin/adventures";
import { Button, Heading, PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { AdventuresDataTable } from "@/src/components/admin/adventures-data-table";

export const dynamic = "force-dynamic";

// Admin adventures index — all properties (RLS scopes property managers
// to their own). Status + capacity + payment mode at a glance.
export default async function AdminAdventuresPage() {
  const supabase = await createServerSupabaseClient();
  const adventures = await getAdminAdventuresList(supabase);

  return (
    <PageShell width="xl">
      <AdminBreadcrumb
        segments={[{ label: "Admin", href: "/admin" }, { label: "Adventures" }]}
      />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <Heading level={1} size="h2" underline>
          Adventures
        </Heading>
        <Button asChild variant="primary">
          <Link href="/admin/adventures/new">New adventure</Link>
        </Button>
      </div>

      <AdventuresDataTable rows={adventures} />
    </PageShell>
  );
}
