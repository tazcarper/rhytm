import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const gearItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((description) => (description ? description : undefined)),
});

const faqItemSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(500),
  answer: z.string().trim().min(1, "Answer is required").max(2000),
});

export const UpdateBidContentInputSchema = z.object({
  bidId: z.string().uuid(),
  scheduleNotes: z.string().trim().max(5000).optional().nullable(),
  staffNotes: z.string().trim().max(5000).optional().nullable(),
  gearList: z.array(gearItemSchema).max(20),
  faq: z.array(faqItemSchema).max(20),
});

export type UpdateBidContentInput = z.infer<typeof UpdateBidContentInputSchema>;
export type UpdateBidContentRawInput = z.input<
  typeof UpdateBidContentInputSchema
>;

export interface UpdateBidContentResult {
  ok: boolean;
  error?: string;
}

// Persists the guest-facing presentation of a bid — schedule notes, gear
// list, FAQ — plus internal staff notes. Pricing lives in updateBidPricing.
export async function updateBidContent(
  supabase: SupabaseClient,
  input: UpdateBidContentInput,
): Promise<UpdateBidContentResult> {
  const bidUpdate = await supabase
    .from("bids")
    .update({
      schedule_notes: input.scheduleNotes ?? null,
      staff_notes: input.staffNotes ?? null,
      gear_list: input.gearList.map((gearItem) =>
        gearItem.description
          ? { name: gearItem.name, description: gearItem.description }
          : { name: gearItem.name },
      ),
      faq: input.faq.map((faqItem) => ({
        question: faqItem.question,
        answer: faqItem.answer,
      })),
    })
    .eq("id", input.bidId);

  if (bidUpdate.error) {
    return {
      ok: false,
      error: `Couldn't save bid content: ${bidUpdate.error.message}`,
    };
  }

  return { ok: true };
}
