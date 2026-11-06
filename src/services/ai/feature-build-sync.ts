import type { SupabaseClient } from "@supabase/supabase-js";
import type { GitHubIssuesClient } from "@/lib/github/issues-client";
import type { CapabilityRequestRow, FeatureBuild } from "@/src/services/ai/capability-requests";
import { recordFeatureBuildPreview, recordFeatureBuildPullRequest } from "@/src/services/ai/feature-builds";
import { parseTestSteps } from "@/src/services/github/pull-request-event";

// Catches a build's card up with GitHub when the webhook missed an event
// (it wasn't set up yet, pointed at another site, or a delivery failed).
// Looks up the build's pull request by its branch (claude/issue-<n>-…) and
// the Vercel preview link from Vercel's comment on it, and saves anything
// new the same way the webhook would. Returns true when something changed.

const VERCEL_BOT = "vercel[bot]";

function issueNumberOf(build: FeatureBuild): number | null {
  const issue = build.issueUrl.match(/\/issues\/(\d+)$/)?.[1];
  return issue ? Number(issue) : null;
}

// The preview link in Vercel's "Deployment | Preview" table comment, once
// the deployment is Ready (Vercel posts the link while it's still building).
export function previewUrlFromVercelComment(body: string): string | null {
  if (!/status\/ready\.svg|\[Ready\]/i.test(body)) return null;
  const url = body.match(/\[(?:Visit )?Preview\]\((https:\/\/[a-z0-9.-]+\.vercel\.app)\/?\)/i)?.[1];
  return url ?? null;
}

async function syncOne(supabase: SupabaseClient, github: GitHubIssuesClient, build: FeatureBuild): Promise<boolean> {
  const issueNumber = issueNumberOf(build);
  if (!issueNumber) return false;

  const found = await github.findPullRequest(new RegExp(`^claude/issue-${issueNumber}(?:-|$)`));
  if (!found.ok || !found.pullRequest) return false;
  const pr = found.pullRequest;
  let changed = false;

  if (build.pullRequest?.state !== pr.state || build.pullRequest?.number !== pr.number) {
    const saved = await recordFeatureBuildPullRequest(supabase, {
      issueNumber,
      prNumber: pr.number,
      prUrl: pr.url,
      state: pr.state,
      testSteps: parseTestSteps(pr.body),
    });
    changed = saved.ok && saved.matched;
  }

  if (pr.state === "open" && !build.previewUrl) {
    const comments = await github.listComments(pr.number);
    const previewUrl = comments.ok
      ? comments.comments
          .filter((comment) => comment.author === VERCEL_BOT)
          .map((comment) => previewUrlFromVercelComment(comment.body))
          .find((url): url is string => url !== null)
      : undefined;
    if (previewUrl) {
      const saved = await recordFeatureBuildPreview(supabase, { issueNumber, previewUrl });
      changed = changed || (saved.ok && saved.matched);
    }
  }
  return changed;
}

// Syncs every build that's still in progress or being tested.
export async function syncFeatureBuilds(
  supabase: SupabaseClient,
  github: GitHubIssuesClient,
  rows: ReadonlyArray<CapabilityRequestRow>,
): Promise<boolean> {
  const active = rows
    .map((row) => row.build)
    .filter((build): build is FeatureBuild => build !== null && (!build.pullRequest || build.pullRequest.state === "open"));
  const results = await Promise.all(active.map((build) => syncOne(supabase, github, build).catch(() => false)));
  return results.some(Boolean);
}
