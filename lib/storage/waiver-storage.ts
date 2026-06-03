import type { SupabaseClient } from "@supabase/supabase-js";

// Server-only adapter over the private `waivers` Supabase Storage bucket.
// Takes a service-role Supabase client (Dependency Inversion): both the
// signing write path and the admin read run server-side under service
// role, which bypasses storage RLS. The bucket is private — objects are
// never publicly reachable; admin access goes through a short-lived signed
// URL generated here, so no raw object URL is ever exposed to the browser.
//
// The interface is deliberately narrow (Interface Segregation): the waiver
// flow only needs upload + createSignedUrl + remove. Consumers depend on
// this abstraction, not on supabase.storage directly, which keeps
// storeWaiverPdf testable with an in-memory fake.

export const WAIVER_BUCKET = "waivers";

export interface WaiverStorage {
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  createSignedUrl(path: string, expiresInSeconds: number): Promise<string>;
  remove(path: string): Promise<void>;
}

export function createWaiverStorage(
  supabase: SupabaseClient,
): WaiverStorage {
  const bucket = supabase.storage.from(WAIVER_BUCKET);

  return {
    async upload(path, bytes, contentType) {
      // upsert:false — a re-sign/retry uses a fresh random path (see
      // storeWaiverPdf), so colliding on an existing key is a real error.
      const { error } = await bucket.upload(path, Buffer.from(bytes), {
        contentType,
        upsert: false,
      });
      if (error) throw error;
    },

    async createSignedUrl(path, expiresInSeconds) {
      const { data, error } = await bucket.createSignedUrl(
        path,
        expiresInSeconds,
      );
      if (error) throw error;
      return data.signedUrl;
    },

    async remove(path) {
      const { error } = await bucket.remove([path]);
      if (error) throw error;
    },
  };
}
