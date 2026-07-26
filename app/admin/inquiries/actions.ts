"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  addInquiryNote,
  resolveInquiry,
  type InquiryEventType,
} from "@/src/services/admin/inquiries";

function revalidateInquirySurfaces() {
  revalidatePath("/admin/inquiries");
  revalidatePath("/admin", "layout"); // sidebar badge count
}

export async function addInquiryNoteAction(input: {
  inquiryId: string;
  eventType: InquiryEventType;
  note: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const result = await addInquiryNote(supabase, input);
  if (result.ok) revalidateInquirySurfaces();
  return result;
}

export async function resolveInquiryAction(input: {
  inquiryId: string;
  note: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const result = await resolveInquiry(supabase, input);
  if (result.ok) revalidateInquirySurfaces();
  return result;
}
