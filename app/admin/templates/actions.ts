"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createFaqTemplate,
  updateFaqTemplate,
  deleteFaqTemplate,
  createGearTemplate,
  updateGearTemplate,
  deleteGearTemplate,
  CreateFaqTemplateInputSchema,
  UpdateFaqTemplateInputSchema,
  CreateGearTemplateInputSchema,
  UpdateGearTemplateInputSchema,
  type CreateFaqTemplateRawInput,
  type UpdateFaqTemplateRawInput,
  type CreateGearTemplateRawInput,
  type UpdateGearTemplateRawInput,
  type MutationResult,
} from "@/src/services/admin/bid-content-templates";

// Thin Server Actions: validate, delegate to the service (which writes via the
// admin's cookie-scoped client, so RLS — not these actions — enforces that only
// staff can write templates), then revalidate the management surface.

const TEMPLATES_PATH = "/admin/templates";

function firstIssue(error: {
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>;
}): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid input";
  const path = issue.path.map((segment) => String(segment)).join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

function friendly(message: string): string {
  if (/row-level security|permission denied/i.test(message)) {
    return "You don't have permission to manage FAQ & gear templates.";
  }
  return message;
}

export async function createFaqTemplateAction(
  input: CreateFaqTemplateRawInput,
): Promise<MutationResult> {
  const parsed = CreateFaqTemplateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await createServerSupabaseClient();
  const result = await createFaqTemplate(supabase, parsed.data);
  if (result.ok) revalidatePath(TEMPLATES_PATH);
  return result.ok ? result : { ok: false, error: friendly(result.error ?? "") };
}

export async function updateFaqTemplateAction(
  input: UpdateFaqTemplateRawInput,
): Promise<MutationResult> {
  const parsed = UpdateFaqTemplateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await createServerSupabaseClient();
  const result = await updateFaqTemplate(supabase, parsed.data);
  if (result.ok) revalidatePath(TEMPLATES_PATH);
  return result.ok ? result : { ok: false, error: friendly(result.error ?? "") };
}

export async function deleteFaqTemplateAction(
  templateId: string,
): Promise<MutationResult> {
  const supabase = await createServerSupabaseClient();
  const result = await deleteFaqTemplate(supabase, templateId);
  if (result.ok) revalidatePath(TEMPLATES_PATH);
  return result.ok ? result : { ok: false, error: friendly(result.error ?? "") };
}

export async function createGearTemplateAction(
  input: CreateGearTemplateRawInput,
): Promise<MutationResult> {
  const parsed = CreateGearTemplateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await createServerSupabaseClient();
  const result = await createGearTemplate(supabase, parsed.data);
  if (result.ok) revalidatePath(TEMPLATES_PATH);
  return result.ok ? result : { ok: false, error: friendly(result.error ?? "") };
}

export async function updateGearTemplateAction(
  input: UpdateGearTemplateRawInput,
): Promise<MutationResult> {
  const parsed = UpdateGearTemplateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await createServerSupabaseClient();
  const result = await updateGearTemplate(supabase, parsed.data);
  if (result.ok) revalidatePath(TEMPLATES_PATH);
  return result.ok ? result : { ok: false, error: friendly(result.error ?? "") };
}

export async function deleteGearTemplateAction(
  templateId: string,
): Promise<MutationResult> {
  const supabase = await createServerSupabaseClient();
  const result = await deleteGearTemplate(supabase, templateId);
  if (result.ok) revalidatePath(TEMPLATES_PATH);
  return result.ok ? result : { ok: false, error: friendly(result.error ?? "") };
}
