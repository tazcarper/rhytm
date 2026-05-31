"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { saveWaiverTemplate } from "@/src/services/waiver/save-waiver-template";

// Thin Server Action: validate input, delegate to the saveWaiverTemplate
// service (which calls the atomic RPC), revalidate. Uses the admin's
// cookie-scoped client so RLS — not this action — enforces that only
// super_admin / admin can write templates.

export interface SaveWaiverTemplateActionInput {
  title: string;
  body: string;
  consentText: string;
}

export type SaveWaiverTemplateActionResult =
  | { ok: true }
  | { ok: false; message: string };

export async function saveWaiverTemplateAction(
  propertyId: string,
  input: SaveWaiverTemplateActionInput,
): Promise<SaveWaiverTemplateActionResult> {
  const title = input.title.trim();
  const body = input.body.trim();
  const consentText = input.consentText.trim();

  if (!propertyId) {
    return { ok: false, message: "Missing property." };
  }
  if (!title || !body || !consentText) {
    return {
      ok: false,
      message: "Title, body, and consent text are all required.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const result = await saveWaiverTemplate(supabase, {
    propertyId,
    title,
    body,
    consentText,
  });

  if (!result.ok) {
    return { ok: false, message: friendlySaveError(result.message) };
  }

  revalidatePath("/admin/settings/waivers");
  return { ok: true };
}

function friendlySaveError(message: string): string {
  if (/row-level security|permission denied/i.test(message)) {
    return "You don't have permission to edit waiver templates.";
  }
  return message;
}
