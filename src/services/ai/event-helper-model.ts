// The narrow port the event helper needs from a language model. The
// service depends on this interface, not on the Anthropic SDK (Dependency
// Inversion): the concrete adapter lives in lib/ai/, and tests can pass a
// fake that returns scripted replies.
//
// Content blocks are kept as opaque JSON objects. The service only reads
// `text` and `tool_use` blocks, and it stores every block exactly as
// received: Claude's thinking blocks must be sent back unchanged on the
// next turn, so the conversation history is append-only.

export type HelperContentBlock = { type: string } & Record<string, unknown>;

export interface HelperMessage {
  role: "user" | "assistant";
  content: string | ReadonlyArray<HelperContentBlock>;
}

export interface HelperToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  strict: true;
}

export interface HelperModelRequest {
  // Stable instructions + business profile. Cached by the adapter.
  system: string;
  tools: ReadonlyArray<HelperToolDefinition>;
  messages: ReadonlyArray<HelperMessage>;
  maxTokens: number;
}

export type HelperStopReason = "end_turn" | "tool_use" | "max_tokens" | "refusal" | "other";

export interface HelperModelResponse {
  content: ReadonlyArray<HelperContentBlock>;
  stopReason: HelperStopReason;
  inputTokens: number;
  outputTokens: number;
}

export interface EventHelperModel {
  send(request: HelperModelRequest): Promise<HelperModelResponse>;
}
