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

const moneyField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((moneyInput) => {
    if (moneyInput === null || moneyInput === undefined || moneyInput === "")
      return null;
    const parsed = parseFloat(moneyInput);
    return Number.isFinite(parsed) ? parsed : null;
  })
  .refine((amount) => amount === null || amount >= 0, "Must be ≥ 0");

export const UpdateAdminBidInputSchema = z.object({
  bidId: z.string().uuid(),
  bookingId: z.string().uuid(),
  confirmedPrice: moneyField,
  depositAmount: moneyField,
  quoteNote: z.string().trim().max(500).optional().nullable(),
  scheduleNotes: z.string().trim().max(5000).optional().nullable(),
  staffNotes: z.string().trim().max(5000).optional().nullable(),
  gearList: z.array(gearItemSchema).max(20),
  faq: z.array(faqItemSchema).max(20),
});

export type UpdateAdminBidInput = z.infer<typeof UpdateAdminBidInputSchema>;
export type UpdateAdminBidRawInput = z.input<typeof UpdateAdminBidInputSchema>;

export interface UpdateAdminBidResult {
  ok: boolean;
  error?: string;
}

export async function updateAdminBid(
  supabase: SupabaseClient,
  input: UpdateAdminBidInput,
): Promise<UpdateAdminBidResult> {
  const bookingUpdate = await supabase
    .from("bookings")
    .update({
      confirmed_price: input.confirmedPrice,
      deposit_amount: input.depositAmount,
    })
    .eq("id", input.bookingId);

  if (bookingUpdate.error) {
    return {
      ok: false,
      error: `Couldn't save pricing: ${bookingUpdate.error.message}`,
    };
  }

  const bidUpdate = await supabase
    .from("bids")
    .update({
      schedule_notes: input.scheduleNotes ?? null,
      quote_note: input.quoteNote ?? null,
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
