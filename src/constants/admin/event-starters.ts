import type { EventType } from "@/src/constants/admin/event-types";
import type { SaveEventExtrasInput } from "@/src/services/events/event-extras-contract";

// Built-in event starters: the three kinds of event the prototype must
// handle well (pilot decision, 2026-11-03): one-day ticketed events,
// classes and clinics, and recurring leagues.
//
// Each starter is used two ways:
//   1. The "Start from" picker on /admin/events/new pre-fills the blank
//      editor with `defaults`, and the event's ticket/gear/question editor
//      with `extras`.
//   2. The AI helper reads `whenToUse` and `askIfMissing` (generated into
//      its system prompt) to pick the right starter for a description and
//      to know which follow-up questions to ask.
//
// Adding a starter is a new entry here — no other code changes (Open/Closed).

export const EVENT_STARTER_KEYS = ["single_day", "class_clinic", "league"] as const;
export type EventStarterKey = (typeof EVENT_STARTER_KEYS)[number];

export interface EventStarterDefaults {
  type: EventType;
  maxCapacity: number;
  maxGuestsPerRegistration: number;
  infoBoxes: ReadonlyArray<{ heading: string; items: ReadonlyArray<string> }>;
}

export interface EventStarter {
  key: EventStarterKey;
  label: string;
  // One line for staff in the picker.
  blurb: string;
  // A real-world example shown under the starter on the New event screen.
  example: string;
  // For the AI helper: which descriptions this starter fits.
  whenToUse: string;
  // For the AI helper: details it must have before drafting. It asks one
  // follow-up question at a time for any that are missing or unclear.
  askIfMissing: ReadonlyArray<string>;
  defaults: EventStarterDefaults;
  extras: SaveEventExtrasInput;
}

export const EVENT_STARTERS: Readonly<Record<EventStarterKey, EventStarter>> = {
  single_day: {
    key: "single_day",
    label: "Single-day event",
    blurb: "A party, tournament, open house or other one-off event on one date.",
    example: "Thanksgiving turkey shoot, members' holiday party",
    whenToUse:
      "Any event that happens once, on one date, with a start and end time: parties, tournaments, open houses, tastings, holiday events, fundraisers.",
    askIfMissing: [
      "The date, start time and end time",
      "Whether tickets are free or paid",
      "The price of each ticket type, and whether there are different prices (for example adults and kids, or members and non-members)",
      "How many guests the event can hold",
    ],
    defaults: {
      type: "Social",
      maxCapacity: 100,
      maxGuestsPerRegistration: 8,
      infoBoxes: [{ heading: "What to expect", items: ["Check in at the clubhouse when you arrive"] }],
    },
    extras: {
      tickets: [{ name: "General admission", price: 0, priceAfter: 0, description: null }],
      gear: [],
      questions: [],
    },
  },
  class_clinic: {
    key: "class_clinic",
    label: "Class or clinic",
    blurb: "An instructor-led session with a small group, usually with gear.",
    example: "Intro to sporting clays, a youth safety clinic",
    whenToUse:
      "A lesson, class, clinic or training session led by an instructor, usually for a small group, often needing safety gear or equipment.",
    askIfMissing: [
      "The date, start time and end time",
      "The price per person, and whether members pay a different price",
      "How many people the class can take",
      "What gear guests need, and whether it is included, rented, bought or brought from home",
    ],
    defaults: {
      type: "Training",
      maxCapacity: 8,
      maxGuestsPerRegistration: 2,
      infoBoxes: [
        { heading: "What to bring", items: ["Closed-toe shoes", "Water"] },
        { heading: "What to expect", items: ["Safety briefing before the session starts"] },
      ],
    },
    extras: {
      tickets: [{ name: "Per person", price: 0, priceAfter: 0, description: null }],
      gear: [
        {
          name: "Eye and ear protection",
          isRequired: true,
          included: true,
          bringOwnAllowed: true,
          rentPrice: null,
          buyPrice: null,
          notes: null,
        },
      ],
      questions: [
        {
          label: "Experience level",
          kind: "choice",
          options: ["First time", "Some experience", "Experienced"],
          isRequired: true,
        },
      ],
    },
  },
  league: {
    key: "league",
    label: "Recurring league",
    blurb: "The same event on a regular schedule, like a weekly league night.",
    example: "Wednesday night clays league, 8 weeks",
    whenToUse:
      "An event that repeats on a regular schedule with the same format each time, such as a weekly league, a monthly social or a series of sessions.",
    askIfMissing: [
      "The first date, start time and end time",
      "How often it repeats and how many dates to schedule (if it never ends, ask whether to schedule a set number of dates or make it a Standing programme)",
      "The price per session or per player, and whether members pay a different price",
      "How many players each session can take",
    ],
    defaults: {
      type: "League",
      maxCapacity: 24,
      maxGuestsPerRegistration: 4,
      infoBoxes: [{ heading: "League format", items: ["Same time and format every session"] }],
    },
    extras: {
      tickets: [{ name: "Per player", price: 0, priceAfter: 0, description: null }],
      gear: [],
      questions: [],
    },
  },
};

export function isEventStarterKey(value: string | null | undefined): value is EventStarterKey {
  return EVENT_STARTER_KEYS.includes(value as EventStarterKey);
}
