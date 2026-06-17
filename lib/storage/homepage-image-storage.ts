import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createPublicImageStorage,
  type PublicImageStorage,
} from "./public-image-storage";

// Thin alias over the generalized public-image storage adapter, pinned to the
// `homepage-images` bucket (see migration 20260615130000). Same rationale as
// the adventure adapter: public bucket, service-role writes, narrow interface.
// Kept as a named adapter so the homepage hero upload path reads in its own
// domain terms.

export const HOMEPAGE_IMAGE_BUCKET = "homepage-images";

export type HomepageImageStorage = PublicImageStorage;

export function createHomepageImageStorage(
  supabase: SupabaseClient,
): HomepageImageStorage {
  return createPublicImageStorage(supabase, HOMEPAGE_IMAGE_BUCKET);
}
