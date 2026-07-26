"use server";

import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit, clientIpFrom } from "@/src/services/security/rate-limit";
import {
  createNewsletterSignup,
  SubmitNewsletterSignupSchema,
  type SubmitNewsletterSignupResult,
} from "@/src/services/public/newsletter";

// Thin submit boundary for the footer newsletter form, shared by every
// property page (see PropertyFooter). Not colocated under a single
// property's route because the form itself isn't route-specific.

export interface NewsletterSignupInput {
  propertySlug: string;
  email: string;
}

export async function submitNewsletterSignupAction(
  input: NewsletterSignupInput,
  // Honeypot — a hidden field real users never fill. Same pattern as the
  // estimate form's submitEstimateAction.
  honeypot?: string,
): Promise<SubmitNewsletterSignupResult> {
  if ((honeypot ?? "").trim().length > 0) {
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  const requestHeaders = await headers();
  const ip = clientIpFrom(requestHeaders.get("x-forwarded-for"));
  const email = input.email?.trim().toLowerCase() ?? "";
  if (ip && !(await checkRateLimit(`newsletter:ip:${ip}`, 10, 600))) {
    return { ok: false, error: "Too many requests — wait a minute and try again." };
  }
  if (email && !(await checkRateLimit(`newsletter:email:${email}`, 5, 600))) {
    return { ok: false, error: "Too many requests for this email — wait a few minutes." };
  }

  const supabase = await createServerSupabaseClient();

  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("slug", input.propertySlug)
    .maybeSingle();
  const propertyId = (property as { id: string } | null)?.id ?? null;
  if (!propertyId) {
    return { ok: false, error: "We couldn't match that club. Please try again." };
  }

  const parsed = SubmitNewsletterSignupSchema.safeParse({ propertyId, email: input.email });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Enter a valid email." };
  }

  return createNewsletterSignup(supabase, parsed.data);
}
