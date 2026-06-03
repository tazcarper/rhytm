// ⚠️ DEPRECATED — Dropbox Sign waiver path (App 7).
// Superseded by the in-house typed-signature waiver (src/services/waiver/*).
// Kept INTACT as a revivable fallback — NOT deleted. Dormant unless
// WAIVER_PROVIDER=dropbox_sign (see lib/waiver/provider.ts). Don't extend;
// revival steps in src/services/dropbox-sign/DEPRECATED.md.

import { createDropboxSignClients } from "@/lib/dropbox-sign/server";

// Resolve the current embedded-signing state for an envelope. Returns
// a discriminated union so callers can render the right UI for each
// case — distinguishing "envelope already signed (DB will catch up
// via webhook)" from "real API failure".
//
// Two-step API when minting a URL:
//   1. signatureRequestGet(signatureRequestId) — returns the envelope
//      including signatures[] (one entry per signer; we use [0]).
//   2. embeddedSignUrl(signatureId) — returns the actual iframe URL.

export type EmbeddedSignUrlResult =
  | { kind: "available"; signUrl: string; expiresAt: number }
  | { kind: "already_signed" }
  | { kind: "declined" }
  | { kind: "disabled" } // Dropbox Sign env not configured
  | { kind: "error"; message: string };

export interface GetEmbeddedSignUrlContext {
  envelopeId: string;
}

export async function getEmbeddedSignUrl(
  ctx: GetEmbeddedSignUrlContext,
): Promise<EmbeddedSignUrlResult> {
  const clients = createDropboxSignClients();
  if (!clients) return { kind: "disabled" };

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
      return { kind: "error", message: "Envelope has no signers." };
    }

    // Single-signer v1: use the first (only) signer's signatureId.
    // Multi-signer would match by signerEmailAddress / signerRole.
    const signature = signatures[0];

    // Detect terminal states FIRST so callers know whether to wait
    // for the webhook (signed) or surface a real failure.
    if (signature.signedAt) {
      return { kind: "already_signed" };
    }
    if (signature.declineReason) {
      return { kind: "declined" };
    }
    if (!signature.signatureId) {
      return { kind: "error", message: "Signer has no signature id." };
    }

    const urlResponse = await clients.embedded.embeddedSignUrl(
      signature.signatureId,
    );
    const signUrl = urlResponse.body.embedded?.signUrl;
    const expiresAt = urlResponse.body.embedded?.expiresAt;
    if (!signUrl || !expiresAt) {
      return { kind: "error", message: "Sign URL response was empty." };
    }

    return { kind: "available", signUrl, expiresAt };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Dropbox Sign API call failed.";
    console.error(
      "[dropbox-sign/get-embedded-sign-url] failed",
      { envelopeId: ctx.envelopeId, message },
    );
    return { kind: "error", message };
  }
}
