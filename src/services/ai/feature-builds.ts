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
    "- The helper's strict tool schemas (src/services/ai/event-draft-schema.ts and event-helper-tools.ts) may hold at most 16 nullable or union-typed fields in total, or every helper message fails with a 400. Before adding one, count them; prefer a plain string with \"\" for none, or a non-null field.",
    "- Database changes go in a new file under supabase/migrations (additive changes only: add columns or tables, don't drop or rename). Don't apply it yourself; it's applied to the preview database when the PR opens and to production when it merges.",
    "- Don't edit package.json, next.config.*, tsconfig.json, proxy.ts, lib/supabase/* or lib/auth/*. If the feature truly needs that, stop and explain why in a comment instead.",
    "- Keep the change to this feature. Run `npm run typecheck` and fix what it finds before you finish.",
    "- Finish with a short summary of what changed, then a section headed exactly `## How to test` with 3 to 6 numbered steps for a non-technical admin trying it on the preview site. Start from a page in the admin (e.g. Admin → Events), say what to click and type, and what they should see. No code, file names or jargon.",
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
      build_preview_url: null,
      build_test_steps: null,
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
  // Claude's "How to test" steps from the PR body, when there are any.
  testSteps: ReadonlyArray<string>;
}

// A finished Vercel preview of a feature build's branch.
export interface FeatureBuildPreviewEvent {
  issueNumber: number;
  previewUrl: string;
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
      ...(event.testSteps.length > 0 ? { build_test_steps: event.testSteps.join("\n") } : {}),
      ...(status ? { status } : {}),
    })
    .eq("build_issue_number", event.issueNumber)
    .select("id");
  if (error) return { ok: false, error: error.message };
  return { ok: true, matched: (data ?? []).length > 0 };
}

// Saves the preview link for the request whose build this branch is.
export async function recordFeatureBuildPreview(
  supabase: SupabaseClient,
  event: FeatureBuildPreviewEvent,
): Promise<{ ok: true; matched: boolean } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("capability_requests")
    .update({ build_preview_url: event.previewUrl })
    .eq("build_issue_number", event.issueNumber)
    .select("id");
  if (error) return { ok: false, error: error.message };
  return { ok: true, matched: (data ?? []).length > 0 };
}
