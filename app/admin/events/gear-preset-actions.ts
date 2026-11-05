"use server";

import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  deleteGearPreset,
  saveGearPresets,
  SaveGearPresetsSchema,
  setGearPresetAddToNewEvents,
  type GearPresetsResult,
} from "@/src/services/admin/gear-presets";

// Thin actions for a property's saved gear list: validate, call the
// service, return the property's updated list. RLS limits writes to
// admins and the property's own manager.

const PresetIdSchema = z.string().uuid();

export async function saveGearPresetsAction(input: unknown): Promise<GearPresetsResult> {
  const parsed = SaveGearPresetsSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue ? issue.message : "Invalid input" };
  }
  return saveGearPresets(await createServerSupabaseClient(), parsed.data);
}

export async function setGearPresetAddToNewEventsAction(
  presetId: string,
  addToNewEvents: boolean,
): Promise<GearPresetsResult> {
  if (!PresetIdSchema.safeParse(presetId).success) return { ok: false, error: "Invalid input" };
  return setGearPresetAddToNewEvents(await createServerSupabaseClient(), presetId, addToNewEvents === true);
}

export async function deleteGearPresetAction(presetId: string): Promise<GearPresetsResult> {
  if (!PresetIdSchema.safeParse(presetId).success) return { ok: false, error: "Invalid input" };
  return deleteGearPreset(await createServerSupabaseClient(), presetId);
}
