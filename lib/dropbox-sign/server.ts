// ⚠️ DEPRECATED — Dropbox Sign waiver path (App 7).
// Superseded by the in-house typed-signature waiver (src/services/waiver/*).
// Kept INTACT as a revivable fallback — NOT deleted. Dormant unless
// WAIVER_PROVIDER=dropbox_sign (see lib/waiver/provider.ts). Don't extend;
// revival steps in src/services/dropbox-sign/DEPRECATED.md.

import {
  EmbeddedApi,
  SignatureRequestApi,
} from "@dropbox/sign";

// Server-only Dropbox Sign clients. Two API classes we use:
//
//   - SignatureRequestApi: create signature requests from templates
//     (signatureRequestCreateEmbeddedWithTemplate), cancel requests
//     (signatureRequestCancel), fetch envelope state.
//
//   - EmbeddedApi: mint a fresh embedded sign URL per bid-page visit
//     (embeddedSignUrl). Sign URLs are short-lived (~30 min); we
//     refresh on every server render.
//
// Each API class auths via HTTP Basic with the API key as the
// "username" (Dropbox Sign's convention — empty password). The SDK
// doesn't share state across instances, so we set the key on each.
//
// `createDropboxSignClients()` returns null when DROPBOX_SIGN_API_KEY
// isn't set. Callers handle the null and skip gracefully — App 7 is
// "dormant" in any environment without the env var. This lets us
// deploy the App 7 code before the client has a Dropbox Sign account.
//
// Use for:
//   - confirmBid Server Action (via after()) — creates the envelope
//   - Webhook route — fetches envelope status if needed
//   - Bid page server render — gets a fresh embedded sign URL
//
// Never:
//   - Pass these instances to a client component or serialize them.
//   - Log the API key.

export interface DropboxSignClients {
  signatureRequest: SignatureRequestApi;
  embedded: EmbeddedApi;
}

let cached: DropboxSignClients | undefined;

export function createDropboxSignClients(): DropboxSignClients | null {
  if (cached) return cached;

  const apiKey = process.env.DROPBOX_SIGN_API_KEY;
  if (!apiKey) {
    // App 7 is intentionally dormant when the key is missing. Callers
    // check the null return and skip the relevant work. No throw —
    // that would crash unrelated request paths during scaffolding.
    return null;
  }

  const signatureRequest = new SignatureRequestApi();
  signatureRequest.username = apiKey;

  const embedded = new EmbeddedApi();
  embedded.username = apiKey;

  cached = { signatureRequest, embedded };
  return cached;
}
