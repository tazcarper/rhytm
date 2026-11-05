// A narrow GitHub client: it can open an issue in one repo, nothing else.
// Reads GITHUB_BUILD_TOKEN (fine-grained token with Issues: read and
// write on the repo) and GITHUB_BUILD_REPO ("owner/name"). Server only.

export interface NewIssue {
  title: string;
  body: string;
  labels: ReadonlyArray<string>;
}

export interface CreatedIssue {
  number: number;
  url: string;
}

export interface GitHubIssuesClient {
  createIssue(issue: NewIssue): Promise<{ ok: true; issue: CreatedIssue } | { ok: false; error: string }>;
}

// Null when the env vars aren't set, so callers can say the button isn't
// set up yet instead of failing.
export function createGitHubIssuesClient(): GitHubIssuesClient | null {
  const token = process.env.GITHUB_BUILD_TOKEN;
  const repo = process.env.GITHUB_BUILD_REPO;
  if (!token || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;

  return {
    async createIssue(issue) {
      let response: Response;
      try {
        response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
          method: "POST",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title: issue.title, body: issue.body, labels: issue.labels }),
          cache: "no-store",
        });
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Couldn't reach GitHub." };
      }
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        console.error("[github] create issue failed", response.status, detail.slice(0, 500));
        return { ok: false, error: `GitHub said ${response.status}.` };
      }
      const data = (await response.json()) as { number: number; html_url: string };
      return { ok: true, issue: { number: data.number, url: data.html_url } };
    },
  };
}
