import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createPublicImageStorage,
  type PublicImageStorage,
} from "./public-image-storage";

// Thin alias over the generalized public-image storage adapter, pinned to the
// `service-images` bucket (see migration 20260618140000). Same rationale as the
// add-on / homepage / adventure adapters: public bucket, service-role writes,
// narrow interface. Named so the discipline (service) photo upload path reads
// in its own terms.

export const SERVICE_IMAGE_BUCKET = "service-images";

export type ServiceImageStorage = PublicImageStorage;

export function createServiceImageStorage(
  supabase: SupabaseClient,
): ServiceImageStorage {
  return createPublicImageStorage(supabase, SERVICE_IMAGE_BUCKET);
}
