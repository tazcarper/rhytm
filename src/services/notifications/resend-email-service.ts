import "server-only";
import { Resend } from "resend";
import { render, toPlainText } from "@react-email/render";
import type {
  EmailMessage,
  EmailSendResult,
  EmailService,
} from "./send-email";

// Real email transport — Resend. The activation half of App 8.
//
// Same EmailService contract as LoggingEmailService:
//   - Takes an EmailMessage with a rendered React element + props
//   - Returns { ok, id } / { ok: false, error }
//   - Best-effort: caller logs failures and continues
//
// Differences from LoggingEmailService:
//   - Renders + sends via Resend's REST API instead of writing to
//     dev_email_outbox.
//   - Includes a per-call `idempotencyKey` so retries from the calling
//     Server Action / webhook handler don't fan out into duplicate
//     sends in Resend.
//   - Sets `reply_to` from RESEND_REPLY_TO so customer replies route
//     to a real inbox (Resend's default reply behavior bounces).
//
// Dormant in dev: the factory (getEmailService in send-email.ts) only
// returns this when EMAIL_TRANSPORT === "resend". Local development
// continues to use LoggingEmailService → dev_email_outbox.

export class ResendEmailService implements EmailService {
  private readonly client: Resend;
  private readonly replyTo: string | null;

  constructor(apiKey: string, replyTo: string | null) {
    this.client = new Resend(apiKey);
    this.replyTo = replyTo;
  }

  async send(input: EmailMessage): Promise<EmailSendResult> {
    // Same render path as LoggingEmailService — render once, derive
    // plaintext from HTML (avoids a second React render pass).
    let html: string;
    let text: string;
    try {
      html = await render(input.template.element);
      text = toPlainText(html);
    } catch (err) {
      const message = err instanceof Error ? err.message : "render failed";
      return { ok: false, error: `Template render failed: ${message}` };
    }

    // Idempotency key. Resend's idempotency cache returns the same
    // result for the same key within a 24h window. We include the
    // caller-supplied per-send scope (bid id / payment intent / refund
    // id) so two separate sends with the same source/template/recipient
    // (e.g. the same email creating two bids) stay distinct. The
    // source/template/to prefix keeps the key human-readable in logs.
    // NOT a security guarantee — just prevents accidental fan-out.
    const scope = input.idempotencyKey ?? "default";
    const idempotencyKey = `${input.source}-${input.template.name}-${input.to}-${scope}`;

    try {
      const result = await this.client.emails.send(
        {
          from: input.from,
          to: input.to,
          subject: input.subject,
          html,
          text,
          ...(this.replyTo ? { replyTo: this.replyTo } : {}),
        },
        { idempotencyKey },
      );

      if (result.error) {
        return {
          ok: false,
          error: result.error.message ?? "Resend rejected the send.",
        };
      }
      return { ok: true, id: result.data?.id };
    } catch (err) {
      // Network failures, malformed responses, etc. — surface a stable
      // error message; the caller already knows not to bubble this to
      // the user.
      const message =
        err instanceof Error ? err.message : "Resend SDK threw.";
      return { ok: false, error: message };
    }
  }
}
