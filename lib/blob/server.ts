import { put, del } from "@vercel/blob";

// Server-only Vercel Blob store. Dormant-safe: createBlobStore() returns
// null when BLOB_READ_WRITE_TOKEN is unset — mirrors the Dropbox Sign
// client factory so the waiver code can deploy before the Blob store
// exists. Callers handle the null and surface a "signing not configured"
// path instead of crashing.
//
// Waiver PDFs are stored with Vercel Blob's public, unguessable
// random-suffix URL, but that URL is treated as a SERVER-ONLY secret:
// it is persisted in waiver_documents.blob_url and never sent to the
// browser. Admin access streams the bytes through a role-gated route, so
// the raw Blob URL never leaves the server.
//
// The interface is intentionally narrow (Interface Segregation): the
// waiver flow only ever needs put + del. Consumers depend on this
// abstraction, not on @vercel/blob directly (Dependency Inversion), which
// keeps storeWaiverPdf trivially testable with an in-memory fake.

export interface BlobPutOptions {
  contentType?: string;
  addRandomSuffix?: boolean;
}

export interface StoredBlob {
  url: string;
  pathname: string;
}

export interface BlobStore {
  put(
    pathname: string,
    body: Uint8Array,
    options?: BlobPutOptions,
  ): Promise<StoredBlob>;
  del(url: string): Promise<void>;
}

export function createBlobStore(): BlobStore | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;

  return {
    async put(pathname, body, options) {
      const result = await put(pathname, Buffer.from(body), {
        access: "public",
        token,
        addRandomSuffix: options?.addRandomSuffix ?? false,
        contentType: options?.contentType,
      });
      return { url: result.url, pathname: result.pathname };
    },
    async del(url) {
      await del(url, { token });
    },
  };
}
