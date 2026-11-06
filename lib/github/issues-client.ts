// A narrow GitHub client for one repo: open an issue, comment, and merge a
// pull request. Reads GITHUB_BUILD_TOKEN (fine-grained token on the repo
// with Issues, Pull requests and Contents: read and write) and
// GITHUB_BUILD_REPO ("owner/name"). Server only.

export interface NewIssue {
  title: string;
  body: string;
  labels: ReadonlyArray<string>;
}

export interface CreatedIssue {
  number: number;
  url: string;
}

export interface IssueComment {
  author: string;
  body: string;
  updatedAt: string;
}

export interface PullRequestSummary {
  number: number;
  url: string;
  state: "open" | "merged" | "closed";
  body: string;
  headRef: string;
}

export interface GitHubIssuesClient {
  createIssue(issue: NewIssue): Promise<{ ok: true; issue: CreatedIssue } | { ok: false; error: string }>;
  // Comments on an issue or pull request (they share numbers).
  addComment(number: number, body: string): Promise<{ ok: true } | { ok: false; error: string }>;
  // The latest comments on an issue or pull request (up to 100).
  listComments(number: number): Promise<{ ok: true; comments: IssueComment[] } | { ok: false; error: string }>;
  // The most recently updated pull request whose head branch matches.
  findPullRequest(branch: RegExp): Promise<{ ok: true; pullRequest: PullRequestSummary | null } | { ok: false; error: string }>;
  // Merges a pull request only if its head branch is still `expectedBranch`
  // (so an id mix-up can't merge the wrong one).
  mergePullRequest(number: number, expectedBranch: RegExp): Promise<{ ok: true } | { ok: false; error: string }>;
}

// Null when the env vars aren't set, so callers can say the button isn't
// set up yet instead of failing.
export function createGitHubIssuesClient(): GitHubIssuesClient | null {
  const token = process.env.GITHUB_BUILD_TOKEN;
  const repo = process.env.GITHUB_BUILD_REPO;
  if (!token || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;

  const send = async (
    method: "GET" | "POST" | "PUT",
    path: string,
    body?: unknown,
  ): Promise<{ ok: true; data: unknown } | { ok: false; status?: number; error: string }> => {
    let response: Response;
    try {
      response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
      });
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Couldn't reach GitHub." };
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[github]", method, path, "failed", response.status, detail.slice(0, 500));
      return { ok: false, status: response.status, error: `GitHub said ${response.status}.` };
    }
    return { ok: true, data: await response.json() };
  };
  const post = (path: string, body: unknown) => send("POST", path, body);

  return {
    async createIssue(issue) {
      const result = await post("/issues", { title: issue.title, body: issue.body, labels: issue.labels });
      if (!result.ok) return result;
      const data = result.data as { number: number; html_url: string };
      return { ok: true, issue: { number: data.number, url: data.html_url } };
    },
    async addComment(number, body) {
      const result = await post(`/issues/${number}/comments`, { body });
      return result.ok ? { ok: true } : result;
    },
    async listComments(number) {
      const result = await send("GET", `/issues/${number}/comments?per_page=100`);
      if (!result.ok) return result;
      const data = result.data as Array<{ body?: string | null; updated_at: string; user?: { login?: string } | null }>;
      return {
        ok: true,
        comments: data.map((comment) => ({
          author: comment.user?.login ?? "",
          body: comment.body ?? "",
          updatedAt: comment.updated_at,
        })),
      };
    },
    async findPullRequest(branch) {
      const result = await send("GET", "/pulls?state=all&sort=updated&direction=desc&per_page=100");
      if (!result.ok) return result;
      const data = result.data as Array<{
        number: number;
        html_url: string;
        state: string;
        merged_at: string | null;
        body: string | null;
        head: { ref: string };
      }>;
      const match = data.find((pr) => branch.test(pr.head.ref));
      return {
        ok: true,
        pullRequest: match
          ? {
              number: match.number,
              url: match.html_url,
              state: match.merged_at ? "merged" : match.state === "open" ? "open" : "closed",
              body: match.body ?? "",
              headRef: match.head.ref,
            }
          : null,
      };
    },
    async mergePullRequest(number, expectedBranch) {
      const pr = await send("GET", `/pulls/${number}`);
      if (!pr.ok) return pr;
      const info = pr.data as { state: string; merged: boolean; draft: boolean; head: { ref: string } };
      if (info.merged) return { ok: true };
      if (info.state !== "open" || !expectedBranch.test(info.head.ref)) {
        return { ok: false, error: "This build isn't waiting for approval any more." };
      }
      if (info.draft) return { ok: false, error: "Claude didn't finish this build, so it can't go live. Build it again." };
      const merged = await send("PUT", `/pulls/${number}/merge`, { merge_method: "merge" });
      if (merged.ok) return { ok: true };
      if (merged.status === 405 || merged.status === 409) {
        return { ok: false, error: "It can't go live yet: it clashes with other recent changes or its checks haven't passed. Ask your developer." };
      }
      return merged;
    },
  };
}
