import { createElement } from "react";
import { BuildPublishedNotice, type BuildPublishedNoticeProps } from "@/src/components/email/templates/build-published-notice";
import { DEFAULT_FROM_EMAIL, getEmailService, getSiteOrigin, type EmailService } from "@/src/services/notifications/send-email";
import { buildOwnerEmails, type BuildRisk } from "@/src/services/ai/build-risk";

// Emails the owner(s) in BUILD_OWNER_EMAILS when staff publish a build
// that needed care (see build-risk.ts). Best effort: a failed email is
// logged and never undoes or blocks the publish.
export async function notifyOwnersOfPublish(
  input: { summary: string; risk: BuildRisk; publishedBy: string; pullRequestUrl: string | null },
  email: EmailService = getEmailService(),
): Promise<void> {
  const props: BuildPublishedNoticeProps = {
    summary: input.summary,
    publishedBy: input.publishedBy,
    reasons: input.risk.reasons,
    pullRequestUrl: input.pullRequestUrl,
    requestsUrl: `${getSiteOrigin()}/admin/events/feature-requests?view=done`,
  };
  for (const to of buildOwnerEmails()) {
    const result = await email
      .send({
        to,
        from: DEFAULT_FROM_EMAIL,
        subject: `Published: ${input.summary.slice(0, 120)}`,
        template: { name: "build_published_notice", element: createElement(BuildPublishedNotice, props), props: { ...props } },
        source: "feature_build_publish",
        idempotencyKey: `build-published:${input.pullRequestUrl ?? input.summary}:${to}`,
      })
      .catch((error: unknown) => ({ ok: false, error: String(error) }));
    if (!result.ok) console.error("[feature-builds] owner publish email failed:", result.error);
  }
}
