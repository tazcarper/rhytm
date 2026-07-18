import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

// Public write path for inquiries (see the inquiries migration). Backs the
// Membership and Private Events forms — RLS allows anonymous INSERT only,
// no read. Both forms share this one service; the type-specific extra
// fields go in `details` (documented shape, not schema-enforced — see the
// migration's own comment on why).

export const SubmitInquirySchema = z.object({
  propertyId: z.string().uuid(),
  inquiryType: z.enum(["membership", "private_event"]),
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Enter a valid email").max(320),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  message: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  details: z.record(z.string(), z.unknown()).default({}),
});

export type SubmitInquiryInput = z.infer<typeof SubmitInquirySchema>;
export type SubmitInquiryRawInput = z.input<typeof SubmitInquirySchema>;

export type SubmitInquiryResult = { ok: true } | { ok: false; error: string };

export async function createInquiry(
  supabase: SupabaseClient,
  input: SubmitInquiryInput,
): Promise<SubmitInquiryResult> {
  const { error } = await supabase.from("inquiries").insert({
    property_id: input.propertyId,
    inquiry_type: input.inquiryType,
    name: input.name,
    email: input.email,
    phone: input.phone,
    message: input.message,
    details: input.details,
  });

  if (error) return { ok: false, error: "Couldn't submit — please try again." };
  return { ok: true };
}
