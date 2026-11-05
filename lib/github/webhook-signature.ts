import { createHmac, timingSafeEqual } from "node:crypto";

// Checks GitHub's X-Hub-Signature-256 header against the raw request body.
export function isValidGitHubSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`);
  const received = Buffer.from(signatureHeader);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
