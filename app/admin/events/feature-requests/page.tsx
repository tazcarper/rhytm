import { createGitHubIssuesClient } from "@/lib/github/issues-client";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button, Heading, PageShell, Text } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { CapabilityRequestsList } from "@/src/components/admin/capability-requests-list";
import { FeatureRequestTabs, isFeatureRequestTab } from "@/src/components/admin/feature-request-tabs";
import { getCapabilityRequests, isOpenRequest } from "@/src/services/ai/capability-requests";
import { getBuildProgressFor } from "@/src/services/ai/feature-build-progress";
import { syncFeatureBuilds } from "@/src/services/ai/feature-build-sync";

export const dynamic = "force-dynamic";

const BASE_PATH = "/admin/events/feature-requests";


export default async function EventFeatureRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = isFeatureRequestTab(tab) ? tab : "features";
  const supabase = await createServerSupabaseClient();
  const github = createGitHubIssuesClient();
  const firstRows = await getCapabilityRequests(supabase);
  // If the GitHub webhook missed something, catch up from GitHub directly.
  const rows = github && (await syncFeatureBuilds(supabase, github, firstRows)) ? await getCapabilityRequests(supabase) : firstRows;
  const canBuild = github !== null;
  const features = rows.filter((row) => !row.fix);
  const fixes = rows.filter((row) => row.fix);
  const shown = activeTab === "fixes" ? fixes : features;
  const progress = github ? await getBuildProgressFor(github, shown) : {};

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
      {/* Text sets margin: 0 in its own CSS, so spacing lives on a wrapper. */}
      <div className="mb-8 mt-4 max-w-[70ch]">
        <Text>
          Things staff asked the event helper for that the event builder can&apos;t do yet, and problems reported with
          features already live. Drafts that need a feature can&apos;t be published until it&apos;s built.
        </Text>
      </div>
      <FeatureRequestTabs
        active={activeTab}
        basePath={BASE_PATH}
        openCounts={{ features: features.filter(isOpenRequest).length, fixes: fixes.filter(isOpenRequest).length }}
      />
      {activeTab === "fixes" && (
        <div className="mb-5">
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/events/report-problem">Report a problem</Link>
          </Button>
        </div>
      )}
      <CapabilityRequestsList
        rows={shown}
        canBuild={canBuild}
        progress={progress}
        emptyText={
          activeTab === "fixes"
            ? "No problems reported. If something Claude built isn't working right, use Report a problem."
            : "No feature requests yet. When the helper can't do something staff ask for, it shows up here."
        }
      />
    </PageShell>
  );
}
