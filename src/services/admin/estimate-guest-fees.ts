import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MutationResult } from "./catalog";

// Admin read/write for a property's estimate guest-fee schedule — the tiered
// fee (adult + junior bands) shown on /request-estimate for guest-fee-tier
// experiences. Stored as the pricing_rules row with audience_type = 'estimate'
// (booking_type 'plan_a_visit'), kept distinct from the /book public rule.
// pricing_rules carries an admin-write RLS policy, so the cookie-aware admin
// client is sufficient.

export interface EstimateGuestFeeBand {
  minGuests: number;
  maxGuests: number;
  adult: number;
  // Junior (15 & under) per-guest fee; falls back to the adult rate at read
  // time when null.
  junior: number | null;
}

type TierRow = {
  min_guests: number;
  max_guests: number;
  rate_per_person: string | number;
  junior_rate_per_person?: string | number | null;
};

const toNum = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined ? null : typeof v === "string" ? parseFloat(v) : v;

export async function getEstimateGuestFees(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<EstimateGuestFeeBand[]> {
  const { data, error } = await supabase
    .from("pricing_rules")
    .select("tiers")
    .eq("property_id", propertyId)
    .eq("audience_type", "estimate")
    .maybeSingle();
  if (error) throw new Error(`Estimate guest-fee read failed: ${error.message}`);
  const rawTiers = (data as { tiers: unknown } | null)?.tiers;
  if (!Array.isArray(rawTiers)) return [];
  return (rawTiers as TierRow[])
    .map((t) => ({
      minGuests: t.min_guests,
      maxGuests: t.max_guests,
      adult: toNum(t.rate_per_person) ?? 0,
      junior: toNum(t.junior_rate_per_person),
    }))
    .sort((a, b) => a.minGuests - b.minGuests);
}

const bandSchema = z
  .object({
    minGuests: z.coerce.number().int().min(1).max(1000),
    maxGuests: z.coerce.number().int().min(1).max(1000),
    adult: z.coerce.number().min(0).max(100000),
    junior: z.coerce.number().min(0).max(100000).nullable(),
  })
  .refine((b) => b.maxGuests >= b.minGuests, {
    message: "Band max must be ≥ min",
  });

export const SaveEstimateGuestFeesInputSchema = z.object({
  propertyId: z.string().uuid(),
  bands: z.array(bandSchema).max(20),
});
export type SaveEstimateGuestFeesInput = z.infer<typeof SaveEstimateGuestFeesInputSchema>;
export type SaveEstimateGuestFeesRawInput = z.input<typeof SaveEstimateGuestFeesInputSchema>;

export async function saveEstimateGuestFees(
  supabase: SupabaseClient,
  input: SaveEstimateGuestFeesInput,
): Promise<MutationResult> {
  const tiers = input.bands
    .slice()
    .sort((a, b) => a.minGuests - b.minGuests)
    .map((b) => ({
      min_guests: b.minGuests,
      max_guests: b.maxGuests,
      rate_per_person: b.adult,
      junior_rate_per_person: b.junior,
    }));

  const { error } = await supabase.from("pricing_rules").upsert(
    {
      property_id: input.propertyId,
      booking_type: "plan_a_visit",
      audience_type: "estimate",
      tiers,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "property_id,booking_type,audience_type" },
  );
  if (error) return { ok: false, error: `Couldn't save guest-fee schedule: ${error.message}` };
  return { ok: true };
}
