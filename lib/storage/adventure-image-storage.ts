import type { SupabaseClient } from "@supabase/supabase-js";

// Server-only adapter over the PUBLIC `adventure-images` Supabase Storage
// bucket. Takes a service-role Supabase client (Dependency Inversion): the
// admin upload path runs server-side under service role, which bypasses
// storage RLS for the write. The bucket is public, so reads happen by the
// browser hitting the returned public URL directly — no signing needed.
//
// Contrast with WaiverStorage (private bucket, signed URLs): adventure
// imagery is editorial content shown on public pages, so the object URL is
// meant to be world-readable.
//
// The interface is deliberately narrow (Interface Segregation): the editor
// only needs upload + getPublicUrl + remove. Consumers depend on this
// abstraction, not on supabase.storage directly, which keeps the upload
// service testable with an in-memory fake.

export const ADVENTURE_IMAGE_BUCKET = "adventure-images";

export interface AdventureImageStorage {
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  getPublicUrl(path: string): string;
  remove(path: string): Promise<void>;
}

export function createAdventureImageStorage(
  supabase: SupabaseClient,
): AdventureImageStorage {
  const bucket = supabase.storage.from(ADVENTURE_IMAGE_BUCKET);

  return {
    async upload(path, bytes, contentType) {
      // upsert:false — every upload uses a fresh random path (see
      // uploadAdventureImage), so colliding on an existing key is a real
      // error, not an intentional overwrite. cacheControl is a year:
      // objects are content-addressed (random path) and never mutated, so
      // they're safe to cache immutably and cut repeat egress.
      const { error } = await bucket.upload(path, Buffer.from(bytes), {
        contentType,
        upsert: false,
        cacheControl: "31536000",
      });
      if (error) throw error;
    },

    getPublicUrl(path) {
      return bucket.getPublicUrl(path).data.publicUrl;
    },

    async remove(path) {
      const { error } = await bucket.remove([path]);
      if (error) throw error;
    },
  };
}
