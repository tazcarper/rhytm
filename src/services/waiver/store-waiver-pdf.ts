import { createHash } from "node:crypto";
import type { BlobStore } from "@/lib/blob/server";

// Uploads the rendered waiver PDF to Vercel Blob and returns its location
// plus the SHA-256 of the exact bytes stored. The hash is tamper-evidence
// — it is persisted to waiver_documents.pdf_sha256 and can later be
// recomputed from the stored blob to prove the document was not altered.
//
// A random suffix is added to the pathname so a re-sign or a retry never
// overwrites the original artifact. If the caller (Phase 3) loses the
// signing race, it deletes the orphan it just uploaded via blobStore.del.
//
// Depends on the BlobStore abstraction, not @vercel/blob directly, so a
// fake store makes this fully unit-testable without network or a token.

export interface StoredWaiver {
  url: string;
  pathname: string;
  sha256: string;
}

export async function storeWaiverPdf(
  blobStore: BlobStore,
  bidId: string,
  pdfBytes: Uint8Array,
): Promise<StoredWaiver> {
  const sha256 = createHash("sha256").update(pdfBytes).digest("hex");

  const stored = await blobStore.put(`waivers/${bidId}.pdf`, pdfBytes, {
    contentType: "application/pdf",
    addRandomSuffix: true,
  });

  return { url: stored.url, pathname: stored.pathname, sha256 };
}
