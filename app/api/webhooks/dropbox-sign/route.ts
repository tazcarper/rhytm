import { createHmac, timingSafeEqual } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  handleSignatureEvent,
  type DropboxSignEventPayload,
} from "@/src/services/dropbox-sign/handle-signature-event";

// Dropbox Sign webhook endpoint. Same Phase 6 idempotency pattern as
// the Stripe webhook (see app/api/webhooks/stripe/route.ts). Three
// differences:
//
//   1. Signature verification is HMAC-SHA256 over `event_time +
//      event_type` (per Dropbox Sign's docs), not their SDK. No
//      `dbxsign.webhooks.constructEvent`-style helper.
//   2. Dropbox Sign expects the response body to literally contain
//      the string "Hello API Event Received" — if it doesn't, they
//      treat it as a failure and keep retrying. (Yes, really. Their
//      legacy quirk from the HelloSign era.)
//   3. Payload arrives as `multipart/form-data` with a `json` field
//      containing the event body. Not application/json. We parse it
//      out before HMAC + dispatch.
//
// Dormant when env not configured: returns 503 if
// DROPBOX_SIGN_WEBHOOK_SECRET is missing. Dropbox Sign treats 5xx as
// "try again later" and stops retrying after some hours.

export const runtime = "nodejs";

const ACK_BODY = "Hello API Event Received";

export async function POST(req: Request): Promise<Response> {
  const webhookSecret = process.env.DROPBOX_SIGN_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error(
      "[dropbox-sign webhook] DROPBOX_SIGN_WEBHOOK_SECRET is not set; webhook is dormant",
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

  // 2. Verify HMAC. Dropbox Sign signs `event_time + event_type` (not
  //    the full body — odd but documented). The expected hash arrives
  //    in event.event.event_hash.
  const eventTime = event.event?.event_time;
  const eventType = event.event?.event_type;
  const eventHash = (event.event as { event_hash?: string })?.event_hash;
  if (!eventTime || !eventType || !eventHash) {
    return new Response("event metadata missing", { status: 400 });
  }

  const expected = createHmac("sha256", webhookSecret)
    .update(`${eventTime}${eventType}`)
    .digest("hex");

  let signatureOk = false;
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(eventHash, "utf8");
    signatureOk = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    signatureOk = false;
  }

  if (!signatureOk) {
    console.warn(
      "[dropbox-sign webhook] signature verification failed",
      { eventType, eventTime },
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
