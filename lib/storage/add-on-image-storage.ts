import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createPublicImageStorage,
  type PublicImageStorage,
} from "./public-image-storage";

// Thin alias over the generalized public-image storage adapter, pinned to the
// `add-on-images` bucket (see migration 20260618120000). Same rationale as the
// homepage / adventure adapters: public bucket, service-role writes, narrow
// interface. Named so the add-on detail upload path reads in its own terms.

export const ADD_ON_IMAGE_BUCKET = "add-on-images";

export type AddOnImageStorage = PublicImageStorage;

export function createAddOnImageStorage(
  supabase: SupabaseClient,
): AddOnImageStorage {
  return createPublicImageStorage(supabase, ADD_ON_IMAGE_BUCKET);
}
