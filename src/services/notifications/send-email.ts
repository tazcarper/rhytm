import "server-only";
import type { ReactElement } from "react";
import { render, toPlainText } from "@react-email/render";
import { createServiceRoleClient } from "@/lib/supabase/service";

// `import "server-only"` blocks any "use client" module from reaching
// this file directly (build-time guardrail against the "I'll just
// import the EmailService into a component" mistake). The Server-Action
// transitive path our booking flow uses is laundered through Next's
// server-only webpack layer, so the action → service → email chain
// is unaffected.
//
// We render via `@react-email/render` rather than `react-dom/server`
// directly because React 19 + Next.js 16 explicitly ban
// `react-dom/server` from React Server Component contexts. React's
// own `react-dom/server.react-server.js` throws on import:
// "react-dom/server is not supported in React Server Components."
// `@react-email/render` ships a server-safe entry point (it resolves
// to a non-react-server variant via package conditions) AND post-
// processes the HTML for inbox compatibility (inline CSS, doctype,
// quoted-printable safety, optional plaintext alt). App 8 swaps the
// TRANSPORT (LoggingEmailService → ResendEmailService); the renderer
// is now production-ready and stays put.

// Notifications boundary — App 2.9 confirmation-email shim.
//
// Dependency-inversion pattern (see CLAUDE.md "Design Principles — SOLID").
// Callers depend on the `EmailService` interface, not on a transport.
// Today two implementations satisfy it:
//
//   - LoggingEmailService  writes to dev_email_outbox (dev-only shim).
//   - NoopEmailService     for tests; returns ok without writing.
//
// App 8 replaces the factory's selection with a ResendEmailService that
// satisfies the same interface. No caller change required.
//
// Email rendering: `@react-email/render`. One async `render()` call
// produces the HTML; `toPlainText()` derives the plaintext alt from
// that HTML string directly (via html-to-text under the hood) instead
// of re-rendering the React tree.

export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  // The rendered React element. The service is responsible for
  // converting it to HTML / sending it via the transport. Callers
  // pre-render only if they want to log the HTML alongside; today
  // LoggingEmailService renders internally so the template is the
  // single source of truth.
  template: {
    name: string; // logical identifier — e.g. "guest_booking_confirmation"
    element: ReactElement;
    // Raw props the element was created from. Kept so debugging a render
    // bug doesn't require re-walking the funnel. The interface is
    // narrow on purpose — JSON.stringify must succeed on this value.
    props: Record<string, unknown>;
  };
  // Free-form tag for the originator of the send (booking flow, RSVP,
  // partner invite, etc). Today: "public_booking".
  source: string;
}

export interface EmailSendResult {
  ok: boolean;
  // The shim returns the outbox row id when a write happens; real
  // transports return the provider's message id. Either is opaque to
  // callers.
  id?: string;
  // Error message when ok=false. Caller logs and decides whether to
  // surface to the user — App 2 callers explicitly do not (booking
  // succeeded; the email is best-effort).
  error?: string;
}

export interface EmailService {
  send(input: EmailMessage): Promise<EmailSendResult>;
}

// ---- LoggingEmailService ---------------------------------------------------
// Writes the rendered email to dev_email_outbox via the service-role
// client. dev_email_outbox is RLS-enabled with no policies (see migration
// 20260521080000_create_dev_email_outbox.sql) — only the service role can
// read or write it.

export class LoggingEmailService implements EmailService {
  async send(input: EmailMessage): Promise<EmailSendResult> {
    const supabase = createServiceRoleClient();
    let bodyHtml: string;
    let bodyText: string;
    try {
      bodyHtml = await render(input.template.element);
      bodyText = toPlainText(bodyHtml);
    } catch (err) {
      const message = err instanceof Error ? err.message : "render failed";
      return { ok: false, error: `Template render failed: ${message}` };
    }

    const { data, error } = await supabase
      .from("dev_email_outbox")
      .insert({
        source: input.source,
        template_name: input.template.name,
        to_email: input.to,
        from_email: input.from,
        subject: input.subject,
        body_html: bodyHtml,
        body_text: bodyText,
        payload: input.template.props,
      })
      .select("id")
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data.id };
  }
}

// ---- NoopEmailService ------------------------------------------------------
// Test stub. Returns ok unconditionally; never touches the DB or any
// transport. Liskov-substitutable for the interface — used in unit tests
// where the booking-creation path is the system under test and the
// email side-effect is irrelevant.

export class NoopEmailService implements EmailService {
  async send(_input: EmailMessage): Promise<EmailSendResult> {
    return { ok: true };
  }
}

// ---- Factory ---------------------------------------------------------------
// Env-driven selection. NODE_ENV === "test" → noop; everything else →
// logging shim. App 8 introduces a "resend" branch reading from a new
// env var (e.g. EMAIL_TRANSPORT=resend) without changing this signature.

export function getEmailService(): EmailService {
  if (process.env.NODE_ENV === "test") {
    return new NoopEmailService();
  }
  return new LoggingEmailService();
}

// ---- Origin helper ---------------------------------------------------------
// Single source for the absolute origin emails point at. NEXT_PUBLIC_SITE_URL
// is the standard Next.js convention; the localhost fallback keeps `npm run
// dev` working with no extra env wiring. Document the var in .env.local.
//
// Defined here (not in `lib/`) because today the only consumer is the
// notifications service that needs an absolute URL for email links. Move
// to `lib/env.ts` when a second consumer surfaces.

export function getSiteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return "http://localhost:3000";
}

// Convention. Real `from` lives in env in App 8 (Resend "verified
// sender" — pre-launch DNS work). Local dev shim uses an obvious
// placeholder so /dev/emails reviewers know it isn't real.
export const DEFAULT_FROM_EMAIL = "no-reply@rhythm.local";
