import type { SupabaseClient } from "@supabase/supabase-js";

// Atomic "deactivate prior + insert new version" via the
// save_waiver_template RPC. RLS (admin-only insert/update on
// waiver_templates) gates it. Takes the caller's Supabase client
// (Dependency Inversion) so the admin's session — and its role — drives
// authorization.

export interface SaveWaiverTemplateInput {
  propertyId: string;
  title: string;
  body: string;
  consentText: string;
}

export type SaveWaiverTemplateResult =
  | { ok: true; templateId: string }
  | { ok: false; message: string };

export async function saveWaiverTemplate(
  supabase: SupabaseClient,
  input: SaveWaiverTemplateInput,
): Promise<SaveWaiverTemplateResult> {
  const { data, error } = await supabase.rpc("save_waiver_template", {
    p_property_id: input.propertyId,
    p_title: input.title,
    p_body: input.body,
    p_consent_text: input.consentText,
  });

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, templateId: data as string };
}
