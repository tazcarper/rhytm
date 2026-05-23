import { createDropboxSignClients } from "@/lib/dropbox-sign/server";

// Resolve a fresh embedded sign URL for a given envelope (Dropbox
// Sign signature_request_id). The URL is short-lived (~30 min from
// Dropbox Sign's side) so we don't cache — every bid-page render
// fetches a new one.
//
// Two-step API:
//   1. signatureRequestGet(signatureRequestId) — returns the envelope
//      including signatures[] (one entry per signer; we use [0]).
//   2. embeddedSignUrl(signatureId) — returns the actual iframe URL.
//
// Dormant when env not configured (factory returns null).
//
// Returns null on any error or non-signable state (envelope already
// signed / declined / canceled / etc.). Callers check null and render
// the appropriate UI fallback.

export interface GetEmbeddedSignUrlContext {
  envelopeId: string;
}

export interface EmbeddedSignUrlResult {
  signUrl: string;
  expiresAt: number; // unix seconds
}

export async function getEmbeddedSignUrl(
  ctx: GetEmbeddedSignUrlContext,
): Promise<EmbeddedSignUrlResult | null> {
  const clients = createDropboxSignClients();
  if (!clients) return null;

  try {
    const envelope = await clients.signatureRequest.signatureRequestGet(
      ctx.envelopeId,
    );
    const signatures = envelope.body.signatureRequest?.signatures ?? [];
    if (signatures.length === 0) {
      console.warn(
        "[dropbox-sign/get-embedded-sign-url] envelope has no signers",
        { envelopeId: ctx.envelopeId },
      );
      return null;
    }

    // Single-signer v1: use the first (only) signer's signatureId.
    // Multi-signer would match by signerEmailAddress / signerRole.
    const signature = signatures[0];
    if (!signature.signatureId) return null;

    // Refuse to mint a URL if the signer has already signed, declined,
    // or errored. The bid page's signedAt check should already gate
    // this, but defend anyway.
    if (signature.signedAt || signature.declineReason || signature.error) {
      return null;
    }

    const urlResponse = await clients.embedded.embeddedSignUrl(
      signature.signatureId,
    );
    const signUrl = urlResponse.body.embedded?.signUrl;
    const expiresAt = urlResponse.body.embedded?.expiresAt;
    if (!signUrl || !expiresAt) return null;

    return { signUrl, expiresAt };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Dropbox Sign API call failed.";
    console.error(
      "[dropbox-sign/get-embedded-sign-url] failed",
      { envelopeId: ctx.envelopeId, message },
    );
    return null;
  }
}
