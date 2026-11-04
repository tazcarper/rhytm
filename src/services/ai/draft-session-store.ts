import type { SupabaseClient } from "@supabase/supabase-js";
import type { HelperMessage } from "@/src/services/ai/event-helper-model";

// Persists one helper conversation per row in ai_draft_sessions. Uses the
// caller's RLS-scoped client, so a staff member can only load their own
// sessions (policy in 20261103120000_event_builder_contract.sql).

export interface DraftSession {
  id: string;
  propertyId: string | null;
  eventId: string | null;
  messages: HelperMessage[];
  turnCount: number;
  inputTokens: number;
  outputTokens: number;
}

export interface DraftSessionStore {
  load(id: string): Promise<DraftSession | null>;
  create(propertyId: string | null): Promise<DraftSession>;
  save(session: DraftSession): Promise<void>;
  // The caller's most recent conversation about a saved event, if any.
  latestForEvent(eventId: string): Promise<DraftSession | null>;
}

type SessionRow = {
  id: string;
  property_id: string | null;
  event_id: string | null;
  messages: HelperMessage[];
  turn_count: number;
  input_tokens: number;
  output_tokens: number;
};

const COLUMNS = "id, property_id, event_id, messages, turn_count, input_tokens, output_tokens";

function toSession(row: SessionRow): DraftSession {
  return {
    id: row.id,
    propertyId: row.property_id,
    eventId: row.event_id,
    messages: Array.isArray(row.messages) ? row.messages : [],
    turnCount: row.turn_count,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
  };
}

export function createDraftSessionStore(supabase: SupabaseClient): DraftSessionStore {
  return {
    async load(id) {
      const { data, error } = await supabase.from("ai_draft_sessions").select(COLUMNS).eq("id", id).maybeSingle();
      if (error) throw new Error(`Couldn't load the helper conversation: ${error.message}`);
      return data ? toSession(data as SessionRow) : null;
    },
    async create(propertyId) {
      const { data, error } = await supabase
        .from("ai_draft_sessions")
        .insert({ property_id: propertyId })
        .select(COLUMNS)
        .single();
      if (error || !data) throw new Error(`Couldn't start a helper conversation: ${error?.message ?? "no row"}`);
      return toSession(data as SessionRow);
    },
    async latestForEvent(eventId) {
      const { data, error } = await supabase
        .from("ai_draft_sessions")
        .select(COLUMNS)
        .eq("event_id", eventId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`Couldn't load the helper conversation: ${error.message}`);
      return data ? toSession(data as SessionRow) : null;
    },
    async save(session) {
      const { error } = await supabase
        .from("ai_draft_sessions")
        .update({
          event_id: session.eventId,
          messages: session.messages,
          turn_count: session.turnCount,
          input_tokens: session.inputTokens,
          output_tokens: session.outputTokens,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id);
      if (error) throw new Error(`Couldn't save the helper conversation: ${error.message}`);
    },
  };
}
