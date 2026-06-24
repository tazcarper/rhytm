import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicPropertyBySlug } from "./properties";
import { getSlotsForProperty, type SlotsByDayOfWeek } from "./slots";

// Per-club scheduling data for the estimate front door's WHEN step, which
// reuses the shared <DateTimePicker>. The club is chosen client-side and can
// switch in-form, so we fetch every BOOKABLE club's slot skeleton + horizon
// up front (server-side) and hand the whole map to the client component.
//
// Packsaddle is intentionally absent — it's "coming soon" (not selectable /
// submittable), so it has no schedule to show.

export interface ClubSchedule {
  propertyId: string;
  slotsByDayOfWeek: SlotsByDayOfWeek;
  bookingHorizonDays: number;
}

// Keyed by the estimate-intake ClubCode strings ("hsb" / "hh"). Kept as a
// plain string-keyed record so this service doesn't depend on the component
// layer; the client component narrows it to its ClubCode union.
export type ClubScheduling = Record<string, ClubSchedule>;

// club code → seeded properties.slug. Packsaddle ("psp" / "packsaddle") is
// omitted on purpose.
const BOOKABLE_CLUBS: ReadonlyArray<{ club: string; slug: string }> = [
  { club: "hsb", slug: "horseshoe-bay" },
  { club: "hh", slug: "hog-heaven" },
];

export async function getEstimateClubScheduling(
  supabase: SupabaseClient,
): Promise<ClubScheduling> {
  const entries = await Promise.all(
    BOOKABLE_CLUBS.map(async ({ club, slug }) => {
      const { data: property } = await getPublicPropertyBySlug(supabase, slug);
      if (!property) return null;
      const { data: slots } = await getSlotsForProperty(supabase, property.id);
      return [
        club,
        {
          propertyId: property.id,
          slotsByDayOfWeek: slots ?? {},
          bookingHorizonDays: property.bookingHorizonDays,
        },
      ] as const;
    }),
  );

  const result: ClubScheduling = {};
  for (const entry of entries) {
    if (entry) result[entry[0]] = entry[1];
  }
  return result;
}
