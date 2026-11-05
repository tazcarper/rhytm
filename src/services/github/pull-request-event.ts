import type { FeatureBuildPreviewEvent, FeatureBuildPullRequestEvent } from "@/src/services/ai/feature-builds";

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

const HANDLED_ACTIONS = new Set(["opened", "reopened", "ready_for_review", "edited", "closed"]);

// The issue number in a feature build's branch name (claude/issue-<n>-…).
function issueFromBranch(ref: string | undefined): number | null {
  const match = ref?.match(/^claude\/issue-(\d+)(?:-|$)/);
  return match ? Number(match[1]) : null;
}

// The numbered or bulleted lines under "## How to test" in a PR body,
// without their numbers. At most 10, each at most 300 characters.
export function parseTestSteps(body: string | null | undefined): string[] {
  const section = body?.match(/^#{2,4}\s*How to test\s*$([\s\S]*?)(?=^#{1,4}\s|(?![\s\S]))/im)?.[1] ?? "";
  return section
    .split("\n")
    .map((line) => line.match(/^\s*(?:\d+[.)]|[-*])\s+(.*\S)\s*$/)?.[1] ?? "")
    .filter((step) => step !== "")
    .slice(0, 10)
    .map((step) => step.slice(0, 300));
}

// Finds the feature-request issue a pull request builds. The Claude action
// names its branch claude/issue-<n>-…, and the workflow writes "Closes #<n>"
// in the body. Null for anything else.
export function parseFeatureBuildPullRequest(payload: unknown): FeatureBuildPullRequestEvent | null {
  const { action, pull_request: pr } = (payload ?? {}) as PullRequestPayload;
  if (!action || !HANDLED_ACTIONS.has(action) || !pr?.number || !pr.html_url) return null;

  const fromBranch = issueFromBranch(pr.head?.ref);
  const fromBody = pr.body?.match(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?) #(\d+)\b/i)?.[1];
  const issue = fromBranch ?? (fromBody ? Number(fromBody) : null);
  if (!issue) return null;

  return {
    issueNumber: Number(issue),
    prNumber: pr.number,
    prUrl: pr.html_url,
    state: action === "closed" ? (pr.merged ? "merged" : "closed") : "open",
    testSteps: parseTestSteps(pr.body),
  };
}

// The parts of GitHub's deployment_status webhook payload we read. Vercel
// reports each preview deployment this way.
interface DeploymentStatusPayload {
  deployment_status?: { state?: string; environment_url?: string | null; target_url?: string | null };
  deployment?: { ref?: string; environment?: string };
}

// A successful preview of a feature build's branch, or null.
export function parseFeatureBuildDeployment(payload: unknown): FeatureBuildPreviewEvent | null {
  const { deployment_status: status, deployment } = (payload ?? {}) as DeploymentStatusPayload;
  if (status?.state !== "success") return null;
  if (deployment?.environment && /production/i.test(deployment.environment)) return null;
  const issueNumber = issueFromBranch(deployment?.ref);
  const url = status.environment_url || status.target_url;
  if (!issueNumber || !url || !/^https:\/\//.test(url)) return null;
  return { issueNumber, previewUrl: url.replace(/\/+$/, "") };
}
