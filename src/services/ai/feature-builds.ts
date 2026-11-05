import type { SupabaseClient } from "@supabase/supabase-js";
import type { GitHubIssuesClient, NewIssue } from "@/lib/github/issues-client";
import type { CapabilityRequestRow } from "@/src/services/ai/capability-requests";

// "Build it": a feature request becomes a GitHub issue that the Claude
// GitHub Action picks up (the label below triggers it). Claude builds on a
// branch, a pull request opens with a Vercel preview, and the GitHub
// webhook moves the request along (see recordFeatureBuildPullRequest).

// Must match label_trigger in .github/workflows/claude-build.yml.
export const FEATURE_BUILD_LABEL = "claude-build";

// The issue Claude reads as its instructions.
export function featureBuildIssue(row: CapabilityRequestRow): NewIssue {
  const asks = [row.ownerWords, ...row.alsoAsked.map((ask) => ask.ownerWords)];
  const drafts = row.events.map((event) => `- ${event.title} (${event.status}) — /admin/events/${event.id}`);

  const body = [
    `<!-- rhythm-feature-request: ${row.id} -->`,
    "## What to build",
    "",
    row.summary,
    "",
    "Staff asked the AI event helper for this and it couldn't do it, so this is a gap in the event builder.",
    "",
    "## What staff said",
    "",
    ...asks.map((words) => `> ${words.replace(/\n/g, "\n> ")}\n`),
    `Club: ${row.propertyName ?? "not given"}`,
    "",
    "## Drafts waiting on it",
    "",
    ...(drafts.length > 0 ? drafts : ["- None linked yet."]),
    "",
    "These drafts can't be published until this is built. Look at them in the code paths they use to see what's missing.",
    "",
    "## How to build it",
    "",
    "- Read CLAUDE.md first and follow it (SOLID, project structure, RLS rules, client state rules). Read PRODUCT.md and DESIGN.md for anything visual.",
    "- The event builder lives in app/admin/events, src/components/admin/event-*, src/services/admin/events.ts and related services. The AI helper is src/services/ai/event-helper.ts and src/services/ai/event-helper-tools.ts: once the builder can do this, teach the helper to use it so it stops filing this request.",
    "- Database changes go in a new file under supabase/migrations. Don't apply it anywhere; say in your summary that it needs running.",
    "- Don't edit package.json, next.config.*, tsconfig.json, proxy.ts, lib/supabase/* or lib/auth/*. If the feature truly needs that, stop and explain why in a comment instead.",
    "- Keep the change to this feature. Run `npm run typecheck` and fix what it finds before you finish.",
    "- Finish with a short summary of what changed and how to test it on the preview.",
  ].join("\n");

  return {
    title: `Feature request: ${row.summary.slice(0, 200)}`,
    body,
    labels: [FEATURE_BUILD_LABEL],
  };
}

export async function requestFeatureBuild(
  supabase: SupabaseClient,
  github: GitHubIssuesClient,
  row: CapabilityRequestRow,
): Promise<{ ok: true; issueUrl: string } | { ok: false; error: string }> {
  const created = await github.createIssue(featureBuildIssue(row));
  if (!created.ok) return created;

  const { error } = await supabase
    .from("capability_requests")
    .update({
      build_issue_number: created.issue.number,
      build_issue_url: created.issue.url,
      build_requested_at: new Date().toISOString(),
      build_pr_number: null,
      build_pr_url: null,
      build_pr_state: null,
    })
    .eq("id", row.id);
  if (error) return { ok: false, error: `The build started (${created.issue.url}) but couldn't be saved: ${error.message}` };
  return { ok: true, issueUrl: created.issue.url };
}

// A pull request event, reduced to what moves a request along.
export interface FeatureBuildPullRequestEvent {
  issueNumber: number;
  prNumber: number;
  prUrl: string;
  state: "open" | "merged" | "closed";
}

// PR opened → Planned, with the link. Merged → Built, which unlocks the
// drafts. Closed without merging → the link stays and Build it can be
// pressed again. Returns false when no request has that issue (a PR that
// isn't a feature build).
export async function recordFeatureBuildPullRequest(
  supabase: SupabaseClient,
  event: FeatureBuildPullRequestEvent,
): Promise<{ ok: true; matched: boolean } | { ok: false; error: string }> {
  const statusByState = { open: "planned", merged: "built" } as const;
  const status = event.state === "closed" ? undefined : statusByState[event.state];

  const { data, error } = await supabase
    .from("capability_requests")
    .update({
      build_pr_number: event.prNumber,
      build_pr_url: event.prUrl,
      build_pr_state: event.state,
      ...(status ? { status } : {}),
    })
    .eq("build_issue_number", event.issueNumber)
    .select("id");
  if (error) return { ok: false, error: error.message };
  return { ok: true, matched: (data ?? []).length > 0 };
}
