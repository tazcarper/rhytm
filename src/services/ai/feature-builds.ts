import type { SupabaseClient } from "@supabase/supabase-js";
import type { GitHubIssuesClient, NewIssue } from "@/lib/github/issues-client";
import {
  featurePublishedBuilds,
  type CapabilityRequestRow,
  type FeatureBuildKind,
  type PublishedBuild,
} from "@/src/services/ai/capability-requests";

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
    "- Staff watch your progress checklist from the admin, so word every checklist item in plain English for a non-technical admin (e.g. \"Look at how the sign-up price is worked out\", \"Fix the total on the sign-up page\"). No file names, code or jargon in checklist items.",
    "- Read CLAUDE.md first and follow it (SOLID, project structure, RLS rules, client state rules). Read PRODUCT.md and DESIGN.md for anything visual.",
    "- If the feature is an optional extra on an event (like early-bird pricing), put its fields in an EventOptionPanel (src/components/admin/event-option-panel.tsx) under the step's options section, so they only show when switched on. Use FlowButton variant \"add\" for add-a-row buttons.",
    "- Any admin form follows .claude/skills/dashboard-forms/SKILL.md: labels, inputs, help text and headings come from src/components/admin/form-styles.module.css (never restyle them locally), short answers like counts, prices and dates get short boxes, and add-a-row buttons use AddRowButton.",
    "- The event builder lives in app/admin/events, src/components/admin/event-*, src/services/admin/events.ts and related services. The AI helper is src/services/ai/event-helper.ts and src/services/ai/event-helper-tools.ts: once the builder can do this, teach the helper to use it so it stops filing this request.",
    "- The helper's strict tool schemas (src/services/ai/event-draft-schema.ts and event-helper-tools.ts) may hold at most 16 nullable or union-typed fields in total, or every helper message fails with a 400. Before adding one, count them; prefer a plain string with \"\" for none, or a non-null field.",
    "- Database changes go in a new file under supabase/migrations (additive changes only: add columns or tables, don't drop or rename). Don't apply it yourself; it's applied to the preview database when the PR opens and to production when it merges.",
    "- Prefer adding over changing. The admin checks your changed files before anyone can publish: anything that deletes or rewrites existing data (UPDATE, DELETE or TRUNCATE on existing tables), drops, renames or retypes existing columns or tables, edits a migration that already exists, changes access rules (policies, grants, row level security) on existing tables, or touches sign-in (lib/auth, lib/supabase, proxy.ts) can only be published by the site owner. Avoid those when an additive way works: a new column with a DEFAULT instead of an UPDATE backfill, a new column instead of renaming one, a per-event on/off setting instead of removing something. Policies on tables you create are fine. If the feature truly needs one of them, do it and add a short `## Why this needs the owner` section to the pull request in plain words.",
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

// Shared rules for any build Claude does from the admin.
const BUILD_RULES = [
  "- Staff watch your progress checklist from the admin, so word every checklist item in plain English for a non-technical admin (e.g. \"Look at how the sign-up price is worked out\", \"Fix the total on the sign-up page\"). No file names, code or jargon in checklist items.",
  "- Read CLAUDE.md first and follow it (SOLID, project structure, RLS rules, client state rules). Read PRODUCT.md and DESIGN.md for anything visual.",
  "- The helper's strict tool schemas (src/services/ai/event-draft-schema.ts and event-helper-tools.ts) may hold at most 16 nullable or union-typed fields in total, or every helper message fails with a 400. Don't add one without counting them.",
  "- Database changes go in a new file under supabase/migrations (additive changes only: add columns or tables, don't drop or rename). Don't apply it yourself; it's applied to the preview database when the PR opens and to production when it merges.",
  "- Prefer adding over changing. The admin checks your changed files before anyone can publish: anything that deletes or rewrites existing data (UPDATE, DELETE or TRUNCATE on existing tables), drops, renames or retypes existing columns or tables, edits a migration that already exists, changes access rules (policies, grants, row level security) on existing tables, or touches sign-in (lib/auth, lib/supabase, proxy.ts) can only be published by the site owner. Avoid those when an additive way works: a new column with a DEFAULT instead of an UPDATE backfill, a new column instead of renaming one, a per-event on/off setting instead of removing something. Policies on tables you create are fine. If the feature truly needs one of them, do it and add a short `## Why this needs the owner` section to the pull request in plain words.",
  "- Don't edit package.json, next.config.*, tsconfig.json, proxy.ts, lib/supabase/* or lib/auth/*. If the fix truly needs that, stop and explain why in a comment instead.",
  "- Run `npm run typecheck` and fix what it finds before you finish.",
  "- Finish with a short summary of what changed, then a section headed exactly `## How to test` with 3 to 6 numbered steps for a non-technical admin trying it on the preview site. Start from a page in the admin (e.g. Admin → Events), say what to click and type, and what they should see. No code, file names or jargon.",
];

// "Report a problem": staff say a feature that's already live is broken.
// Claude traces the feature through the git history (its build branch,
// merge and any later changes), finds the cause and fixes it.
export function featureFixIssue(report: CapabilityRequestRow, feature: CapabilityRequestRow | null): NewIssue {
  const featureIssue = feature?.build?.issueUrl.match(/\/issues\/(\d+)$/)?.[1] ?? null;
  const featurePr = feature?.build?.pullRequest ?? null;

  const where = feature
    ? [
        `Staff say this is about: **${feature.summary}**`,
        "",
        featureIssue ? `- It was built from issue #${featureIssue} on a branch named \`claude/issue-${featureIssue}-…\`.` : "- It wasn't built through the Build it button, so find it by what it does.",
        featurePr?.number ? `- It went live in pull request #${featurePr.number} (${featurePr.url}).` : "",
        `- What staff originally asked for: "${feature.ownerWords.replace(/\n/g, " ")}"`,
      ].filter(Boolean)
    : [
        "Staff weren't sure which feature this is. Work it out from what they describe: look through recent merges (`git log --merges --since=\"60 days ago\"`, especially branches named `claude/issue-…`) and the code for the screens they mention.",
      ];

  const body = [
    `<!-- rhythm-feature-request: ${report.id} -->`,
    "## Something's broken",
    "",
    "A staff member reported a problem with a feature that's already on the live site. Find the cause and fix it.",
    "",
    "## What staff said",
    "",
    `> ${report.ownerWords.replace(/\n/g, "\n> ")}`,
    "",
    "## Which feature",
    "",
    ...where,
    "",
    "## How to investigate",
    "",
    "- Find the feature in the history: `git log --oneline --merges --grep \"issue-N\"` for its merge, then `git log -p <merge>^1..<merge>` (or `git diff <merge>^1 <merge>`) to see everything it changed.",
    "- Check what changed in those files since it went live (`git log -p <merge>.. -- <files>`); a later change may have broken it.",
    "- Read the code paths behind what staff describe, step by step, and find where it goes wrong. Don't guess: say in your summary what the cause was.",
    "- Fix the cause with the smallest change that does it. Keep to this problem; don't redesign the feature.",
    "",
    "## Rules",
    "",
    ...BUILD_RULES,
  ].join("\n");

  return {
    title: `Fix: ${(feature?.summary ?? report.ownerWords.split("\n")[0]).slice(0, 200)}`,
    body,
    labels: [FEATURE_BUILD_LABEL],
  };
}

const pullRequestList = (builds: ReadonlyArray<PublishedBuild>) =>
  builds.map((build) => `- #${build.prNumber} (${build.kind === "add_more" ? "added more" : build.kind === "undo" ? "an earlier undo" : "first build"}) ${build.prUrl}`);

// Everything that went live for a feature, including the fixes made to it
// through Report a problem, oldest first.
export function featureHistory(
  feature: CapabilityRequestRow,
  all: ReadonlyArray<CapabilityRequestRow>,
): PublishedBuild[] {
  const fixes = all.filter((row) => row.fix?.feature?.id === feature.id).flatMap(featurePublishedBuilds);
  return [...featurePublishedBuilds(feature), ...fixes].sort((a, b) => a.mergedAt.localeCompare(b.mergedAt));
}

// "Add more": staff want a live feature to do more. Claude extends that
// feature, keeping the work inside it so it can be undone as one.
export function featureAddMoreIssue(feature: CapabilityRequestRow, all: ReadonlyArray<CapabilityRequestRow>): NewIssue {
  const lastLive = featurePublishedBuilds(feature).at(-1)?.mergedAt ?? "";
  // Asks filed after it last went live are the new ones.
  const newAsks = feature.alsoAsked.filter((ask) => ask.createdAt > lastLive).map((ask) => ask.ownerWords);
  const earlierAsks = [feature.ownerWords, ...feature.alsoAsked.filter((ask) => ask.createdAt <= lastLive).map((ask) => ask.ownerWords)];
  const quote = (words: string) => `> ${words.replace(/\n/g, "\n> ")}\n`;

  const body = [
    `<!-- rhythm-feature-request: ${feature.id} -->`,
    "## Add more to a live feature",
    "",
    `This feature is already on the live site: **${feature.summary}**`,
    "",
    "Staff now want it to do more. Extend this feature; don't build a separate one.",
    "",
    "## What staff want added",
    "",
    ...(newAsks.length > 0 ? newAsks.map(quote) : ["> (See the latest notes in the feature request.)\n"]),
    "## What was asked for originally",
    "",
    ...earlierAsks.map(quote),
    "## What's already built",
    "",
    ...pullRequestList(featureHistory(feature, all)),
    "",
    "Read those pull requests (`git log --merges --grep \"#N\"`, then `git diff <merge>^1 <merge>`) to see how the feature works today, then build on the same code.",
    "",
    "## How to build it",
    "",
    "- Keep every change inside this feature's own code and data, so the whole feature (original plus additions) can be undone later in one go. Don't change other features.",
    "- If what staff want is really a different feature, say so in a comment and stop instead of building it.",
    ...BUILD_RULES,
  ].join("\n");

  return {
    title: `Add more: ${feature.summary.slice(0, 200)}`,
    body,
    labels: [FEATURE_BUILD_LABEL],
  };
}

// "Undo this feature": take everything that went live for it off the site
// (its first build, every add-more and fix), leaving other features alone.
// Database updates stay: the columns they added are harmless once nothing
// uses them, and deleting migration files breaks the migration workflow.
export function featureUndoIssue(feature: CapabilityRequestRow, all: ReadonlyArray<CapabilityRequestRow>): NewIssue {
  const history = featureHistory(feature, all).filter((build) => build.kind !== "undo");
  const drafts = feature.events.map((event) => `- ${event.title} (${event.status}) — /admin/events/${event.id}`);

  const body = [
    `<!-- rhythm-feature-request: ${feature.id} -->`,
    "## Undo a live feature",
    "",
    `Staff want this feature taken off the live site: **${feature.summary}**`,
    "",
    "## Everything that went live for it",
    "",
    ...pullRequestList(history),
    "",
    "## How to undo it",
    "",
    "- Revert each of those pull requests' merge commits, newest first: find each with `git log --merges --grep \"#N\"` and run `git revert -m 1 --no-commit <merge>`.",
    "- Keep every file under supabase/migrations exactly as it is: after each revert, run `git checkout HEAD -- supabase/migrations` before you commit, so no migration is deleted or changed. Don't add a migration that drops anything: the columns and tables stay in the database, unused.",
    "- Other features must keep working. If a later change depends on this feature (a revert conflicts, or other code uses what it added), resolve it so the other feature still works without this one. If that isn't possible without breaking something, don't open a pull request: comment on this issue explaining in plain words what depends on it.",
    "- Events that use this feature will lose it; that's expected. Make sure their pages still load.",
    "",
    "## Drafts and events linked to it",
    "",
    ...(drafts.length > 0 ? drafts : ["- None."]),
    "",
    "## Rules",
    "",
    ...BUILD_RULES.filter((rule) => !rule.includes("supabase/migrations")),
  ].join("\n");

  return {
    title: `Undo: ${feature.summary.slice(0, 200)}`,
    body,
    labels: [FEATURE_BUILD_LABEL],
  };
}

// The issue Claude works from for this request: a fix for a live feature,
// more for a live feature, or a new feature.
export function buildIssueFor(row: CapabilityRequestRow, all: ReadonlyArray<CapabilityRequestRow>): NewIssue {
  if (row.addingMore) return featureAddMoreIssue(row, all);
  if (!row.fix) return featureBuildIssue(row);
  const feature = row.fix.feature ? (all.find((other) => other.id === row.fix?.feature?.id) ?? null) : null;
  return featureFixIssue(row, feature);
}

// What a new build for this request does.
export function buildKindFor(row: CapabilityRequestRow): FeatureBuildKind {
  return row.addingMore ? "add_more" : "build";
}

export async function requestFeatureBuild(
  supabase: SupabaseClient,
  github: GitHubIssuesClient,
  row: CapabilityRequestRow,
  issue: NewIssue = featureBuildIssue(row),
  kind: FeatureBuildKind = buildKindFor(row),
): Promise<{ ok: true; issueUrl: string } | { ok: false; error: string }> {
  const created = await github.createIssue(issue);
  if (!created.ok) return created;

  // The build columns are about to describe the new build, so a live one
  // they still describe (from before migration 20261111030000) moves into
  // the history first.
  const history = featurePublishedBuilds(row);
  const { error } = await supabase
    .from("capability_requests")
    .update({
      ...(row.status === "built" || kind !== "build" ? { build_kind: kind, published_builds: history } : {}),
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

// Sends staff's notes from testing a build back to Claude on its pull
// request. The Claude GitHub Action picks up the @claude mention and
// pushes fixes to the same branch, so the test site updates.
export function featureBuildFeedbackComment(feedback: string): string {
  const quoted = feedback.trim().slice(0, 4000).replace(/\n/g, "\n> ");
  return [
    "@claude Staff tried this on the test site and said:",
    "",
    `> ${quoted}`,
    "",
    "Please fix this on this branch. Staff watch your progress checklist from the admin, so word its items in plain English (no file names or code). Keep to this feature, follow CLAUDE.md, run `npm run typecheck`, and finish with a short summary and a `## How to test` section in plain words for a non-technical admin.",
  ].join("\n");
}

export async function sendFeatureBuildFeedback(
  github: GitHubIssuesClient,
  build: CapabilityRequestRow["build"],
  feedback: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const prNumber = build?.pullRequest?.state === "open" ? build.pullRequest.number : null;
  if (!prNumber) return { ok: false, error: "There's no build being tested for this request." };
  return github.addComment(prNumber, featureBuildFeedbackComment(feedback));
}

// "Approve and go live": merges the build's pull request. The webhook then
// marks the request Built, and its database changes reach the real site.
export async function approveFeatureBuild(
  github: GitHubIssuesClient,
  build: CapabilityRequestRow["build"],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const prNumber = build?.pullRequest?.state === "open" ? build.pullRequest.number : null;
  const issue = build?.issueUrl.match(/\/issues\/(\d+)$/)?.[1];
  if (!prNumber || !issue) return { ok: false, error: "There's no build waiting for approval." };
  return github.mergePullRequest(prNumber, new RegExp(`^claude/issue-${issue}(?:-|$)`));
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
// drafts, and the pull request joins the feature's history. Closed without
// merging → the link stays and Build it can be pressed again. Returns false
// when no request has that issue (a PR that isn't a feature build).
//
// An add-more or undo build is for a feature that's already live, so its
// status stays Built throughout (events using it aren't held up). When an
// add-more merges, the feature leaves Active; when an undo merges, it's
// marked removed.
export async function recordFeatureBuildPullRequest(
  supabase: SupabaseClient,
  event: FeatureBuildPullRequestEvent,
): Promise<{ ok: true; matched: boolean } | { ok: false; error: string }> {
  const found = await supabase
    .from("capability_requests")
    .select("id, published_builds, build_kind")
    .eq("build_issue_number", event.issueNumber);
  // Before migration 20261111030000 there's no history to keep.
  const rows = found.error ? null : ((found.data ?? []) as Array<{ id: string; published_builds: PublishedBuild[] | null; build_kind: FeatureBuildKind | null }>);
  if (found.error && !/published_builds|build_kind/.test(found.error.message)) return { ok: false, error: found.error.message };

  const base = {
    build_pr_number: event.prNumber,
    build_pr_url: event.prUrl,
    build_pr_state: event.state,
    ...(event.testSteps.length > 0 ? { build_test_steps: event.testSteps.join("\n") } : {}),
  };

  if (!rows) {
    const status = event.state === "open" ? "planned" : event.state === "merged" ? "built" : undefined;
    const { data, error } = await supabase
      .from("capability_requests")
      .update({ ...base, ...(status ? { status } : {}) })
      .eq("build_issue_number", event.issueNumber)
      .select("id");
    if (error) return { ok: false, error: error.message };
    return { ok: true, matched: (data ?? []).length > 0 };
  }

  for (const row of rows) {
    const kind = row.build_kind ?? "build";
    const history = Array.isArray(row.published_builds) ? row.published_builds : [];
    const now = new Date().toISOString();
    const changes: Record<string, unknown> = { ...base };
    if (event.state === "open" && kind === "build") changes.status = "planned";
    if (event.state === "merged") {
      changes.status = "built";
      changes.more_requested_at = null;
      if (!history.some((build) => build.prNumber === event.prNumber)) {
        changes.published_builds = [
          ...history,
          { prNumber: event.prNumber, prUrl: event.prUrl, issueNumber: event.issueNumber, mergedAt: now, kind },
        ];
      }
      if (kind === "undo") changes.removed_at = now;
    }
    const { error } = await supabase.from("capability_requests").update(changes).eq("id", row.id);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true, matched: rows.length > 0 };
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
