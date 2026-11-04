import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { GearItemSchema, type GearItemInput } from "@/src/services/events/event-extras-contract";

// A property's saved gear list. Each preset is an ordinary gear item plus
// one flag: whether it's added to every new event at that property. Takes
// the caller's RLS-scoped client; RLS decides who may read and write.

export interface GearPreset extends GearItemInput {
  id: string;
  propertyId: string;
  addToNewEvents: boolean;
}

export const SaveGearPresetsSchema = z.object({
  propertyId: z.string().uuid(),
  items: z
    .array(
      z.object({
        gear: GearItemSchema,
        addToNewEvents: z.boolean(),
      }),
    )
    .min(1)
    .max(40),
});
export type SaveGearPresetsInput = z.infer<typeof SaveGearPresetsSchema>;

export type GearPresetsResult = { ok: true; presets: GearPreset[] } | { ok: false; error: string };

type PresetRow = {
  id: string;
  property_id: string;
  name: string;
  is_required: boolean;
  included: boolean;
  bring_own_allowed: boolean;
  rent_price: string | number | null;
  buy_price: string | number | null;
  notes: string | null;
  add_to_new_events: boolean;
};

const COLUMNS =
  "id, property_id, name, is_required, included, bring_own_allowed, rent_price, buy_price, notes, add_to_new_events";

const toMoney = (value: string | number | null) => (value === null ? null : Number(value));

function toPreset(row: PresetRow): GearPreset {
  return {
    id: row.id,
    propertyId: row.property_id,
    name: row.name,
    isRequired: row.is_required,
    included: row.included,
    bringOwnAllowed: row.bring_own_allowed,
    rentPrice: toMoney(row.rent_price),
    buyPrice: toMoney(row.buy_price),
    notes: row.notes,
    addToNewEvents: row.add_to_new_events,
  };
}

function toRow(propertyId: string, gear: GearItemInput, addToNewEvents: boolean) {
  return {
    property_id: propertyId,
    name: gear.name,
    is_required: gear.isRequired,
    included: gear.included,
    bring_own_allowed: gear.bringOwnAllowed,
    rent_price: gear.rentPrice,
    buy_price: gear.buyPrice,
    notes: gear.notes,
    add_to_new_events: addToNewEvents,
  };
}

// Every saved preset the caller can see, across properties, by name.
// Before the table exists (an environment without the migration) the
// builder just shows no saved gear instead of failing the whole page.
export async function getGearPresets(supabase: SupabaseClient): Promise<GearPreset[]> {
  const { data, error } = await supabase.from("property_gear_presets").select(COLUMNS).order("name");
  if (error) return [];
  return ((data ?? []) as PresetRow[]).map(toPreset);
}

async function getPropertyPresets(supabase: SupabaseClient, propertyId: string): Promise<GearPresetsResult> {
  const { data, error } = await supabase
    .from("property_gear_presets")
    .select(COLUMNS)
    .eq("property_id", propertyId)
    .order("name");
  if (error) return { ok: false, error: `Couldn't load the saved gear: ${error.message}` };
  return { ok: true, presets: ((data ?? []) as PresetRow[]).map(toPreset) };
}

// Adds each item to the property's list, or updates the saved item with
// the same name (ignoring case). Returns the property's whole list.
export async function saveGearPresets(
  supabase: SupabaseClient,
  { propertyId, items }: SaveGearPresetsInput,
): Promise<GearPresetsResult> {
  const current = await getPropertyPresets(supabase, propertyId);
  if (!current.ok) return current;
  const idByName = new Map(current.presets.map((preset) => [preset.name.toLowerCase(), preset.id]));

  for (const { gear, addToNewEvents } of items) {
    const row = toRow(propertyId, gear, addToNewEvents);
    const existingId = idByName.get(gear.name.toLowerCase());
    const { error } = existingId
      ? await supabase.from("property_gear_presets").update(row).eq("id", existingId)
      : await supabase.from("property_gear_presets").insert(row);
    if (error) return { ok: false, error: `Couldn't save "${gear.name}": ${error.message}` };
  }

  return getPropertyPresets(supabase, propertyId);
}

export async function setGearPresetAddToNewEvents(
  supabase: SupabaseClient,
  presetId: string,
  addToNewEvents: boolean,
): Promise<GearPresetsResult> {
  const { data, error } = await supabase
    .from("property_gear_presets")
    .update({ add_to_new_events: addToNewEvents })
    .eq("id", presetId)
    .select("property_id")
    .single();
  if (error) return { ok: false, error: `Couldn't update the saved gear: ${error.message}` };
  return getPropertyPresets(supabase, (data as { property_id: string }).property_id);
}

export async function deleteGearPreset(supabase: SupabaseClient, presetId: string): Promise<GearPresetsResult> {
  const { data, error } = await supabase
    .from("property_gear_presets")
    .delete()
    .eq("id", presetId)
    .select("property_id")
    .single();
  if (error) return { ok: false, error: `Couldn't remove the saved gear: ${error.message}` };
  return getPropertyPresets(supabase, (data as { property_id: string }).property_id);
}
