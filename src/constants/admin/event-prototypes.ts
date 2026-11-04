// Clickable prototypes of different ways to create an event, built for
// comparing look and feel (pilot, 2026-11-04). Sample data only: nothing in
// /admin/events/prototypes reads or writes the database.

export const EVENT_PROTOTYPE_SLUGS = ["one-question", "one-page", "chat", "on-the-page"] as const;
export type EventPrototypeSlug = (typeof EVENT_PROTOTYPE_SLUGS)[number];

export interface EventPrototype {
  slug: EventPrototypeSlug;
  title: string;
  pattern: string;
  blurb: string;
  goodFor: string;
}

export const EVENT_PROTOTYPES: ReadonlyArray<EventPrototype> = [
  {
    slug: "one-question",
    title: "One question at a time",
    pattern: "Wizard",
    blurb: "A single big question fills the screen. Press Enter to move on. Ends on a summary to check.",
    goodFor: "First-time or occasional staff. Very calm, but slower for people who know what they want.",
  },
  {
    slug: "one-page",
    title: "One page that opens as you go",
    pattern: "Progressive accordion",
    blurb: "Everything on one page, but only the current part is open. Finished parts fold into a one-line summary.",
    goodFor: "Quick edits later on. You can see the whole event at a glance without the clutter.",
  },
  {
    slug: "chat",
    title: "Chat with the helper",
    pattern: "Conversational",
    blurb: "The helper asks a few questions with tap-to-answer buttons, and the event card fills in beside the chat.",
    goodFor: "Staff who'd rather describe than fill in forms. Pairs with the AI helper you already have.",
  },
  {
    slug: "on-the-page",
    title: "Edit right on the event page",
    pattern: "Preview-first",
    blurb: "You see the event page guests will see. Click any part of it (title, date, prices) to change it in place.",
    goodFor: "Visual people. Very clear what guests will see, but harder to show what's missing.",
  },
];

export function isEventPrototypeSlug(value: string): value is EventPrototypeSlug {
  return (EVENT_PROTOTYPE_SLUGS as ReadonlyArray<string>).includes(value);
}

// One sample event every prototype starts from or fills in.
export interface PrototypeEvent {
  property: string;
  title: string;
  kind: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  summary: string;
  spots: number;
  perSignup: number;
  tickets: ReadonlyArray<{ name: string; price: number }>;
  gear: ReadonlyArray<{ name: string; note: string }>;
  question: string;
}

export const PROTOTYPE_PROPERTIES = [
  "Horseshoe Bay Sporting Club",
  "Hog Heaven Sporting Club",
  "Packsaddle Precision",
] as const;

export const PROTOTYPE_KINDS = ["Tournament", "Training", "League", "Social", "Adventure"] as const;

export const SAMPLE_EVENT: PrototypeEvent = {
  property: "Horseshoe Bay Sporting Club",
  title: "Thanksgiving Turkey Shoot",
  kind: "Tournament",
  date: "Sat, Nov 22",
  startTime: "9:00 AM",
  endTime: "1:00 PM",
  location: "Sporting clays course",
  summary: "Top three scores win a smoked turkey. Lunch at the clubhouse is included.",
  spots: 50,
  perSignup: 4,
  tickets: [
    { name: "Member", price: 65 },
    { name: "Non-member", price: 95 },
    { name: "Junior (under 16)", price: 40 },
  ],
  gear: [
    { name: "Ear and eye protection", note: "Required. Bring your own or rent for $5" },
    { name: "Shells", note: "$12 a box, or bring your own" },
  ],
  question: "What's your experience level?",
};

export const EMPTY_EVENT: PrototypeEvent = {
  property: PROTOTYPE_PROPERTIES[0],
  title: "",
  kind: "",
  date: "",
  startTime: "",
  endTime: "",
  location: "",
  summary: "",
  spots: 20,
  perSignup: 4,
  tickets: [],
  gear: [],
  question: "",
};
