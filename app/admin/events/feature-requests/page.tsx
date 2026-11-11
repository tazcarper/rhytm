import { createGitHubIssuesClient } from "@/lib/github/issues-client";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button, Heading, PageShell, Text } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { CapabilityRequestsList } from "@/src/components/admin/capability-requests-list";
import {
  FeatureRequestTabs,
  FeatureRequestViewTabs,
  isFeatureRequestTab,
  isFeatureRequestView,
} from "@/src/components/admin/feature-request-tabs";
import { getCapabilityRequests, isOpenRequest } from "@/src/services/ai/capability-requests";
import { getBuildRiskFor, isBuildOwner } from "@/src/services/ai/build-risk";
import { getBuildProgressFor } from "@/src/services/ai/feature-build-progress";
import { syncFeatureBuilds } from "@/src/services/ai/feature-build-sync";

export const dynamic = "force-dynamic";

const BASE_PATH = "/admin/events/feature-requests";


export default async function EventFeatureRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; view?: string }>;
}) {
  const { tab, view } = await searchParams;
  const activeTab = isFeatureRequestTab(tab) ? tab : "features";
  const activeView = isFeatureRequestView(view) ? view : "active";
  const supabase = await createServerSupabaseClient();
  const github = createGitHubIssuesClient();
  const firstRows = await getCapabilityRequests(supabase);
  // If the GitHub webhook missed something, catch up from GitHub directly.
  const rows = github && (await syncFeatureBuilds(supabase, github, firstRows)) ? await getCapabilityRequests(supabase) : firstRows;
  const canBuild = github !== null;
  const features = rows.filter((row) => !row.fix);
  const fixes = rows.filter((row) => row.fix);
  const list = activeTab === "fixes" ? fixes : features;
  const openInList = list.filter(isOpenRequest);
  const doneInList = list.filter((row) => !isOpenRequest(row));
  const shown = activeView === "done" ? doneInList : openInList;
  const [progress, risks, { data: auth }] = await Promise.all([
    github ? getBuildProgressFor(github, shown) : {},
    github ? getBuildRiskFor(github, shown) : {},
    supabase.auth.getUser(),
  ]);

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
      <FeatureRequestViewTabs
        tab={activeTab}
        active={activeView}
        counts={{ active: openInList.length, done: doneInList.length }}
        basePath={BASE_PATH}
      />
      {activeTab === "fixes" && activeView === "active" && (
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
        risks={risks}
        isOwner={isBuildOwner(auth.user?.email)}
        emptyText={
          activeView === "done"
            ? activeTab === "fixes"
              ? "No fixes finished yet."
              : "No features built yet."
            : activeTab === "fixes"
              ? "No open problems. If something Claude built isn't working right, use Report a problem."
              : "Nothing waiting. When the helper can't do something staff ask for, it shows up here."
        }
      />
    </PageShell>
  );
}
