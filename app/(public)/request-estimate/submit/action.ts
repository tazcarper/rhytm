"use server";

import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasAdminAccess } from "@/lib/auth/portal";
import { checkRateLimit, clientIpFrom } from "@/src/services/security/rate-limit";
import {
  createEstimateRequest,
  type EstimateChannel,
} from "@/src/services/estimates/create-estimate-request";

// Thin submit boundary for the public estimate front door. Mirrors the
// public-booking submit action: honeypot + rate limit, then resolve the
// caller's identity server-side (never trusted from the form) and hand a
// clean payload to the service.

export interface SubmitEstimateInput {
  // Club selection as the seeded property slug (horseshoe-bay / hog-heaven /
  // packsaddle). Resolved to property_id server-side.
  propertySlug: string;
  who: "member" | "nonmember";
  experiences: string[];
  addons: { ammo: number; gear: number; cart: boolean };
  catering: { tier: string; name: string; per: number } | null;
  adults: number;
  juniors: number;
  name: string;
  email: string;
  phone: string;
  preferredDate: string;
  backupDate: string;
  arrival: string;
  notes: string;
  indicativeTotal: string;
  // Staff phone-intake context (only honored when the caller is signed-in
  // staff).
  staffMode: boolean;
  staffRepName: string;
}

export type SubmitEstimateResult =
  | { ok: true; estimateRequestId: string }
  | { ok: false; message: string };

export async function submitEstimateAction(
  input: SubmitEstimateInput,
  // Honeypot — a hidden field real users never fill.
  honeypot?: string,
): Promise<SubmitEstimateResult> {
  if (honeypot && honeypot.trim().length > 0) {
    return { ok: false, message: "Something went wrong. Please try again." };
  }

  const requestHeaders = await headers();
  const ip = clientIpFrom(requestHeaders.get("x-forwarded-for"));
  const email = input.email?.trim().toLowerCase() ?? "";
  if (ip && !(await checkRateLimit(`estimate:ip:${ip}`, 10, 600))) {
    return { ok: false, message: "Too many requests — wait a minute and try again." };
  }
  if (email && !(await checkRateLimit(`estimate:email:${email}`, 5, 600))) {
    return { ok: false, message: "Too many requests for this email — wait a few minutes." };
  }

  const supabase = await createServerSupabaseClient();

  // Resolve the club slug to a property id (null is acceptable — a Coming
  // Soon / unmapped lead is still captured).
  let propertyId: string | null = null;
  if (input.propertySlug) {
    const { data: property } = await supabase
      .from("properties")
      .select("id")
      .eq("slug", input.propertySlug)
      .maybeSingle();
    propertyId = (property as { id: string } | null)?.id ?? null;
  }

  // Identity is computed from the session, never from the form. Only a
  // signed-in staff member may attribute a lead to themselves (phone intake).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role as string | undefined;
  const isStaff = hasAdminAccess(role);
  const staffIntake = isStaff && input.staffMode;

  const channel: EstimateChannel = input.who === "member" ? "member" : "non_member";

  const result = await createEstimateRequest({
    propertyId,
    sourceChannel: channel,
    contact: {
      name: input.name,
      email: input.email,
      phone: input.phone ?? "",
    },
    adults: input.adults,
    juniors: input.juniors,
    experiences: input.experiences,
    addons: input.addons as unknown as Record<string, unknown>,
    catering: input.catering,
    preferredDate: input.preferredDate || null,
    backupDate: input.backupDate || null,
    arrival: input.arrival ?? "",
    notes: input.notes ?? "",
    indicativeTotal: input.indicativeTotal ?? "",
    createdByLabel: staffIntake
      ? input.staffRepName?.trim() || "staff"
      : "self-serve",
    createdByStaffId: staffIntake ? user!.id : null,
  });

  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true, estimateRequestId: result.estimateRequestId };
}
