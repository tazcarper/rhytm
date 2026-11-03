"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/lib/ui";
import { saveEventExtrasAction } from "@/app/admin/events/actions";
import type {
  GearItemInput,
  QuestionInput,
  QuestionKind,
  SaveEventExtrasInput,
  TicketTypeInput,
} from "@/src/services/events/event-extras-contract";
import s from "./bid-editor-form.module.css";

// Editor for an event's ticket types, gear and guest questions — the new
// "thin contract" that sits beside the main event fields. Kept as its own
// card with its own save, so the existing EventEditorForm is unchanged.
//
// Form state keeps money as strings (what the inputs hold); buildPayload
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

function toEditable(extras: SaveEventExtrasInput) {
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

export function EventExtrasEditor({
  eventId,
  extras,
  seededFrom,
}: {
  eventId: string;
  extras: SaveEventExtrasInput;
  // Label of the starter the values came from, when nothing is saved yet.
  seededFrom?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const initial = toEditable(extras);
  const [tickets, setTickets] = useState<EditableTicket[]>(initial.tickets);
  const [gear, setGear] = useState<EditableGear[]>(initial.gear);
  const [questions, setQuestions] = useState<EditableQuestion[]>(initial.questions);

  function buildPayload(): SaveEventExtrasInput {
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

  const handleSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveEventExtrasAction(eventId, buildPayload());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  const update = <T extends { key: string }>(list: T[], key: string, patch: Partial<T>) =>
    list.map((item) => (item.key === key ? { ...item, ...patch } : item));

  return (
    <Card padding="loose" elevation="soft" className="mt-8">
      <h2 className="font-serif text-[22px] text-olive">Tickets, gear and questions</h2>
      <p className="mt-1 text-[14px] text-gray">
        Ticket types, the gear guests need and the questions asked at sign-up.
        {seededFrom ? ` Pre-filled from the ${seededFrom} starter. Save to keep it.` : ""}
      </p>

      {error && (
        <Alert variant="error" title="Couldn't save">
          {error}
        </Alert>
      )}
      {saved && !error && (
        <Alert variant="success" title="Saved">
          Tickets, gear and questions have been saved.
        </Alert>
      )}

      <section className="mt-6">
        <h3 className={s.label}>Tickets</h3>
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
              <span className={s.label}>Note</span>
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
          Add ticket type
        </Button>
      </section>

      <section className="mt-8">
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
                <span className={s.label}>Rent ($)</span>
                <input
                  className={s.input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.rentPrice}
                  placeholder="Not offered"
                  onChange={(evt) => setGear(update(gear, item.key, { rentPrice: evt.target.value }))}
                />
              </label>
              <label className={s.field}>
                <span className={s.label}>Buy ($)</span>
                <input
                  className={s.input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.buyPrice}
                  placeholder="Not offered"
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
                Included with ticket
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.bringOwnAllowed}
                  onChange={(evt) => setGear(update(gear, item.key, { bringOwnAllowed: evt.target.checked }))}
                />
                Guests may bring their own
              </label>
            </div>
            <label className={`${s.field} mt-2`}>
              <span className={s.label}>Note</span>
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
          Add gear
        </Button>
      </section>

      <section className="mt-8">
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
              <span className={s.label}>Answer type</span>
              <select
                className={s.input}
                value={question.kind}
                onChange={(evt) =>
                  setQuestions(update(questions, question.key, { kind: evt.target.value as QuestionKind }))
                }
              >
                <option value="short_text">Short answer</option>
                <option value="yes_no">Yes / no</option>
                <option value="choice">Pick one</option>
              </select>
            </label>
            <label className={s.field}>
              <span className={s.label}>Choices (comma separated)</span>
              <input
                className={s.input}
                value={question.options}
                disabled={question.kind !== "choice"}
                placeholder={question.kind === "choice" ? "S, M, L, XL" : "Only for Pick one"}
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
          Add question
        </Button>
      </section>

      <div className="mt-8">
        <Button type="button" variant="primary" disabled={isPending} onClick={handleSave}>
          {isPending ? "Saving…" : "Save tickets, gear and questions"}
        </Button>
      </div>
    </Card>
  );
}
