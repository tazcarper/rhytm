// ⚠️ DEPRECATED — Dropbox Sign webhook (App 7 vendor path).
// Superseded by the in-house typed-signature waiver (src/services/waiver/*),
// which records signatures synchronously and needs no webhook. Kept INTACT
// as a revivable fallback — NOT deleted. Only receives events while
// WAIVER_PROVIDER=dropbox_sign (see lib/waiver/provider.ts). Don't extend;
// revival steps in src/services/dropbox-sign/DEPRECATED.md.

import { EventCallbackHelper, EventCallbackRequest } from "@dropbox/sign";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  handleSignatureEvent,
  type DropboxSignEventPayload,
} from "@/src/services/dropbox-sign/handle-signature-event";

// Dropbox Sign webhook endpoint. Same Phase 6 idempotency pattern as
// the Stripe webhook (see app/api/webhooks/stripe/route.ts). Three
// differences:
//
//   1. Signature verification uses the SDK's EventCallbackHelper.isValid()
//      — the canonical HMAC-SHA256(event_time + event_type, api_key)
//      implementation. We use it directly to avoid reimplementing the
//      scheme by hand.
//   2. Dropbox Sign expects the response body to literally contain
//      the string "Hello API Event Received" — if it doesn't, they
//      treat it as a failure and keep retrying. (Yes, really. Their
//      legacy quirk from the HelloSign era.)
//   3. Payload arrives as `multipart/form-data` with a `json` field
//      containing the event body. Not application/json. We parse it
//      out before HMAC + dispatch.
//
// Dormant when env not configured: returns 503 if no API key is set.

export const runtime = "nodejs";

const ACK_BODY = "Hello API Event Received";

export async function POST(req: Request): Promise<Response> {
  // Dropbox Sign signs webhook callbacks with the account API key by
  // default. Paid plans MAY surface a distinct "Callback Signing Key"
  // — if so, set `DROPBOX_SIGN_WEBHOOK_SECRET` and it takes precedence.
  // For free / typical setups, having `DROPBOX_SIGN_API_KEY` set is
  // enough; this fallback chain handles both.
  const webhookSecret =
    process.env.DROPBOX_SIGN_WEBHOOK_SECRET ??
    process.env.DROPBOX_SIGN_API_KEY;
  if (!webhookSecret) {
    console.error(
      "[dropbox-sign webhook] neither DROPBOX_SIGN_WEBHOOK_SECRET nor DROPBOX_SIGN_API_KEY is set; webhook is dormant",
    );
    return new Response("webhook not configured", { status: 503 });
  }

  // 1. Parse the multipart form. Dropbox Sign POSTs `json=<stringified
  //    event payload>` as a form field. Read raw body via formData()
  //    rather than text() since the framing is multipart.
  let raw: string;
  let event: DropboxSignEventPayload;
  try {
    const form = await req.formData();
    const jsonField = form.get("json");
    if (typeof jsonField !== "string") {
      return new Response("missing json payload", { status: 400 });
    }
    raw = jsonField;
    event = JSON.parse(raw) as DropboxSignEventPayload;
  } catch (err) {
    console.warn(
      "[dropbox-sign webhook] payload parse failed",
      { message: err instanceof Error ? err.message : String(err) },
    );
    return new Response("invalid payload", { status: 400 });
  }

  // 2. Verify the signature using the SDK's official helper. It
  //    runs HMAC-SHA256(event_time + event_type) keyed on the API key
  //    and compares against event.event_hash.
  const eventTime = event.event?.event_time;
  const eventType = event.event?.event_type;
  const eventHash = (event.event as { event_hash?: string })?.event_hash;
  if (!eventTime || !eventType || !eventHash) {
    return new Response("event metadata missing", { status: 400 });
  }

  let eventCallback: EventCallbackRequest;
  try {
    eventCallback = EventCallbackRequest.init(event);
  } catch (err) {
    console.warn("[dropbox-sign webhook] init failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return new Response("invalid payload", { status: 400 });
  }

  const signatureOk = EventCallbackHelper.isValid(webhookSecret, eventCallback);
  if (!signatureOk) {
    // Log enough to diagnose mismatch without leaking the secret.
    // Most common cause: stale env var (the key in Vercel doesn't
    // match what Dropbox Sign is signing with). Second-most common:
    // trailing whitespace on the env var paste.
    console.warn(
      "[dropbox-sign webhook] signature verification failed",
      {
        eventType,
        eventTime,
        receivedHashLength: eventHash.length,
        secretLength: webhookSecret.length,
        secretSource: process.env.DROPBOX_SIGN_WEBHOOK_SECRET
          ? "DROPBOX_SIGN_WEBHOOK_SECRET"
          : "DROPBOX_SIGN_API_KEY (fallback)",
      },
    );
    return new Response("invalid signature", { status: 400 });
  }

  // 3. Test callbacks. Dropbox Sign sends a "callback_test" event
  //    when the endpoint is first added in the dashboard. There's no
  //    signature_request payload — just acknowledge and return.
  if (eventType === "callback_test") {
    return new Response(ACK_BODY, { status: 200 });
  }

  // 4. Claim-first idempotency. PK on (id, source, event_type) means
  //    a retry sees 0 rows and short-circuits. Dropbox Sign events
  //    have an event_metadata.event_id we use as the idempotency key.
  const eventId =
    (event.event as { event_metadata?: { reported_for_account_id?: string; event_id?: string } })
      ?.event_metadata?.event_id ?? eventHash;

  const supabase = createServiceRoleClient();
  const { data: claim, error: claimErr } = await supabase
    .from("processed_webhooks")
    .insert({
      id: eventId,
      source: "dropbox_sign",
      event_type: eventType,
      payload: event as unknown as Record<string, unknown>,
    })
    .select("id")
    .maybeSingle();

  if (claimErr) {
    if (claimErr.code === "23505") {
      // Concurrent delivery: the other won.
      return new Response(ACK_BODY, { status: 200 });
    }
    console.error("[dropbox-sign webhook] claim insert failed", claimErr);
    return new Response("claim failed", { status: 500 });
  }
  if (!claim) {
    // Silent ON CONFLICT — already processed.
    return new Response(ACK_BODY, { status: 200 });
  }

  // 5. Dispatch to the per-event handler.
  try {
    await handleSignatureEvent({ supabase, payload: event });
  } catch (err) {
    console.error("[dropbox-sign webhook] handler threw", {
      eventId,
      eventType,
      err: err instanceof Error ? err.message : String(err),
    });
    return new Response("handler error", { status: 500 });
  }

  // Dropbox Sign requires this exact response body or it retries.
  return new Response(ACK_BODY, { status: 200 });
}
