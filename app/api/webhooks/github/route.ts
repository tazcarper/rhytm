import { createServiceRoleClient } from "@/lib/supabase/service";
import { isValidGitHubSignature } from "@/lib/github/webhook-signature";
import { recordFeatureBuildPullRequest } from "@/src/services/ai/feature-builds";
import { parseFeatureBuildPullRequest } from "@/src/services/github/pull-request-event";

// GitHub webhook (repo Settings → Webhooks, "Pull requests" events). Moves
// a feature request along when Claude's pull request for it opens (Planned)
// or merges (Built). Updates are idempotent, so retries are harmless.
export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[github webhook] GITHUB_WEBHOOK_SECRET is not set");
    return new Response("webhook not configured", { status: 500 });
  }

  const rawBody = await req.text();
  if (!isValidGitHubSignature(rawBody, req.headers.get("x-hub-signature-256"), secret)) {
    return new Response("invalid signature", { status: 401 });
  }

  const eventName = req.headers.get("x-github-event");
  if (eventName === "ping") return new Response("pong");
  if (eventName !== "pull_request") return new Response("ignored");

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const event = parseFeatureBuildPullRequest(payload);
  if (!event) return new Response("not a feature build");

  const result = await recordFeatureBuildPullRequest(createServiceRoleClient(), event);
  if (!result.ok) {
    console.error("[github webhook] couldn't update the feature request", result.error);
    return new Response("update failed", { status: 500 });
  }
  return new Response(result.matched ? "updated" : "no matching request");
}
