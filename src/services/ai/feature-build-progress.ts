import type { GitHubIssuesClient, IssueComment } from "@/lib/github/issues-client";
import type { FeatureBuild } from "@/src/services/ai/capability-requests";

// Claude's progress on a build, for the admin card. While it works, the
// Claude GitHub Action keeps one comment on the issue (or on the pull
// request, when it's fixing staff feedback) with a checklist it ticks off.
// This reads that comment and turns it into plain steps.

export interface BuildProgressStep {
  done: boolean;
  text: string;
}

export interface BuildProgress {
  state: "working" | "finished" | "error";
  steps: ReadonlyArray<BuildProgressStep>;
  updatedAt: string;
}

const CLAUDE_BOT = "claude[bot]";

// Markdown → plain text: drop code ticks, keep link text, drop emphasis.
function plain(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .trim();
}

export function parseBuildProgress(comment: IssueComment): BuildProgress {
  const header = comment.body.slice(0, 300);
  const state: BuildProgress["state"] = /is working/i.test(header)
    ? "working"
    : /encountered an error|was cancelled|failed/i.test(header)
      ? "error"
      : "finished";
  const steps = comment.body
    .split("\n")
    .map((line) => line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({ done: match[1].toLowerCase() === "x", text: plain(match[2]) }))
    .filter((step) => step.text !== "")
    .slice(0, 20);
  return { state, steps, updatedAt: comment.updatedAt };
}

// The newest Claude comment across the build's issue and its pull request.
// Null when there isn't one yet, or GitHub can't be reached (the card then
// shows its usual text).
export async function getBuildProgress(
  github: GitHubIssuesClient,
  build: FeatureBuild,
): Promise<BuildProgress | null> {
  const issueNumber = Number(build.issueUrl.match(/\/issues\/(\d+)$/)?.[1] ?? NaN);
  const numbers = [issueNumber, build.pullRequest?.state === "open" ? build.pullRequest.number : null].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  const lists = await Promise.all(numbers.map((number) => github.listComments(number)));
  const latest = lists
    .flatMap((list) => (list.ok ? list.comments : []))
    .filter((comment) => comment.author === CLAUDE_BOT)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return latest ? parseBuildProgress(latest) : null;
}

// Progress for each request that's being built or tested, keyed by id.
export async function getBuildProgressFor(
  github: GitHubIssuesClient,
  builds: ReadonlyArray<{ id: string; build: FeatureBuild | null }>,
): Promise<Record<string, BuildProgress>> {
  const active = builds.filter(
    (row): row is { id: string; build: FeatureBuild } =>
      row.build !== null && (row.build.pullRequest === null || row.build.pullRequest.state === "open"),
  );
  const results = await Promise.all(active.map(async (row) => [row.id, await getBuildProgress(github, row.build)] as const));
  return Object.fromEntries(results.filter((entry): entry is readonly [string, BuildProgress] => entry[1] !== null));
}
