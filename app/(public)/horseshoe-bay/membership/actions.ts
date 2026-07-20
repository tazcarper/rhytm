"use server";

import {
  createInquiry,
  SubmitInquirySchema,
  type SubmitInquiryResult,
} from "@/src/services/public/inquiries";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface MembershipInquiryInput {
  propertyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  message: string;
  hearAboutUs?: string;
  sourcePage?: string;
  sourceLabel?: string;
}

export async function submitMembershipInquiryAction(
  input: MembershipInquiryInput,
): Promise<SubmitInquiryResult> {
  const parsed = SubmitInquirySchema.safeParse({
    propertyId: input.propertyId,
    inquiryType: "membership",
    name: `${input.firstName} ${input.lastName}`.trim(),
    email: input.email,
    phone: input.phone,
    message: input.message,
    details: input.hearAboutUs ? { hear_about_us: input.hearAboutUs } : {},
    sourcePage: input.sourcePage,
    sourceLabel: input.sourceLabel,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Please check your details." };
  }

  const supabase = await createServerSupabaseClient();
  return createInquiry(supabase, parsed.data);
}
