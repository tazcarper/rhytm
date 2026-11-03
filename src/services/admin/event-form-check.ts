// Which parts of the event builder are finished, and what still needs
// fixing before the event can be saved. Pure: takes the form's values,
// returns plain-language problems grouped by builder section. The builder
// shows them in its section list; the Save button refuses while any exist.
//
// The rules mirror SaveEventSchema (src/services/admin/events.ts) so a
// problem is caught next to the field, not as a server error after Save.

export const EVENT_BUILDER_SECTIONS = ["basics", "when", "spots", "guests", "page", "review"] as const;
export type EventBuilderSection = (typeof EVENT_BUILDER_SECTIONS)[number];

export type SectionStatus = "done" | "needs_attention" | "optional";

export interface EventFormCheckInput {
  title: string;
  propertyId: string;
  isStanding: boolean;
  startAt: string;
  endAt: string;
  scheduleText: string;
  maxCapacity: string;
  maxGuestsPerRegistration: string;
  ticketNames: ReadonlyArray<string>;
  gearNames: ReadonlyArray<string>;
  questionLabels: ReadonlyArray<string>;
  // The optional sections count as "Done" once anything is in them.
  hasPageExtras: boolean;
}

export type EventFormProblems = Readonly<Record<EventBuilderSection, ReadonlyArray<string>>>;

const isWholeNumberAtLeastOne = (value: string) => {
  const parsed = Number(value);
  return value.trim() !== "" && Number.isInteger(parsed) && parsed >= 1;
};

export function checkEventForm(input: EventFormCheckInput): EventFormProblems {
  const basics: string[] = [];
  if (!input.propertyId) basics.push("Choose which property it's at.");
  if (!input.title.trim()) basics.push("Give the event a name.");

  const when: string[] = [];
  if (input.isStanding) {
    if (!input.scheduleText.trim()) when.push("Say when it runs, like “Tuesdays at 7:30 AM”.");
  } else {
    if (!input.startAt) when.push("Pick the date and start time.");
    if (input.startAt && input.endAt && input.endAt < input.startAt) when.push("The end time is before the start.");
  }

  const spots: string[] = [];
  const capacityOk = isWholeNumberAtLeastOne(input.maxCapacity);
  if (!capacityOk) spots.push("Total spots must be a whole number, 1 or more.");
  if (!isWholeNumberAtLeastOne(input.maxGuestsPerRegistration)) {
    spots.push("The most one person can sign up must be 1 or more.");
  } else if (capacityOk && Number(input.maxGuestsPerRegistration) > Number(input.maxCapacity)) {
    spots.push("One person can't sign up more people than the total spots.");
  }
  if (input.ticketNames.some((name) => !name.trim())) spots.push("Every ticket option needs a name.");

  const guests: string[] = [];
  if (input.gearNames.some((name) => !name.trim())) guests.push("Every gear item needs a name.");
  if (input.questionLabels.some((label) => !label.trim())) guests.push("Every question needs some wording.");

  return { basics, when, spots, guests, page: [], review: [] };
}

export function sectionStatus(
  section: EventBuilderSection,
  problems: EventFormProblems,
  input: EventFormCheckInput,
): SectionStatus {
  if (problems[section].length > 0) return "needs_attention";
  if (section === "guests") {
    return input.gearNames.length + input.questionLabels.length > 0 ? "done" : "optional";
  }
  if (section === "page") return input.hasPageExtras ? "done" : "optional";
  return "done";
}

export function firstSectionWithProblems(problems: EventFormProblems): EventBuilderSection | null {
  return EVENT_BUILDER_SECTIONS.find((section) => problems[section].length > 0) ?? null;
}
