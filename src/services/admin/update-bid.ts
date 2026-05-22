import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const gearItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

const faqItemSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(500),
  answer: z.string().trim().min(1, "Answer is required").max(2000),
});

const moneyField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  })
  .refine((n) => n === null || n >= 0, "Must be ≥ 0");

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
      gear_list: input.gearList.map((g) =>
        g.description ? { name: g.name, description: g.description } : { name: g.name },
      ),
      faq: input.faq.map((f) => ({ question: f.question, answer: f.answer })),
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
