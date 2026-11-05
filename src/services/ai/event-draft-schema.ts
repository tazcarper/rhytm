import { z } from "zod";
import { EVENT_TYPES } from "@/src/constants/admin/event-types";
import { EVENT_STARTER_KEYS } from "@/src/constants/admin/event-starters";
import { EventAudienceValues, type AdminEventDetail, type SaveEventRawInput } from "@/src/services/admin/events";
import {
  GearItemSchema,
  QuestionSchema,
  TicketTypeSchema,
  type SaveEventExtrasInput,
} from "@/src/services/events/event-extras-contract";
import { REPEAT_FREQUENCIES, repeatDates } from "@/src/services/events/repeat-dates";

// The shape the AI helper fills in when it proposes an event. Every field
// is required (absent values are explicit nulls) so the tool can run in
// strict mode, and every field has a `.describe()` — this schema IS the
// helper's field guide: it is turned into the tool's JSON schema verbatim.
//
// After the model returns, a draft is converted to the same inputs the
// admin editor submits and validated by the same Zod schemas
// (SaveEventSchema, SaveEventExtrasSchema). The model gets no special trust.

const nullableText = (description: string) => z.string().nullable().describe(description);
// The Claude API allows at most 16 nullable/union parameters across all
// strict tools in a request, so a few optional texts use "" for "none"
// instead of null. Keep the total under 16 (the tools' schemas together).
const optionalText = (description: string) => z.string().describe(description);

export const EventDraftSchema = z.object({
  starterKey: z
    .enum(EVENT_STARTER_KEYS)
    .nullable()
    .describe("Which built-in starter this event follows (see the starter guide). Null only if none fits."),
  propertyId: z
    .string()
    .describe("The id of the property (club) the event belongs to. Must be one of the property ids listed in the business profile."),
  title: z.string().describe('Event name as guests will see it, e.g. "Halloween Family Fun Day". Title case, no date in the title.'),
  summary: optionalText('One short sentence for the listing card, under 200 characters. An empty string "" if nothing useful to add.'),
  description: nullableText(
    "A few friendly sentences describing the event for guests, written from what the staff member said. Do not invent facts, prizes or amenities.",
  ),
  startAt: nullableText(
    'Start as local wall-clock time in the club\'s timezone, formatted exactly "YYYY-MM-DDTHH:MM" (24-hour), e.g. "2026-10-31T08:00". Null only for a Standing programme with no date.',
  ),
  endAt: nullableText('End time in the same "YYYY-MM-DDTHH:MM" format, on or after the start. Null if no end time was given.'),
  scheduleText: nullableText(
    'Only for a Standing programme with no single date, e.g. "Every Tuesday, 6–8 PM". Null for dated events.',
  ),
  repeat: z
    .object({
      frequency: z
        .enum(REPEAT_FREQUENCIES)
        .describe(
          '"weekly" for every week, "every_2_weeks", "monthly_same_weekday" for e.g. every 2nd Wednesday, "monthly_same_date" for e.g. the 15th of each month, "daily" for back-to-back days.',
        ),
      occurrences: z
        .number()
        .int()
        .describe("Total number of dates in the series, counting the first one. Between 2 and 52."),
    })
    .nullable()
    .describe(
      "Set when the same event runs on several dates; each date becomes its own event with its own sign-ups. Needs startAt. Null for a one-off event and for a Standing programme. If staff say it repeats with no end date, ask whether to schedule a set number of dates or make it a Standing programme.",
    ),
  location: optionalText('Where at the property it happens, e.g. "Main clubhouse" or "Five-stand deck". An empty string "" if not given.'),
  type: z
    .enum(EVENT_TYPES)
    .nullable()
    .describe("Event category used for calendar filters. Pick the closest one; null if none fits."),
  audience: z
    .enum(EventAudienceValues)
    .describe('"members_and_public" when anyone may attend, "members_only" when only club members may.'),
  maxCapacity: z.number().int().describe("Total number of guests the event can hold. A whole number of at least 1."),
  maxGuestsPerRegistration: z
    .number()
    .int()
    .describe("Most guests one person can sign up at once (themselves plus their party). At least 1 and no more than maxCapacity."),
  memberPrice: z
    .number()
    .nullable()
    .describe("Price for club members in US dollars, shown on the event page today. 0 means free for members. Null if members pay the same as everyone."),
  nonMemberPrice: z
    .number()
    .nullable()
    .describe("Main public price in US dollars, shown on the event page today. Use the main adult ticket price. 0 means free. Null only if unknown."),
  priceChange: z
    .object({
      date: z
        .string()
        .describe('The first day the new price applies, "YYYY-MM-DD". "Before December 1" means the new price starts on December 1.'),
      nonMemberPrice: z.number().describe("Main public price in US dollars from that date on."),
      memberPrice: z
        .number()
        .nullable()
        .describe("Member price from that date on. Null if the member price does not change."),
    })
    .nullable()
    .describe(
      'Set when the price changes on a date, e.g. "$65 before December 1, $85 after". memberPrice / nonMemberPrice above (and the tickets) hold the EARLIER price; this holds the price from the change date on. Null when the price stays the same.',
    ),
  tickets: z
    .array(TicketTypeSchema)
    .describe("Every ticket type a guest can choose, one entry per price, e.g. Adult $50 and Kids $10. A free event has one ticket with price 0."),
  gear: z
    .array(GearItemSchema)
    .describe("Gear guests need or may add on, and how they can get it. Empty when the event needs no gear."),
  questions: z
    .array(QuestionSchema)
    .describe("Questions to ask each guest at sign-up. Only include questions the staff member asked for or the starter suggests. Usually empty."),
  infoBoxes: z
    .array(
      z.object({
        heading: z.string().describe('Short heading, e.g. "Activities" or "What to bring".'),
        items: z.array(z.string()).describe("Bullet points under the heading, each a short phrase."),
      }),
    )
    .describe('Bullet-list boxes shown on the event page, e.g. an "Activities" box listing the hayride and pumpkin carving. Empty if nothing to list.'),
});

export type EventDraft = z.infer<typeof EventDraftSchema>;

export interface DraftSaveInputs {
  event: SaveEventRawInput;
  extras: SaveEventExtrasInput;
  // Start dates ("YYYY-MM-DD") for a repeating event, the first included.
  // Empty for a one-off event.
  repeatDates: string[];
}

// Maps a model draft onto the inputs the existing save paths accept.
// Fields the helper never sets (status, featured, images) get the same safe
// defaults a brand-new blank event gets: an unpublished draft.
export function draftToSaveInputs(draft: EventDraft): DraftSaveInputs {
  return {
    event: {
      propertyId: draft.propertyId,
      title: draft.title,
      summary: draft.summary.trim() || null,
      description: draft.description,
      startAt: draft.startAt,
      endAt: draft.endAt,
      scheduleText: draft.scheduleText,
      location: draft.location.trim() || null,
      instructors: null,
      type: draft.type,
      discipline: null,
      featured: false,
      includedWithMembership: draft.memberPrice === 0,
      audience: draft.audience,
      maxCapacity: draft.maxCapacity,
      maxGuestsPerRegistration: draft.maxGuestsPerRegistration,
      memberPrice: draft.memberPrice,
      nonMemberPrice: draft.nonMemberPrice,
      priceChangeOn: draft.priceChange?.date ?? null,
      memberPriceAfter: draft.priceChange?.memberPrice ?? null,
      nonMemberPriceAfter: draft.priceChange?.nonMemberPrice ?? null,
      status: "draft",
      isManuallySoldOut: false,
      isTemplate: false,
      imageUrl: null,
      infoBoxes: draft.infoBoxes.map((box, index) => ({
        boxType: "list" as const,
        heading: box.heading,
        body: null,
        items: box.items,
        sortOrder: index,
      })),
    },
    extras: { tickets: draft.tickets, gear: draft.gear, questions: draft.questions },
    repeatDates:
      draft.repeat && draft.startAt
        ? repeatDates(draft.startAt.slice(0, 10), draft.repeat.frequency, draft.repeat.occurrences)
        : [],
  };
}

// Strict tool schemas accept a subset of JSON Schema: no length or numeric
// bounds and no array size limits. Those rules still apply — they are
// enforced by the Zod validation after the model replies.
const UNSUPPORTED_KEYWORDS = new Set([
  "$schema",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minItems",
  "maxItems",
  "pattern",
]);

function stripUnsupported(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupported);
  if (node === null || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (UNSUPPORTED_KEYWORDS.has(key)) continue;
    out[key] = stripUnsupported(value);
  }
  if (out.type === "object") out.additionalProperties = false;
  return out;
}

export function toStrictToolSchema(schema: z.ZodType): Record<string, unknown> {
  return stripUnsupported(z.toJSONSchema(schema)) as Record<string, unknown>;
}

// ---- Editing an existing event ------------------------------------------

// "YYYY-MM-DDTHH:MM" wall-clock time in the given timezone, the format the
// helper reads and writes dates in.
export function utcToWallClock(iso: string | null, timezone: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// The saved event in the helper's own draft shape, so it can edit from what
// is actually saved (staff may have changed it in the builder since).
export function eventToDraftSnapshot(event: AdminEventDetail, extras: SaveEventExtrasInput, timezone: string): EventDraft {
  return {
    starterKey: null,
    propertyId: event.propertyId,
    title: event.title,
    summary: event.summary ?? "",
    description: event.description,
    startAt: utcToWallClock(event.startAt, timezone),
    endAt: utcToWallClock(event.endAt, timezone),
    scheduleText: event.scheduleText,
    repeat: null,
    location: event.location ?? "",
    type: (EVENT_TYPES as ReadonlyArray<string>).includes(event.type ?? "") ? (event.type as EventDraft["type"]) : null,
    audience: event.audience,
    maxCapacity: event.maxCapacity,
    maxGuestsPerRegistration: event.maxGuestsPerRegistration,
    memberPrice: event.memberPrice,
    nonMemberPrice: event.nonMemberPrice,
    priceChange: event.priceChangeOn
      ? {
          date: event.priceChangeOn,
          nonMemberPrice: event.nonMemberPriceAfter ?? event.nonMemberPrice ?? 0,
          memberPrice: event.memberPriceAfter,
        }
      : null,
    tickets: extras.tickets,
    gear: extras.gear,
    questions: extras.questions,
    infoBoxes: event.infoBoxes
      .filter((box) => box.boxType === "list")
      .map((box) => ({ heading: box.heading, items: box.items ?? [] })),
  };
}

// An edit from the helper, applied to the saved event. The helper only
// knows its draft fields, so everything else (status, image, featured,
// template, instructors, description boxes) stays as it is.
export function mergeDraftIntoEvent(current: AdminEventDetail, draftEvent: SaveEventRawInput): SaveEventRawInput {
  const descriptionBoxes = current.infoBoxes.filter((box) => box.boxType === "description");
  const listBoxes = draftEvent.infoBoxes ?? [];
  return {
    ...draftEvent,
    id: current.id,
    instructors: current.instructors,
    discipline: current.discipline,
    featured: current.featured,
    includedWithMembership: current.includedWithMembership,
    status: current.status,
    isManuallySoldOut: current.isManuallySoldOut,
    isTemplate: current.isTemplate,
    imageUrl: current.imageUrl,
    infoBoxes: [
      ...descriptionBoxes.map((box) => ({
        boxType: box.boxType,
        heading: box.heading,
        body: box.body,
        items: box.items,
      })),
      ...listBoxes.map(({ id: _id, sortOrder: _sort, ...box }) => box),
    ].map((box, index) => ({ ...box, sortOrder: index })),
  };
}
