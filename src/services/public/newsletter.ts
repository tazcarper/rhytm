import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

// Public write path for newsletter signups (see the newsletter_signups
// migration). Backs the footer "Subscribe" form on every property page —
// RLS allows anonymous INSERT only, no read.

export const SubmitNewsletterSignupSchema = z.object({
  propertyId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(320),
});

export type SubmitNewsletterSignupInput = z.infer<typeof SubmitNewsletterSignupSchema>;

export type SubmitNewsletterSignupResult = { ok: true } | { ok: false; error: string };

export async function createNewsletterSignup(
  supabase: SupabaseClient,
  input: SubmitNewsletterSignupInput,
): Promise<SubmitNewsletterSignupResult> {
  // ON CONFLICT DO NOTHING via ignoreDuplicates — re-subscribing to a club
  // you're already on is a silent success, not an error, and needs only
  // INSERT privilege (no UPDATE) to satisfy RLS.
  const { error } = await supabase.from("newsletter_signups").upsert(
    { property_id: input.propertyId, email: input.email },
    { onConflict: "property_id,email", ignoreDuplicates: true },
  );

  if (error) return { ok: false, error: "Couldn't subscribe — please try again." };
  return { ok: true };
}
