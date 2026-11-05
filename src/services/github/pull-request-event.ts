import type { FeatureBuildPullRequestEvent } from "@/src/services/ai/feature-builds";

// The parts of GitHub's pull_request webhook payload we read.
interface PullRequestPayload {
  action?: string;
  pull_request?: {
    number?: number;
    html_url?: string;
    merged?: boolean;
    body?: string | null;
    head?: { ref?: string };
  };
}

const HANDLED_ACTIONS = new Set(["opened", "reopened", "ready_for_review", "closed"]);

// Finds the feature-request issue a pull request builds. The Claude action
// names its branch claude/issue-<n>-…, and the workflow writes "Closes #<n>"
// in the body. Null for anything else.
export function parseFeatureBuildPullRequest(payload: unknown): FeatureBuildPullRequestEvent | null {
  const { action, pull_request: pr } = (payload ?? {}) as PullRequestPayload;
  if (!action || !HANDLED_ACTIONS.has(action) || !pr?.number || !pr.html_url) return null;

  const fromBranch = pr.head?.ref?.match(/^claude\/issue-(\d+)(?:-|$)/)?.[1];
  const fromBody = pr.body?.match(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?) #(\d+)\b/i)?.[1];
  const issue = fromBranch ?? fromBody;
  if (!issue) return null;

  return {
    issueNumber: Number(issue),
    prNumber: pr.number,
    prUrl: pr.html_url,
    state: action === "closed" ? (pr.merged ? "merged" : "closed") : "open",
  };
}
