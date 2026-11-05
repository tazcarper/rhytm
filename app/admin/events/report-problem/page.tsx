import { createGitHubIssuesClient } from "@/lib/github/issues-client";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Heading, PageShell, Text } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { ReportProblemForm } from "@/src/components/admin/report-problem-form";
import { getCapabilityRequests, liveFeatures } from "@/src/services/ai/capability-requests";

export const dynamic = "force-dynamic";

export default async function ReportProblemPage() {
  const supabase = await createServerSupabaseClient();
  const features = liveFeatures(await getCapabilityRequests(supabase));
  const canFix = createGitHubIssuesClient() !== null;

  return (
    <PageShell width="wide">
      <AdminBreadcrumb
        segments={[
          { label: "Admin", href: "/admin" },
          { label: "Events", href: "/admin/events" },
          { label: "Report a problem" },
        ]}
      />
      <Heading level={1} size="h2" underline>
        Report a problem
      </Heading>
      <Text className="mb-6 mt-2">
        Something Claude added to the site isn&apos;t working right? Tell it what&apos;s happening. Claude looks back at
        how that feature was built and what&apos;s changed since, finds the cause, and fixes it. You&apos;ll try the fix
        on a test copy of the site before it goes live, the same way as a new feature.
      </Text>
      <ReportProblemForm features={features.map((row) => ({ id: row.id, summary: row.summary }))} canFix={canFix} />
    </PageShell>
  );
}
