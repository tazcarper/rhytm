import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert, Heading, PageShell, Text, cn } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { getInquiriesList } from "@/src/services/admin/inquiries";
import { InquiriesDataTable } from "@/src/components/admin/inquiries-data-table";

export const dynamic = "force-dynamic";

const TABS = [
  { status: "new" as const, label: "New" },
  { status: "resolved" as const, label: "Resolved" },
];

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const status = statusParam === "resolved" ? "resolved" : "new";

  const supabase = await createServerSupabaseClient();

  let rows = [] as Awaited<ReturnType<typeof getInquiriesList>>;
  let loadError: string | null = null;
  try {
    rows = await getInquiriesList(supabase, { status });
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load inquiries";
  }

  return (
    <PageShell width="xl">
      <AdminBreadcrumb segments={[{ label: "Admin", href: "/admin" }, { label: "Inquiries" }]} />
      <div className="mb-4">
        <Heading level={1} size="h2" underline>
          Inquiries
        </Heading>
        <Text variant="lead">
          Membership and private-event form submissions from the public site.
        </Text>
      </div>

      <div className="mb-4 flex gap-1 border-b border-rule">
        {TABS.map((tab) => (
          <Link
            key={tab.status}
            href={`/admin/inquiries?status=${tab.status}`}
            className={cn(
              "px-4 py-2 text-[13px] font-medium uppercase tracking-label no-underline",
              status === tab.status
                ? "border-b-2 border-tan-deep text-olive"
                : "text-gray hover:text-olive",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {loadError && (
        <Alert variant="error" title="Could not load inquiries">
          {loadError}
        </Alert>
      )}

      <InquiriesDataTable rows={rows} />
    </PageShell>
  );
}
