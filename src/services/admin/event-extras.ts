import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  QuestionKind,
  SaveEventExtrasInput,
} from "@/src/services/events/event-extras-contract";

// Reads and writes an event's ticket types, gear and guest questions.
// Pure data layer: takes the caller's RLS-scoped client (same write rules
// as event_info_boxes), receives already-validated input, and replaces
// each child set wholesale — the editor and the helper always submit the
// full desired set, same approach as saveEvent's info boxes.

export type EventExtras = SaveEventExtrasInput;

export type SaveEventExtrasResult = { ok: true } | { ok: false; error: string };

type TicketRow = { name: string; price: string | number; price_after: string | number | null; description: string | null; sort_order: number };
type GearRow = {
  name: string;
  is_required: boolean;
  included: boolean;
  bring_own_allowed: boolean;
  rent_price: string | number | null;
  buy_price: string | number | null;
  notes: string | null;
  sort_order: number;
};
type QuestionRow = {
  label: string;
  kind: QuestionKind;
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
};

const toMoney = (value: string | number | null): number | null => (value === null ? null : Number(value));
const bySortOrder = (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order;

export async function getEventExtras(supabase: SupabaseClient, eventId: string): Promise<EventExtras> {
  const [tickets, gear, questions] = await Promise.all([
    supabase.from("event_ticket_types").select("name, price, price_after, description, sort_order").eq("event_id", eventId),
    supabase
      .from("event_gear_items")
      .select("name, is_required, included, bring_own_allowed, rent_price, buy_price, notes, sort_order")
      .eq("event_id", eventId),
    supabase.from("event_questions").select("label, kind, options, is_required, sort_order").eq("event_id", eventId),
  ]);

  const firstError = tickets.error ?? gear.error ?? questions.error;
  if (firstError) throw new Error(`Couldn't load tickets, gear and questions: ${firstError.message}`);

  return {
    tickets: ((tickets.data ?? []) as TicketRow[]).sort(bySortOrder).map((row) => ({
      name: row.name,
      price: Number(row.price),
      priceAfter: row.price_after === null ? Number(row.price) : Number(row.price_after),
      description: row.description,
    })),
    gear: ((gear.data ?? []) as GearRow[]).sort(bySortOrder).map((row) => ({
      name: row.name,
      isRequired: row.is_required,
      included: row.included,
      bringOwnAllowed: row.bring_own_allowed,
      rentPrice: toMoney(row.rent_price),
      buyPrice: toMoney(row.buy_price),
      notes: row.notes,
    })),
    questions: ((questions.data ?? []) as QuestionRow[]).sort(bySortOrder).map((row) => ({
      label: row.label,
      kind: row.kind,
      options: row.options,
      isRequired: row.is_required,
    })),
  };
}

export async function saveEventExtras(
  supabase: SupabaseClient,
  eventId: string,
  extras: SaveEventExtrasInput,
): Promise<SaveEventExtrasResult> {
  const clears = await Promise.all([
    supabase.from("event_ticket_types").delete().eq("event_id", eventId),
    supabase.from("event_gear_items").delete().eq("event_id", eventId),
    supabase.from("event_questions").delete().eq("event_id", eventId),
  ]);
  const clearError = clears.find((result) => result.error)?.error;
  if (clearError) return { ok: false, error: `Couldn't update tickets, gear and questions: ${clearError.message}` };

  const inserts = await Promise.all([
    extras.tickets.length === 0
      ? null
      : supabase.from("event_ticket_types").insert(
          extras.tickets.map((ticket, index) => ({
            event_id: eventId,
            name: ticket.name,
            price: ticket.price,
            // Same as price means "no change", stored as NULL.
            price_after: ticket.priceAfter === ticket.price ? null : ticket.priceAfter,
            description: ticket.description,
            sort_order: index,
          })),
        ),
    extras.gear.length === 0
      ? null
      : supabase.from("event_gear_items").insert(
          extras.gear.map((item, index) => ({
            event_id: eventId,
            name: item.name,
            is_required: item.isRequired,
            included: item.included,
            bring_own_allowed: item.bringOwnAllowed,
            rent_price: item.rentPrice,
            buy_price: item.buyPrice,
            notes: item.notes,
            sort_order: index,
          })),
        ),
    extras.questions.length === 0
      ? null
      : supabase.from("event_questions").insert(
          extras.questions.map((question, index) => ({
            event_id: eventId,
            label: question.label,
            kind: question.kind,
            options: question.kind === "choice" ? question.options : null,
            is_required: question.isRequired,
            sort_order: index,
          })),
        ),
  ]);
  const insertError = inserts.find((result) => result?.error)?.error;
  if (insertError) return { ok: false, error: `Couldn't save tickets, gear and questions: ${insertError.message}` };

  return { ok: true };
}
