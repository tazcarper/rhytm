import { SaveEventSchema } from "@/src/services/admin/events";
import { MAX_REPEAT_OCCURRENCES } from "@/src/services/events/repeat-dates";
import { SaveEventExtrasSchema } from "@/src/services/events/event-extras-contract";
import {
  EventDraftSchema,
  draftToSaveInputs,
  type DraftSaveInputs,
} from "@/src/services/ai/event-draft-schema";
import type {
  EventHelperModel,
  HelperContentBlock,
  HelperMessage,
} from "@/src/services/ai/event-helper-model";
import type { DraftSession, DraftSessionStore } from "@/src/services/ai/draft-session-store";
import {
  AskQuestionSchema,
  EVENT_HELPER_TOOLS,
  RequestCapabilitySchema,
  TOOL_ASK_QUESTION,
  TOOL_PROPOSE_DRAFT,
  TOOL_REQUEST_CAPABILITY,
} from "@/src/services/ai/event-helper-tools";
import {
  buildContextNote,
  buildEventHelperSystemPrompt,
  type HelperBusinessProfile,
  type HelperPropertyOption,
} from "@/src/services/ai/event-helper-prompt";
import type { CapabilityRequestInput } from "@/src/services/ai/capability-requests";

// One turn of the AI event helper: take the staff member's message, let
// the model answer with one of its three tools, and act on it.
//
// Everything with a side effect is injected (Dependency Inversion): the
// model, the session store, and the two write paths. The draft write path
// is the same one the admin editor uses, behind the same Zod schemas.

// Limits that keep the helper on topic and cheap (technical design,
// "Keeping the helper on topic"). The per-person daily limit is enforced
// in the route with the existing rate limiter.
export const HELPER_LIMITS = {
  maxMessageChars: 4000,
  maxTurnsPerSession: 20,
  maxTokensPerReply: 8000,
  // Model calls within one turn: the first answer plus up to two fixes
  // after a draft fails validation.
  // One spare call so a turn can record a feature request and still draft.
  maxModelCallsPerTurn: 4,
} as const;

export interface EventHelperDeps {
  model: EventHelperModel;
  sessions: DraftSessionStore;
  // Saves the draft (every date of a repeating one) and returns the first
  // event's id and how many events were created.
  // ids: every event saved (a repeating event saves one per date); id is the first.
  saveDraft: (
    inputs: DraftSaveInputs,
  ) => Promise<{ ok: true; id: string; count: number; ids: string[] } | { ok: false; error: string }>;
  recordCapabilityRequest: (input: CapabilityRequestInput) => Promise<{ ok: true } | { ok: false; error: string }>;
  // Ties this conversation's feature requests to the draft event(s), so the
  // events pages can show "Waiting on a feature". Best effort.
  linkCapabilityRequests: (sessionId: string, eventIds: ReadonlyArray<string>) => Promise<unknown>;
  profile: HelperBusinessProfile;
  today: string; // "YYYY-MM-DD" in the business timezone
}

export interface EventHelperTurnInput {
  sessionId: string | null;
  message: string;
  propertyHint: HelperPropertyOption | null;
}

export type EventHelperResult =
  // featureRequest: set when this turn also sent the developer a request for
  // something the builder can't do yet; the rest of the event carries on.
  | { kind: "question"; sessionId: string; text: string; featureRequest?: string }
  | { kind: "draft"; sessionId: string; eventId: string; eventCount: number; featureRequest?: string }
  | { kind: "capability"; sessionId: string; text: string }
  | { kind: "message"; sessionId: string; text: string; featureRequest?: string }
  | { kind: "error"; sessionId: string | null; text: string };

const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: unknown };

function isToolUse(block: HelperContentBlock): block is HelperContentBlock & ToolUseBlock {
  return block.type === "tool_use" && typeof block.id === "string" && typeof block.name === "string";
}

function textOf(content: ReadonlyArray<HelperContentBlock>): string {
  return content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n")
    .trim();
}

function toolResult(toolUseId: string, content: string, isError = false): HelperContentBlock {
  return { type: "tool_result", tool_use_id: toolUseId, content, ...(isError ? { is_error: true } : {}) };
}

// The id of an ask_clarifying_question call still waiting for the staff
// member's answer, if the conversation ends on one.
function pendingQuestionId(messages: ReadonlyArray<HelperMessage>): string | null {
  const last = messages.at(-1);
  if (!last || last.role !== "assistant" || typeof last.content === "string") return null;
  const ask = last.content.find((block) => isToolUse(block) && block.name === TOOL_ASK_QUESTION);
  return ask && isToolUse(ask) ? ask.id : null;
}

function buildUserMessage(session: DraftSession, input: EventHelperTurnInput, today: string): HelperMessage {
  const waitingOn = pendingQuestionId(session.messages);
  if (waitingOn) return { role: "user", content: [toolResult(waitingOn, input.message)] };
  const note = session.messages.length === 0 ? `${buildContextNote(today, input.propertyHint)}\n\n` : "";
  return { role: "user", content: [{ type: "text", text: `${note}${input.message}` }] };
}

type DraftCheck = { ok: true; inputs: DraftSaveInputs } | { ok: false; problems: string[] };

// Same rules as the admin form, plus the checks the form gets for free
// from its inputs (time format, an allowed property).
export function checkDraft(rawInput: unknown, allowedPropertyIds: ReadonlySet<string>): DraftCheck {
  const draft = EventDraftSchema.safeParse(rawInput);
  if (!draft.success) {
    return { ok: false, problems: draft.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
  }

  const problems: string[] = [];
  if (!allowedPropertyIds.has(draft.data.propertyId)) {
    problems.push("propertyId: must be one of the property ids in the business profile");
  }
  for (const field of ["startAt", "endAt"] as const) {
    const value = draft.data[field];
    if (value !== null && !WALL_CLOCK.test(value)) problems.push(`${field}: use the format YYYY-MM-DDTHH:MM`);
  }
  const repeat = draft.data.repeat;
  if (repeat) {
    if (!draft.data.startAt) problems.push("repeat: a repeating event needs startAt; use null repeat for a Standing programme");
    if (repeat.occurrences < 2 || repeat.occurrences > MAX_REPEAT_OCCURRENCES) {
      problems.push(`repeat.occurrences: must be between 2 and ${MAX_REPEAT_OCCURRENCES}`);
    }
  }

  const inputs = draftToSaveInputs(draft.data);
  const event = SaveEventSchema.safeParse(inputs.event);
  if (!event.success) problems.push(...event.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`));
  const extras = SaveEventExtrasSchema.safeParse(inputs.extras);
  if (!extras.success) problems.push(...extras.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`));

  return problems.length > 0 ? { ok: false, problems } : { ok: true, inputs };
}

export async function runEventHelperTurn(
  deps: EventHelperDeps,
  input: EventHelperTurnInput,
): Promise<EventHelperResult> {
  const message = input.message.trim();
  if (!message) return { kind: "error", sessionId: input.sessionId, text: "Type a description of the event first." };
  if (message.length > HELPER_LIMITS.maxMessageChars) {
    return {
      kind: "error",
      sessionId: input.sessionId,
      text: `That's a lot of text. Keep it under ${HELPER_LIMITS.maxMessageChars} characters.`,
    };
  }

  const session = input.sessionId
    ? await deps.sessions.load(input.sessionId)
    : await deps.sessions.create(input.propertyHint?.id ?? null);
  if (!session) return { kind: "error", sessionId: null, text: "That conversation has expired. Start a new one." };
  if (session.turnCount >= HELPER_LIMITS.maxTurnsPerSession) {
    return { kind: "error", sessionId: session.id, text: "This conversation is getting long. Start a fresh one." };
  }

  const allowedPropertyIds = new Set(deps.profile.properties.map((property) => property.id));
  const system = buildEventHelperSystemPrompt(deps.profile);
  session.messages.push(buildUserMessage(session, { ...input, message }, deps.today));
  session.turnCount += 1;

  let result: EventHelperResult | null = null;
  let featureRequest: string | null = null;

  for (let call = 0; call < HELPER_LIMITS.maxModelCallsPerTurn && !result; call += 1) {
    const reply = await deps.model.send({
      system,
      tools: EVENT_HELPER_TOOLS,
      messages: session.messages,
      maxTokens: HELPER_LIMITS.maxTokensPerReply,
    });
    session.inputTokens += reply.inputTokens;
    session.outputTokens += reply.outputTokens;
    session.messages.push({ role: "assistant", content: reply.content });

    if (reply.stopReason === "refusal") {
      result = { kind: "message", sessionId: session.id, text: "I can't help with that one. Try describing the event differently." };
      break;
    }
    if (reply.stopReason === "max_tokens") {
      result = { kind: "error", sessionId: session.id, text: "That draft ran too long. Try a shorter description." };
      break;
    }

    const toolUse = reply.content.find(isToolUse);
    if (!toolUse) {
      result = {
        kind: "message",
        sessionId: session.id,
        text: textOf(reply.content) || "I can only help with creating and editing events.",
      };
      break;
    }

    if (toolUse.name === TOOL_ASK_QUESTION) {
      const parsed = AskQuestionSchema.safeParse(toolUse.input);
      result = {
        kind: "question",
        sessionId: session.id,
        text: parsed.success ? parsed.data.question : "Could you tell me a bit more about the event?",
      };
      break;
    }

    if (toolUse.name === TOOL_REQUEST_CAPABILITY) {
      const parsed = RequestCapabilitySchema.safeParse(toolUse.input);
      const summary = parsed.success ? parsed.data.summary : "A feature the event builder doesn't have yet";
      const recorded = await deps.recordCapabilityRequest({
        sessionId: session.id,
        propertyId: input.propertyHint?.id ?? session.propertyId,
        summary,
        ownerWords: parsed.success ? parsed.data.ownerWords : message,
      });
      session.messages.push({
        role: "user",
        content: [
          toolResult(
            toolUse.id,
            recorded.ok
              ? "Recorded for the developer to review. Now carry on without it: ask about anything else that's missing, or propose the draft."
              : `Couldn't record it: ${recorded.error}. Carry on with the rest of the event anyway.`,
            !recorded.ok,
          ),
        ],
      });
      // Don't end the turn: the model goes on to draft the rest of the event.
      if (recorded.ok) {
        featureRequest = summary;
        // Asked for after the draft was already saved: link it now.
        if (session.eventId) await deps.linkCapabilityRequests(session.id, [session.eventId]);
      }
      continue;
    }

    if (toolUse.name === TOOL_PROPOSE_DRAFT) {
      const check = checkDraft(toolUse.input, allowedPropertyIds);
      if (!check.ok) {
        // Hand the problems back so the model can fix the draft.
        session.messages.push({
          role: "user",
          content: [toolResult(toolUse.id, `The draft was not saved. Fix these and try again:\n- ${check.problems.join("\n- ")}`, true)],
        });
        continue;
      }
      const saved = await deps.saveDraft(check.inputs);
      session.messages.push({
        role: "user",
        content: [
          toolResult(
            toolUse.id,
            saved.ok
              ? saved.count > 1
                ? `Saved ${saved.count} draft events; the first is ${saved.id}.`
                : `Saved as draft event ${saved.id}.`
              : `Saving failed: ${saved.error}`,
            !saved.ok,
          ),
        ],
      });
      if (saved.ok) {
        session.eventId = saved.id;
        await deps.linkCapabilityRequests(session.id, saved.ids);
        result = { kind: "draft", sessionId: session.id, eventId: saved.id, eventCount: saved.count };
      } else {
        result = { kind: "error", sessionId: session.id, text: `The draft couldn't be saved: ${saved.error}` };
      }
      break;
    }

    // An unknown tool name: answer it so the history stays valid, then stop.
    session.messages.push({ role: "user", content: [toolResult(toolUse.id, "Unknown tool.", true)] });
    result = { kind: "error", sessionId: session.id, text: "Something went wrong. Try again." };
  }

  await deps.sessions.save(session);
  if (featureRequest) {
    if (!result) return { kind: "capability", sessionId: session.id, text: featureRequest };
    if (result.kind === "question" || result.kind === "draft" || result.kind === "message") {
      return { ...result, featureRequest };
    }
  }
  return (
    result ?? {
      kind: "error",
      sessionId: session.id,
      text: "I couldn't get the draft to pass the checks. Try adding the missing details, or use a starter below.",
    }
  );
}
