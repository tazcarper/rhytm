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

// Which optional parts of the event editor each type uses. One map, so a
// new type is one entry here rather than another `type === ...` check in the
// form. Discipline lists the property's shooting disciplines, which only
// mean something for shooting events; Social and Adventure hide it (Taz,
// 2026-11-03).
export interface EventTypeFields {
  discipline: boolean;
  instructor: boolean;
}

export const EVENT_TYPE_FIELDS: Record<EventType, EventTypeFields> = {
  Training: { discipline: true, instructor: true },
  League: { discipline: true, instructor: false },
  Tournament: { discipline: true, instructor: false },
  Social: { discipline: false, instructor: false },
  Adventure: { discipline: false, instructor: false },
  Standing: { discipline: true, instructor: true },
};

// Before a type is picked (or for an old free-text type), show discipline
// but not the instructor, matching the form's earlier behaviour.
const UNKNOWN_TYPE_FIELDS: EventTypeFields = {
  discipline: true,
  instructor: false,
};

function isEventType(type: string | null): type is EventType {
  return type !== null && (EVENT_TYPES as ReadonlyArray<string>).includes(type);
}

export function eventTypeFields(type: string | null): EventTypeFields {
  return isEventType(type) ? EVENT_TYPE_FIELDS[type] : UNKNOWN_TYPE_FIELDS;
}

export function eventTypeShowsInstructorFields(type: string | null): boolean {
  return eventTypeFields(type).instructor;
}
