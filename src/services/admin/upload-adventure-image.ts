import { randomUUID } from "node:crypto";
import type { AdventureImageStorage } from "@/lib/storage/adventure-image-storage";

// Validate + store a single adventure image, returning its public URL.
// Single responsibility: it does not know about HTTP, FormData, or auth —
// the Server Action handles those and injects the storage adapter
// (Dependency Inversion). Returns a discriminated result rather than
// throwing so the action can surface a friendly message.

const MAX_BYTES = 10 * 1024 * 1024; // keep in sync with the bucket cap

// contentType -> file extension. Also the MIME allowlist: anything not in
// this map is rejected before we touch storage (the bucket enforces the
// same set as a backstop).
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

export interface UploadAdventureImageInput {
  bytes: Uint8Array;
  contentType: string;
}

export type UploadAdventureImageResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function uploadAdventureImage(
  storage: AdventureImageStorage,
  { bytes, contentType }: UploadAdventureImageInput,
): Promise<UploadAdventureImageResult> {
  const extension = EXTENSION_BY_TYPE[contentType];
  if (!extension) {
    return { ok: false, error: "Use a JPEG, PNG, WebP, AVIF, or GIF image." };
  }
  if (bytes.byteLength === 0) {
    return { ok: false, error: "That file is empty." };
  }
  if (bytes.byteLength > MAX_BYTES) {
    return { ok: false, error: "Images must be 10 MB or smaller." };
  }

  // Random, unguessable path; foldered by year-agnostic uuid prefix so the
  // bucket stays browsable. No original filename (avoids collisions and
  // path-traversal surprises).
  const id = randomUUID();
  const path = `${id.slice(0, 2)}/${id}.${extension}`;

  try {
    await storage.upload(path, bytes, contentType);
  } catch (err) {
    console.error("[upload-adventure-image] storage upload failed", err);
    return { ok: false, error: "Upload failed. Please try again." };
  }

  return { ok: true, url: storage.getPublicUrl(path) };
}
