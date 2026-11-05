import { createServiceRoleClient } from "@/lib/supabase/service";
import { isValidGitHubSignature } from "@/lib/github/webhook-signature";
import { recordFeatureBuildPreview, recordFeatureBuildPullRequest } from "@/src/services/ai/feature-builds";
import { parseFeatureBuildDeployment, parseFeatureBuildPullRequest } from "@/src/services/github/pull-request-event";

// GitHub webhook (repo Settings → Webhooks, "Pull requests" and
// "Deployment statuses" events). Moves a feature request along when
// Claude's pull request for it opens (Planned) or merges (Built), and saves
// its Vercel preview link. Updates are idempotent, so retries are harmless.
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
  if (eventName !== "pull_request" && eventName !== "deployment_status") return new Response("ignored");

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  if (eventName === "deployment_status") {
    const preview = parseFeatureBuildDeployment(payload);
    if (!preview) return new Response("not a feature build preview");
    const saved = await recordFeatureBuildPreview(createServiceRoleClient(), preview);
    if (!saved.ok) {
      console.error("[github webhook] couldn't save the preview link", saved.error);
      return new Response("update failed", { status: 500 });
    }
    return new Response(saved.matched ? "preview saved" : "no matching request");
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
