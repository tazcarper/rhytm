import "server-only";
import type { ReactElement } from "react";
import { render, toPlainText } from "@react-email/render";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { ResendEmailService } from "./resend-email-service";

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
  // Per-send unique scope for transport-level idempotency. The Resend
  // transport combines this with source/template/to so retries of the
  // same logical send collapse, while two separate sends (e.g. two
  // different bids from the same email) stay distinct. Use a stable
  // domain id: `bid:<bidId>`, `payment_intent:<piId>`, `refund:<id>`.
  idempotencyKey?: string;
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

    // Dev visibility: print a compact block to the server terminal so you can
    // watch sends fire without opening /dev/emails. Only the dev shim does
    // this — the Resend transport never logs (it's the real send).
    logEmailToConsole({
      kind: "transactional",
      label: input.template.name,
      to: input.to,
      subject: input.subject,
      source: input.source,
      outboxId: data.id,
    });

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
// Env-driven selection:
//   NODE_ENV === "test"         → NoopEmailService (silent, for tests)
//   EMAIL_TRANSPORT === "resend" → ResendEmailService (real delivery, App 8)
//   default                      → LoggingEmailService (dev_email_outbox)
//
// Resend branch requires RESEND_API_KEY. If EMAIL_TRANSPORT is set to
// "resend" but the key is missing we log a warning and fall back to
// the logging shim — emails go to dev_email_outbox instead of getting
// dropped. Callers (best-effort sends) don't care; this is a safety
// net for misconfigured deploys.

export function getEmailService(): EmailService {
  if (process.env.NODE_ENV === "test") {
    return new NoopEmailService();
  }

  if (process.env.EMAIL_TRANSPORT === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const replyTo = process.env.RESEND_REPLY_TO?.trim() || null;
      return new ResendEmailService(apiKey, replyTo);
    }
    console.warn(
      "[notifications] EMAIL_TRANSPORT=resend but RESEND_API_KEY is not set; falling back to LoggingEmailService.",
    );
  }

  return new LoggingEmailService();
}

// ---- Origin helper ---------------------------------------------------------
// Single source for the absolute origin emails point at. Resolution order:
//   1. NEXT_PUBLIC_SITE_URL — explicit override (custom domain, staging).
//   2. VERCEL_PROJECT_PRODUCTION_URL — Vercel auto-injects the stable
//      production domain (e.g. rhytm-one.vercel.app) into every deployment,
//      including previews. Emails always link to production, never an
//      ephemeral preview URL. This is why a preview/prod deploy with no
//      explicit override no longer leaks localhost into links.
//   3. http://localhost:3000 — keeps `npm run dev` working with no env wiring.
//
// This runs server-side only (email send paths), so the non-public
// VERCEL_PROJECT_PRODUCTION_URL is available.
//
// Defined here (not in `lib/`) because today the only consumer is the
// notifications service that needs an absolute URL for email links. Move
// to `lib/env.ts` when a second consumer surfaces.

export function getSiteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProductionUrl) {
    return `https://${vercelProductionUrl.replace(/\/+$/, "")}`;
  }

  return "http://localhost:3000";
}

// The "From" header used by callers when they don't pass one explicitly,
// in the standard "Display Name <address>" form (Resend + the dev shim both
// accept it verbatim).
//
//   - Address: RESEND_FROM_EMAIL when set (production / staging where the
//     domain is verified in Resend — currently bookings@send.rhythm.co),
//     falling back to a clearly-fake local placeholder so dev reviewers know
//     a LoggingEmailService row isn't a real delivery.
//   - Display name: RESEND_FROM_NAME when set, else the umbrella brand
//     "Rhythm Outdoors". Keeping the name aligned with the verified sending
//     domain builds recipient trust and helps deliverability.
//
// Callers reference DEFAULT_FROM_EMAIL as a constant for backward
// compatibility — they shouldn't read process.env themselves.
const DEFAULT_FROM_NAME = process.env.RESEND_FROM_NAME?.trim() || "Rhythm Outdoors";
const DEFAULT_FROM_ADDRESS =
  process.env.RESEND_FROM_EMAIL?.trim() || "no-reply@rhythm.local";

export const DEFAULT_FROM_EMAIL = `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_ADDRESS}>`;

// ---- Dev console logging ---------------------------------------------------
// One formatted block per email, printed to the dev server terminal. Used by
// both the transactional shim (LoggingEmailService) and the auth-email
// recorder below so every "send" is visible in one place while developing.

function logEmailToConsole(entry: {
  kind: "transactional" | "auth";
  label: string; // template name or auth email type
  to: string;
  subject: string;
  source: string;
  outboxId?: string;
  actionLink?: string | null;
}): void {
  const tag = entry.kind === "auth" ? "auth email" : "email";
  const lines = [
    "",
    `📧 [${tag}] ${entry.label} → ${entry.to}`,
    `   source:  ${entry.source}`,
    `   subject: ${entry.subject}`,
  ];
  if (entry.actionLink) lines.push(`   link:    ${entry.actionLink}`);
  if (entry.outboxId) lines.push(`   outbox:  ${entry.outboxId}  ·  view at /dev/emails`);
  lines.push(
    entry.kind === "auth"
      ? "   (sent by Supabase Auth — dev marker, no real email sent)"
      : "   (dev shim — no real email sent)",
  );
  lines.push("");
  console.info(lines.join("\n"));
}

// ---- Auth-email recorder (dev) ---------------------------------------------
// Supabase Auth emails (invites, magic links, recovery) are sent by Supabase's
// own servers, NOT through EmailService — so they never reach dev_email_outbox
// and stay invisible to /dev/emails. This records a marker row for them in dev
// so they show up alongside transactional mail, and always console-logs the
// trigger. Best-effort: it never throws into the auth flow.
//
// No-op for the outbox write once real delivery is configured
// (EMAIL_TRANSPORT=resend) or under test — mirrors getEmailService()'s gate so
// production never accrues fake rows. The console line is dev-only in practice
// because these call sites run server-side and prod logs are separate anyway.

export interface DevAuthEmailRecord {
  source: string; // originator, e.g. "instructor_invite", "team_invite"
  type: "invite" | "magic_link" | "recovery";
  to: string;
  subject?: string;
  // Present when the caller used generateLink (resend flows); absent for
  // inviteUserByEmail, which sends without handing back the link.
  actionLink?: string | null;
}

const AUTH_EMAIL_SUBJECTS: Record<DevAuthEmailRecord["type"], string> = {
  invite: "You're invited — set up your account",
  magic_link: "Your sign-in link",
  recovery: "Reset your password",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function recordDevAuthEmail(record: DevAuthEmailRecord): Promise<void> {
  // Strictly a development aid: never run in production (don't write recipient
  // emails / magic sign-in links to prod server logs) or under test.
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test") {
    return;
  }

  const subject = record.subject ?? AUTH_EMAIL_SUBJECTS[record.type];

  logEmailToConsole({
    kind: "auth",
    label: record.type,
    to: record.to,
    subject,
    source: record.source,
    actionLink: record.actionLink ?? null,
  });

  // Skip the dev-outbox write when a real transport is configured in dev.
  if (process.env.EMAIL_TRANSPORT === "resend") {
    return;
  }

  const linkBlock = record.actionLink
    ? `<p style="margin:16px 0"><strong>Action link</strong><br/><a href="${escapeHtml(record.actionLink)}">${escapeHtml(record.actionLink)}</a></p>`
    : `<p style="margin:16px 0;color:#666">Sent by Supabase Auth — the HTML is rendered on Supabase's side, so it isn't captured here. <code>inviteUserByEmail</code> doesn't return the link; use <strong>Resend link</strong> to get a usable URL.</p>`;
  const bodyHtml = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#282f15;padding:24px">
    <h2 style="margin:0 0 8px">${escapeHtml(subject)}</h2>
    <p style="margin:0;color:#666"><strong>Type:</strong> ${escapeHtml(record.type)} &middot; <strong>To:</strong> ${escapeHtml(record.to)}</p>
    ${linkBlock}
    <hr style="border:none;border-top:1px solid #ddd;margin:24px 0"/>
    <p style="color:#999;font-size:13px">Dev marker — no real email was sent.</p>
  </body></html>`;

  try {
    const supabase = createServiceRoleClient();
    await supabase.from("dev_email_outbox").insert({
      source: record.source,
      template_name: `auth_${record.type}`,
      to_email: record.to,
      from_email: "supabase-auth@rhythm.local",
      subject,
      body_html: bodyHtml,
      body_text: record.actionLink ?? subject,
      payload: { type: record.type, actionLink: record.actionLink ?? null },
    });
  } catch (err) {
    // Best-effort dev logging — never let an outbox hiccup break the invite.
    console.warn("[notifications] recordDevAuthEmail outbox write failed:", err);
  }
}
