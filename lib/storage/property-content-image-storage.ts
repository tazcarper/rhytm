import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createPublicImageStorage,
  type PublicImageStorage,
} from "./public-image-storage";

// Thin alias over the generalized public-image storage adapter, pinned to
// the `property-content-images` bucket (see migration 20260719121000). Same
// rationale as the homepage/adventure adapters: public bucket, service-role
// writes, narrow interface.

export const PROPERTY_CONTENT_IMAGE_BUCKET = "property-content-images";

export type PropertyContentImageStorage = PublicImageStorage;

export function createPropertyContentImageStorage(
  supabase: SupabaseClient,
): PropertyContentImageStorage {
  return createPublicImageStorage(supabase, PROPERTY_CONTENT_IMAGE_BUCKET);
}
