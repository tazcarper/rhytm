"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createStripeClient } from "@/lib/stripe/server";
import { hasAdminAccess } from "@/lib/auth/portal";
import {
  saveAdventure,
  SaveAdventureSchema,
  type SaveAdventureInput,
  type SaveAdventureResult,
} from "@/src/services/admin/save-adventure";
import { cancelAdventureRsvp } from "@/src/services/members/cancel-adventure-rsvp";
import { createAdventureImageStorage } from "@/lib/storage/adventure-image-storage";
import {
  uploadAdventureImage,
  type UploadAdventureImageResult,
} from "@/src/services/admin/upload-adventure-image";

// Admin adventure mutations. The caller's RLS-scoped client enforces
// admin / property-manager write scope; the capacity triggers + CHECK
// constraints are the backstop.

function revalidateSurfaces(id?: string) {
  revalidatePath("/admin/adventures");
  revalidatePath("/");
  revalidatePath("/adventures");
  if (id) {
    revalidatePath(`/admin/adventures/${id}`);
    revalidatePath(`/adventures/${id}`);
  }
}

export async function saveAdventureAction(
  input: SaveAdventureInput,
): Promise<SaveAdventureResult> {
  const parsed = SaveAdventureSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  const supabase = await createServerSupabaseClient();
  const result = await saveAdventure(supabase, parsed.data);
  if (result.ok) revalidateSurfaces(result.id);
  return result;
}

export async function deleteAdventureAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  // Block hard-delete when any RSVP references it (FK is RESTRICT, and we
  // never want to lose reservation history) — unpublish instead.
  const { data: refs } = await supabase
    .from("member_adventure_rsvps")
    .select("id")
    .eq("adventure_id", id)
    .limit(1);
  if (refs?.length) {
    return {
      ok: false,
      error: "This adventure has reservations. Set it to draft/cancelled instead of deleting.",
    };
  }
  const { error } = await supabase.from("member_adventures").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateSurfaces();
  return { ok: true };
}

// Convert an inquire lead (`requested`) into a confirmed reservation. The
// capacity trigger fires on the status change → confirmed, so a full
// adventure is rejected with a friendly message.
export async function confirmRequestAction(
  rsvpId: string,
  adventureId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("member_adventure_rsvps")
    .update({ status: "confirmed" })
    .eq("id", rsvpId)
    .eq("status", "requested");
  if (error) {
    if (/at capacity/i.test(error.message)) return { ok: false, error: "This adventure is at capacity." };
    if (/sold-out by staff/i.test(error.message)) return { ok: false, error: "This adventure is marked sold out." };
    return { ok: false, error: error.message };
  }
  revalidateSurfaces(adventureId);
  return { ok: true };
}

// Upload one editorial image (hero / gallery / chapter) to the public
// adventure-images bucket and return its public URL for the editor to
// store in the adventure's `details` jsonb. Admin-gated, then writes via
// service role (the bucket has no INSERT policy by design). Thin: auth +
// extract file + delegate to the service.
export async function uploadAdventureImageAction(
  formData: FormData,
): Promise<UploadAdventureImageResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!hasAdminAccess(user?.app_metadata?.role as string | undefined)) {
    return { ok: false, error: "Not authorized." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file received." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const storage = createAdventureImageStorage(createServiceRoleClient());
  return uploadAdventureImage(storage, { bytes, contentType: file.type });
}

// Staff cancel from the roster. `refund: true` issues a full refund of
// what was paid (admin / club-side cancel); false cancels with no refund.
export async function cancelRsvpAdminAction(
  rsvpId: string,
  adventureId: string,
  opts: { refund: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!hasAdminAccess(user?.app_metadata?.role as string | undefined)) {
    return { ok: false, error: "Not authorized." };
  }

  const admin = createServiceRoleClient();
  const stripe = createStripeClient();
  const result = await cancelAdventureRsvp(admin, stripe, {
    rsvpId,
    refundPolicy: opts.refund ? "full" : "none",
  });
  if (!result.ok) return { ok: false, error: "Couldn't cancel the reservation." };
  revalidateSurfaces(adventureId);
  return { ok: true };
}
