import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert, Button, Heading, PageShell, Text } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { getPromotionsList } from "@/src/services/admin/promotions";
import { PromotionsDataTable } from "@/src/components/admin/promotions-data-table";

export const dynamic = "force-dynamic";

// Promotions index — marketing/seasonal content staff compose, schedule,
// place on public pages, and archive to re-run later.
export default async function AdminPromotionsPage() {
  const supabase = await createServerSupabaseClient();

  let rows = [] as Awaited<ReturnType<typeof getPromotionsList>>;
  let loadError: string | null = null;
  try {
    rows = await getPromotionsList(supabase);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load promotions";
  }

  return (
    <PageShell width="xl">
      <AdminBreadcrumb
        segments={[{ label: "Admin", href: "/admin" }, { label: "Promotions" }]}
      />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Heading level={1} size="h2" underline>
            Promotions
          </Heading>
          <Text variant="lead">
            Seasonal offers and featured messages for the public site. Publish
            one to any page, schedule its window, and archive it to run again
            later.
          </Text>
        </div>
        <Button asChild variant="primary">
          <Link href="/admin/promotions/new">New promotion</Link>
        </Button>
      </div>

      {loadError && (
        <Alert variant="error" title="Could not load promotions">
          {loadError}
        </Alert>
      )}

      <PromotionsDataTable rows={rows} />
    </PageShell>
  );
}
