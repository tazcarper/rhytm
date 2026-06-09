import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createPublicImageStorage,
  type PublicImageStorage,
} from "./public-image-storage";

// Thin alias over the generalized public-image storage adapter, pinned to the
// `adventure-images` bucket. See public-image-storage.ts for the rationale
// (public bucket, service-role writes, narrow interface). Kept as a named
// adapter so the adventure upload path reads in its own domain terms.

export const ADVENTURE_IMAGE_BUCKET = "adventure-images";

export type AdventureImageStorage = PublicImageStorage;

export function createAdventureImageStorage(
  supabase: SupabaseClient,
): AdventureImageStorage {
  return createPublicImageStorage(supabase, ADVENTURE_IMAGE_BUCKET);
}
