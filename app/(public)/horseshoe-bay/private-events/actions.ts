"use server";

import {
  createInquiry,
  SubmitInquirySchema,
  type SubmitInquiryResult,
} from "@/src/services/public/inquiries";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface PrivateEventInquiryInput {
  propertyId: string;
  fullName: string;
  email: string;
  eventType: string;
  desiredDate: string;
  guestCount: string;
  message: string;
}

export async function submitPrivateEventInquiryAction(
  input: PrivateEventInquiryInput,
): Promise<SubmitInquiryResult> {
  const parsed = SubmitInquirySchema.safeParse({
    propertyId: input.propertyId,
    inquiryType: "private_event",
    name: input.fullName,
    email: input.email,
    phone: null,
    message: input.message,
    details: {
      event_type: input.eventType,
      desired_date: input.desiredDate || null,
      guest_count: input.guestCount ? Number(input.guestCount) : null,
    },
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Please check your details." };
  }

  const supabase = await createServerSupabaseClient();
  return createInquiry(supabase, parsed.data);
}
