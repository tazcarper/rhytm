import { createHash, randomUUID } from "node:crypto";
import { WAIVER_BUCKET, type WaiverStorage } from "@/lib/storage/waiver-storage";

// Hashes the rendered waiver PDF and uploads it to the private `waivers`
// bucket. Returns the object path, a stable bucket-qualified reference for
// waiver_documents.blob_url, and the SHA-256 of the exact bytes stored.
//
// The SHA-256 is tamper-evidence — it is persisted to
// waiver_documents.pdf_sha256 and can later be recomputed from the stored
// object to prove the document was not altered.
//
// The object path carries a random component (`<bidId>/<uuid>.pdf`) so a
// re-sign or retry never overwrites the original artifact. If the caller
// (Phase 3) loses the signing race, it deletes the orphan it just uploaded
// via storage.remove(path).
//
// Depends on the WaiverStorage abstraction, not supabase.storage directly,
// so a fake makes this fully unit-testable without network.

export interface StoredWaiver {
  path: string; // object key within the waivers bucket -> blob_pathname
  reference: string; // bucket-qualified canonical ref -> blob_url
  sha256: string;
}

export async function storeWaiverPdf(
  storage: WaiverStorage,
  bidId: string,
  pdfBytes: Uint8Array,
): Promise<StoredWaiver> {
  const sha256 = createHash("sha256").update(pdfBytes).digest("hex");

  const path = `${bidId}/${randomUUID()}.pdf`;
  await storage.upload(path, pdfBytes, "application/pdf");

  return {
    path,
    reference: `${WAIVER_BUCKET}/${path}`,
    sha256,
  };
}
