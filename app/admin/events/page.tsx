import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert, Button, Heading, PageShell, Text } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { getEventsList } from "@/src/services/admin/events";
import { EventsDataTable } from "@/src/components/admin/events-data-table";

export const dynamic = "force-dynamic";

// Events index — dated occasions with a hard capacity cap and member vs.
// non-member pricing, distinct from open-slot bookings.
export default async function AdminEventsPage() {
  const supabase = await createServerSupabaseClient();

  let rows = [] as Awaited<ReturnType<typeof getEventsList>>;
  let loadError: string | null = null;
  try {
    rows = await getEventsList(supabase);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load events";
  }

  return (
    <PageShell width="xl">
      <AdminBreadcrumb segments={[{ label: "Admin", href: "/admin" }, { label: "Events" }]} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Heading level={1} size="h2" underline>
            Events
          </Heading>
          <Text variant="lead">
            Specific dated occasions with a capacity cap and member vs.
            non-member pricing. Create a template once, then reuse it for
            each new event.
          </Text>
        </div>
        <Button asChild variant="primary">
          <Link href="/admin/events/new">New event</Link>
        </Button>
      </div>

      {loadError && (
        <Alert variant="error" title="Could not load events">
          {loadError}
        </Alert>
      )}

      <EventsDataTable rows={rows} />
    </PageShell>
  );
}
