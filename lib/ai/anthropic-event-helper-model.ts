import Anthropic from "@anthropic-ai/sdk";
import type {
  EventHelperModel,
  HelperContentBlock,
  HelperModelRequest,
  HelperModelResponse,
  HelperStopReason,
} from "@/src/services/ai/event-helper-model";

// Adapter from the event helper's narrow model port to the Claude API.
// This is the only file that imports the Anthropic SDK.
//
// Server-only: reads ANTHROPIC_API_KEY from the environment (never a
// NEXT_PUBLIC_ variable). The model is a setting, not code: Claude
// Sonnet 5.5 by default (decided 2026-11-03), overridable with
// EVENT_HELPER_MODEL without a code change.

const DEFAULT_MODEL = "claude-sonnet-5-5";

// Server-side refusal fallback: if the model declines, the API re-runs the
// request on a fallback model chosen by refusal category.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

function mapStopReason(reason: string | null | undefined): HelperStopReason {
  switch (reason) {
    case "end_turn":
    case "tool_use":
    case "max_tokens":
    case "refusal":
      return reason;
    default:
      return "other";
  }
}

export function createAnthropicEventHelperModel(): EventHelperModel {
  const client = new Anthropic({ timeout: 90_000, maxRetries: 1 });
  const model = process.env.EVENT_HELPER_MODEL || DEFAULT_MODEL;

  return {
    async send(request: HelperModelRequest): Promise<HelperModelResponse> {
      // Built as a plain object (not an inline literal) so a field newer
      // than the installed SDK's types, like `fallbacks`, still passes.
      const params = {
        model,
        max_tokens: request.maxTokens,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        // Tools + system are identical for every request from a business,
        // so one breakpoint on the system prompt caches both.
        system: [{ type: "text" as const, text: request.system, cache_control: { type: "ephemeral" as const } }],
        tools: request.tools.map((tool) => ({ ...tool })),
        // Forced tool choice isn't available on this model; the prompt
        // tells it to always answer with a tool, and at most one per turn.
        tool_choice: { type: "auto" as const, disable_parallel_tool_use: true },
        output_config: { effort: "medium" as const },
        messages: request.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      };

      const response = await client.beta.messages.create(
        params as unknown as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming,
      );

      const usage = response.usage;
      return {
        content: response.content as unknown as HelperContentBlock[],
        stopReason: mapStopReason(response.stop_reason),
        inputTokens:
          (usage.input_tokens ?? 0) +
          (usage.cache_read_input_tokens ?? 0) +
          (usage.cache_creation_input_tokens ?? 0),
        outputTokens: usage.output_tokens ?? 0,
      };
    },
  };
}
