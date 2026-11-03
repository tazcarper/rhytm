"use client";

import { Button } from "@/lib/ui";
import type {
  GearItemInput,
  QuestionInput,
  QuestionKind,
  SaveEventExtrasInput,
  TicketTypeInput,
} from "@/src/services/events/event-extras-contract";
import s from "./bid-editor-form.module.css";

// Fields for an event's ticket types, gear and guest questions. Controlled:
// EventEditorForm owns the state and saves it with the rest of the event,
// so the page has a single Save.
//
// State keeps money as strings (what the inputs hold); toExtrasInput
// converts once at the submit boundary.

interface EditableTicket {
  key: string;
  name: string;
  price: string;
  description: string;
}

interface EditableGear {
  key: string;
  name: string;
  isRequired: boolean;
  included: boolean;
  bringOwnAllowed: boolean;
  rentPrice: string;
  buyPrice: string;
  notes: string;
}

interface EditableQuestion {
  key: string;
  label: string;
  kind: QuestionKind;
  options: string;
  isRequired: boolean;
}

let keyCounter = 0;
const nextKey = () => `x${++keyCounter}`;
const moneyToInput = (value: number | null) => (value === null ? "" : String(value));
const inputToMoney = (value: string) => (value.trim() === "" ? null : Number(value));

export interface EditableExtras {
  tickets: EditableTicket[];
  gear: EditableGear[];
  questions: EditableQuestion[];
}

export function toEditableExtras(extras: SaveEventExtrasInput): EditableExtras {
  return {
    tickets: extras.tickets.map(
      (ticket): EditableTicket => ({
        key: nextKey(),
        name: ticket.name,
        price: String(ticket.price),
        description: ticket.description ?? "",
      }),
    ),
    gear: extras.gear.map(
      (item): EditableGear => ({
        key: nextKey(),
        name: item.name,
        isRequired: item.isRequired,
        included: item.included,
        bringOwnAllowed: item.bringOwnAllowed,
        rentPrice: moneyToInput(item.rentPrice),
        buyPrice: moneyToInput(item.buyPrice),
        notes: item.notes ?? "",
      }),
    ),
    questions: extras.questions.map(
      (question): EditableQuestion => ({
        key: nextKey(),
        label: question.label,
        kind: question.kind,
        options: (question.options ?? []).join(", "),
        isRequired: question.isRequired,
      }),
    ),
  };
}

export function toExtrasInput({ tickets, gear, questions }: EditableExtras): SaveEventExtrasInput {
  return {
    tickets: tickets.map(
      (ticket): TicketTypeInput => ({
        name: ticket.name.trim(),
        price: Number(ticket.price) || 0,
        description: ticket.description.trim() || null,
      }),
    ),
    gear: gear.map(
      (item): GearItemInput => ({
        name: item.name.trim(),
        isRequired: item.isRequired,
        included: item.included,
        bringOwnAllowed: item.bringOwnAllowed,
        rentPrice: inputToMoney(item.rentPrice),
        buyPrice: inputToMoney(item.buyPrice),
        notes: item.notes.trim() || null,
      }),
    ),
    questions: questions.map(
      (question): QuestionInput => ({
        label: question.label.trim(),
        kind: question.kind,
        options:
          question.kind === "choice"
            ? question.options
                .split(",")
                .map((option) => option.trim())
                .filter(Boolean)
            : null,
        isRequired: question.isRequired,
      }),
    ),
  };
}

export type ExtrasPart = "tickets" | "gear" | "questions";
const ALL_PARTS: ReadonlyArray<ExtrasPart> = ["tickets", "gear", "questions"];

// `parts` picks which lists to show, so the event builder can put ticket
// options with spots and prices, and gear and questions in their own section.
export function EventExtrasFields({
  value,
  onChange,
  parts = ALL_PARTS,
}: {
  value: EditableExtras;
  onChange: (next: EditableExtras) => void;
  parts?: ReadonlyArray<ExtrasPart>;
}) {
  const { tickets, gear, questions } = value;
  const setTickets = (next: EditableTicket[]) => onChange({ ...value, tickets: next });
  const setGear = (next: EditableGear[]) => onChange({ ...value, gear: next });
  const setQuestions = (next: EditableQuestion[]) => onChange({ ...value, questions: next });

  const update = <T extends { key: string }>(list: T[], key: string, patch: Partial<T>) =>
    list.map((item) => (item.key === key ? { ...item, ...patch } : item));

  return (
    <div className="flex flex-col gap-8">
      {parts.includes("tickets") && (
      <section>
        <h3 className={s.label}>Ticket options</h3>
        {tickets.map((ticket) => (
          <div key={ticket.key} className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_3fr_auto] items-end">
            <label className={s.field}>
              <span className={s.label}>Name</span>
              <input
                className={s.input}
                value={ticket.name}
                placeholder="Adult"
                onChange={(evt) => setTickets(update(tickets, ticket.key, { name: evt.target.value }))}
              />
            </label>
            <label className={s.field}>
              <span className={s.label}>Price ($)</span>
              <input
                className={s.input}
                type="number"
                min="0"
                step="0.01"
                value={ticket.price}
                onChange={(evt) => setTickets(update(tickets, ticket.key, { price: evt.target.value }))}
              />
            </label>
            <label className={s.field}>
              <span className={s.label}>Details</span>
              <input
                className={s.input}
                value={ticket.description}
                placeholder="Optional"
                onChange={(evt) => setTickets(update(tickets, ticket.key, { description: evt.target.value }))}
              />
            </label>
            <Button type="button" variant="ghost" onClick={() => setTickets(tickets.filter((t) => t.key !== ticket.key))}>
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          onClick={() => setTickets([...tickets, { key: nextKey(), name: "", price: "0", description: "" }])}
        >
          Add a ticket option
        </Button>
      </section>
      )}

      {parts.includes("gear") && (
      <section>
        <h3 className={s.label}>Gear</h3>
        {gear.map((item) => (
          <div key={item.key} className="mt-3 rounded-sharp border border-rule p-3">
            <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto] items-end">
              <label className={s.field}>
                <span className={s.label}>Item</span>
                <input
                  className={s.input}
                  value={item.name}
                  placeholder="Ear protection"
                  onChange={(evt) => setGear(update(gear, item.key, { name: evt.target.value }))}
                />
              </label>
              <label className={s.field}>
                <span className={s.label}>Rental price ($)</span>
                <input
                  className={s.input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.rentPrice}
                  placeholder="Leave blank if not offered"
                  onChange={(evt) => setGear(update(gear, item.key, { rentPrice: evt.target.value }))}
                />
              </label>
              <label className={s.field}>
                <span className={s.label}>Price to buy ($)</span>
                <input
                  className={s.input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.buyPrice}
                  placeholder="Leave blank if not offered"
                  onChange={(evt) => setGear(update(gear, item.key, { buyPrice: evt.target.value }))}
                />
              </label>
              <Button type="button" variant="ghost" onClick={() => setGear(gear.filter((g) => g.key !== item.key))}>
                Remove
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-[14px] text-olive">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.isRequired}
                  onChange={(evt) => setGear(update(gear, item.key, { isRequired: evt.target.checked }))}
                />
                Required
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.included}
                  onChange={(evt) => setGear(update(gear, item.key, { included: evt.target.checked }))}
                />
                Comes with the ticket
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.bringOwnAllowed}
                  onChange={(evt) => setGear(update(gear, item.key, { bringOwnAllowed: evt.target.checked }))}
                />
                Guests can bring their own
              </label>
            </div>
            <label className={`${s.field} mt-2`}>
              <span className={s.label}>Details</span>
              <input
                className={s.input}
                value={item.notes}
                placeholder="Optional"
                onChange={(evt) => setGear(update(gear, item.key, { notes: evt.target.value }))}
              />
            </label>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          onClick={() =>
            setGear([
              ...gear,
              {
                key: nextKey(),
                name: "",
                isRequired: false,
                included: false,
                bringOwnAllowed: true,
                rentPrice: "",
                buyPrice: "",
                notes: "",
              },
            ])
          }
        >
          Add gear item
        </Button>
      </section>
      )}

      {parts.includes("questions") && (
      <section>
        <h3 className={s.label}>Questions for guests</h3>
        {questions.map((question) => (
          <div key={question.key} className="mt-3 grid gap-2 sm:grid-cols-[3fr_1fr_2fr_auto] items-end">
            <label className={s.field}>
              <span className={s.label}>Question</span>
              <input
                className={s.input}
                value={question.label}
                placeholder="Any food allergies?"
                onChange={(evt) => setQuestions(update(questions, question.key, { label: evt.target.value }))}
              />
            </label>
            <label className={s.field}>
              <span className={s.label}>How they answer</span>
              <select
                className={s.input}
                value={question.kind}
                onChange={(evt) =>
                  setQuestions(update(questions, question.key, { kind: evt.target.value as QuestionKind }))
                }
              >
                <option value="short_text">Type a short answer</option>
                <option value="yes_no">Yes or no</option>
                <option value="choice">Pick from a list</option>
              </select>
            </label>
            <label className={s.field}>
              <span className={s.label}>List options, separated by commas</span>
              <input
                className={s.input}
                value={question.options}
                disabled={question.kind !== "choice"}
                placeholder={question.kind === "choice" ? "S, M, L, XL" : "Only for “Pick from a list”"}
                onChange={(evt) => setQuestions(update(questions, question.key, { options: evt.target.value }))}
              />
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-[14px] text-olive">
                <input
                  type="checkbox"
                  checked={question.isRequired}
                  onChange={(evt) => setQuestions(update(questions, question.key, { isRequired: evt.target.checked }))}
                />
                Required
              </label>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setQuestions(questions.filter((q) => q.key !== question.key))}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          onClick={() =>
            setQuestions([
              ...questions,
              { key: nextKey(), label: "", kind: "short_text", options: "", isRequired: false },
            ])
          }
        >
          Add a question
        </Button>
      </section>
      )}
    </div>
  );
}
