import { z } from "zod";
import { EventDraftSchema, toStrictToolSchema } from "@/src/services/ai/event-draft-schema";
import type { HelperToolDefinition } from "@/src/services/ai/event-helper-model";

// The helper's only ways to answer. It has no free-form chat tool, so an
// off-topic request can only end in a short sentence (see the system
// prompt), which keeps it on topic and cheap.

export const TOOL_PROPOSE_DRAFT = "propose_event_draft";
export const TOOL_ASK_QUESTION = "ask_clarifying_question";
export const TOOL_REQUEST_CAPABILITY = "request_new_capability";

export const AskQuestionSchema = z.object({
  question: z
    .string()
    .describe("One short, specific question for the staff member about a single missing or unclear detail."),
});

export const RequestCapabilitySchema = z.object({
  summary: z
    .string()
    .describe("One or two plain sentences describing what the event builder can't do yet, e.g. \"A free golf cart for groups of exactly four players\"."),
  ownerWords: z.string().describe("The staff member's own words that asked for it, quoted as closely as possible."),
  sameAsRequestId: z
    .string()
    .nullable()
    .describe(
      "If one of the open feature requests listed in the context already covers this (the same feature, even if worded differently or with other numbers), that request's id; this event is then added to it instead of filing a new request. Null if none covers it.",
    ),
});

export const EVENT_HELPER_TOOLS: ReadonlyArray<HelperToolDefinition> = [
  {
    name: TOOL_PROPOSE_DRAFT,
    description:
      "Save a complete event as an unpublished draft. Call this once you have every detail the matching starter requires. The draft is checked against the same rules as the admin form; if a check fails you get the error back and should fix the draft and call this again.",
    input_schema: toStrictToolSchema(EventDraftSchema),
    strict: true,
  },
  {
    name: TOOL_ASK_QUESTION,
    description:
      "Ask the staff member one follow-up question when a detail the starter requires is missing or unclear (date, times, whether tickets are free, prices, capacity). Ask about one thing at a time.",
    input_schema: toStrictToolSchema(AskQuestionSchema),
    strict: true,
  },
  {
    name: TOOL_REQUEST_CAPABILITY,
    description:
      "Record that the staff member wants something the event builder cannot express with the fields available (a new kind of pricing, eligibility or capacity rule). Use this rarely: only when no combination of tickets, gear, questions and info boxes covers it. A developer reviews these requests.",
    input_schema: toStrictToolSchema(RequestCapabilitySchema),
    strict: true,
  },
];
