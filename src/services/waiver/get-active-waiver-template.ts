import type { SupabaseClient } from "@supabase/supabase-js";

// Reads the active waiver template for a property (config-in-DB). One
// active row per property is enforced by a partial unique index, so this
// is a single-row lookup. Returns null when no template is configured —
// the caller surfaces a "no waiver configured" path rather than signing
// against nothing.

export interface WaiverTemplate {
  id: string;
  title: string;
  body: string;
  consentText: string;
  version: number;
}

type WaiverTemplateRow = {
  id: string;
  title: string;
  body: string;
  consent_text: string;
  version: number;
};

export async function getActiveWaiverTemplate(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<WaiverTemplate | null> {
  const { data, error } = await supabase
    .from("waiver_templates")
    .select("id, title, body, consent_text, version")
    .eq("property_id", propertyId)
    .eq("is_active", true)
    .maybeSingle<WaiverTemplateRow>();

  if (error) {
    throw new Error(`Active waiver template lookup failed: ${error.message}`);
  }
  if (!data) return null;

  return {
    id: data.id,
    title: data.title,
    body: data.body,
    consentText: data.consent_text,
    version: data.version,
  };
}
