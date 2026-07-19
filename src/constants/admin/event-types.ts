// The admin event editor's curated Type list. The `events.type` column stays
// free text (this project's deliberate choice — see
// supabase/migrations/20260719180000_events_type_discipline_featured.sql),
// so adding a new type is a one-line edit here, not a migration.
//
// "Standing" is load-bearing for the editor's conditional UI: selecting it
// swaps the Date/time fields for a Schedule text field (see
// event-editor-form.tsx) since a standing program has no single occurrence.
export const EVENT_TYPES = [
  "Training",
  "League",
  "Tournament",
  "Social",
  "Adventure",
  "Standing",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const STANDING_EVENT_TYPE: EventType = "Standing";

// Types that show the Instructor field + gear-oriented info-box quick-add,
// mirroring the reference mockup's isTraining || isStanding grouping.
export function eventTypeShowsInstructorFields(type: string | null): boolean {
  return type === "Training" || type === STANDING_EVENT_TYPE;
}
