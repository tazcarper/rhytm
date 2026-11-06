import { createGitHubIssuesClient } from "@/lib/github/issues-client";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Heading, PageShell, Text } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { CapabilityRequestsList } from "@/src/components/admin/capability-requests-list";
import { getCapabilityRequests } from "@/src/services/ai/capability-requests";
import { getBuildProgressFor } from "@/src/services/ai/feature-build-progress";
import { syncFeatureBuilds } from "@/src/services/ai/feature-build-sync";

export const dynamic = "force-dynamic";

export default async function EventFeatureRequestsPage() {
  const supabase = await createServerSupabaseClient();
  const github = createGitHubIssuesClient();
  const firstRows = await getCapabilityRequests(supabase);
  // If the GitHub webhook missed something, catch up from GitHub directly.
  const rows = github && (await syncFeatureBuilds(supabase, github, firstRows)) ? await getCapabilityRequests(supabase) : firstRows;
  const canBuild = github !== null;
  const progress = github ? await getBuildProgressFor(github, rows) : {};

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
      <div className="mb-8 mt-4 flex max-w-[70ch] flex-col gap-3">
        <Text>
          Things staff asked the event helper for that the event builder can&apos;t do yet, and problems reported with
          features already live. Drafts that need a feature can&apos;t be published until it&apos;s built.
        </Text>
        <Text>
          Press Build it and Claude gets to work; you can follow its checklist on the card. When it&apos;s done,
          you&apos;ll get a link to preview it on a test copy of the site, then a button to publish it.
        </Text>
      </div>
      <CapabilityRequestsList rows={rows} canBuild={canBuild} progress={progress} />
    </PageShell>
  );
}
