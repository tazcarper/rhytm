import { z } from "zod";

// The "thin contract" that sits beside an event: ticket types, gear and
// guest questions (tables in
// supabase/migrations/20261103120000_event_builder_contract.sql).
//
// These schemas are the single source of truth for both the admin editor's
// save action and the AI helper. Every field carries a `.describe()` —
// that text is not just documentation: it is generated into the helper's
// tool schema, so it is what the model reads to understand each field.
// Write descriptions for a reader who has never seen this codebase.

const money = z
  .number()
  .min(0, "Price can't be negative")
  .max(100000, "Price looks too large");

export const TicketTypeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Ticket name is required")
    .max(80)
    .describe('Short ticket name a guest picks, e.g. "Adult", "Kids (12 and under)", "Member", "General admission".'),
  price: money.describe(
    "Price in US dollars for one ticket. Use 0 for a free ticket. When the event has a priceChange, this is the EARLIER price.",
  ),
  priceAfter: money.describe(
    "Price in US dollars for this ticket from the event's price change date on (e.g. General 65 then 85, VIP and Kids each their own). Set equal to price when this ticket's price does not change or the event has no priceChange.",
  ),
  description: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .describe('Optional one-line note shown under the ticket, e.g. "Includes lunch". Null when there is nothing to add.'),
});

export const GearItemSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Gear name is required")
      .max(80)
      .describe('The piece of gear, e.g. "Eye and ear protection", "Life vest", "Kayak paddle", "Ammunition".'),
    isRequired: z
      .boolean()
      .describe("True when a guest cannot take part without it (safety gear, equipment the activity needs). False for optional extras."),
    included: z
      .boolean()
      .describe("True when the business provides it at no extra cost as part of the ticket."),
    bringOwnAllowed: z
      .boolean()
      .describe("True when guests may bring their own instead of renting or buying."),
    rentPrice: money
      .nullable()
      .describe("Rental price in US dollars for the event. Null when it can't be rented."),
    buyPrice: money
      .nullable()
      .describe("Price in US dollars to buy and keep it. Null when it isn't for sale."),
    notes: z
      .string()
      .trim()
      .max(300)
      .nullable()
      .describe('Optional note for guests, e.g. "Must be ANSI rated". Null when there is nothing to add.'),
  })
  .refine(
    (gear) => gear.included || gear.bringOwnAllowed || gear.rentPrice !== null || gear.buyPrice !== null,
    {
      message: "Gear needs at least one way to get it: included, bring your own, rent or buy",
      path: ["name"],
    },
  );

export const QuestionKindValues = ["short_text", "yes_no", "choice"] as const;
export type QuestionKind = (typeof QuestionKindValues)[number];

export const QuestionSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1, "Question text is required")
      .max(200)
      .describe('The question asked of each guest at sign-up, e.g. "Any food allergies?", "Shirt size", "Have you shot a shotgun before?".'),
    kind: z
      .enum(QuestionKindValues)
      .describe('"short_text" for a free-text answer, "yes_no" for a yes/no answer, "choice" for picking one of a fixed list.'),
    options: z
      .array(z.string().trim().min(1).max(80))
      .max(20)
      .nullable()
      .describe('The list to pick from, only when kind is "choice" (e.g. ["S", "M", "L", "XL"]). Null for any other kind.'),
    isRequired: z.boolean().describe("True when a guest must answer before signing up."),
  })
  .refine((question) => (question.kind === "choice") === (question.options !== null && question.options.length > 0), {
    message: 'A "choice" question needs options; other kinds must not have any',
    path: ["options"],
  });

export const SaveEventExtrasSchema = z.object({
  tickets: z.array(TicketTypeSchema).max(12),
  gear: z.array(GearItemSchema).max(20),
  questions: z.array(QuestionSchema).max(12),
});

export type TicketTypeInput = z.infer<typeof TicketTypeSchema>;
export type GearItemInput = z.infer<typeof GearItemSchema>;
export type QuestionInput = z.infer<typeof QuestionSchema>;
export type SaveEventExtrasInput = z.infer<typeof SaveEventExtrasSchema>;

export const EMPTY_EVENT_EXTRAS: SaveEventExtrasInput = { tickets: [], gear: [], questions: [] };
