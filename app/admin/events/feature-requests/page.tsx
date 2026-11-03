import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Heading, PageShell, Text } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { CapabilityRequestsList } from "@/src/components/admin/capability-requests-list";
import { getCapabilityRequests } from "@/src/services/ai/capability-requests";

export const dynamic = "force-dynamic";

export default async function EventFeatureRequestsPage() {
  const supabase = await createServerSupabaseClient();
  const rows = await getCapabilityRequests(supabase);

  return (
    <PageShell width="xxl">
      <AdminBreadcrumb
        segments={[
          { label: "Admin", href: "/admin" },
          { label: "Events", href: "/admin/events" },
          { label: "Feature requests" },
        ]}
      />
      <Heading level={1} size="h2" underline>
        Feature requests
      </Heading>
      <Text className="mb-6 mt-2">
        Things staff asked the event helper for that the event builder can&apos;t do yet. A developer reviews these.
      </Text>
      <CapabilityRequestsList rows={rows} />
    </PageShell>
  );
}
