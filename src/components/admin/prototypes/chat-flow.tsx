"use client";

import { useState, type FormEvent } from "react";
import { EMPTY_EVENT, SAMPLE_EVENT, type PrototypeEvent } from "@/src/constants/admin/event-prototypes";
import { money } from "./prototype-shell";

// Prototype: a scripted chat. The helper asks one thing at a time with
// tap-to-answer chips; the event card on the right fills in as you answer.
// Soft, friendly look with rounded bubbles.

interface Step {
  ask: string;
  chips: ReadonlyArray<{ label: string; patch: Partial<PrototypeEvent> }>;
}

const OPENING = "Hi! Tell me about the event in a sentence, or tap an example.";

const STEPS: ReadonlyArray<Step> = [
  {
    ask: OPENING,
    chips: [
      {
        label: "Thanksgiving turkey shoot at Horseshoe Bay, Nov 22, 9 to 1",
        patch: {
          title: SAMPLE_EVENT.title,
          property: SAMPLE_EVENT.property,
          kind: SAMPLE_EVENT.kind,
          date: SAMPLE_EVENT.date,
          startTime: SAMPLE_EVENT.startTime,
          endTime: SAMPLE_EVENT.endTime,
          location: SAMPLE_EVENT.location,
        },
      },
    ],
  },
  {
    ask: "Got it, a tournament on Saturday Nov 22, 9 AM to 1 PM. How many shooters can you take?",
    chips: [
      { label: "30", patch: { spots: 30 } },
      { label: "50", patch: { spots: 50 } },
      { label: "75", patch: { spots: 75 } },
    ],
  },
  {
    ask: "Do members pay a different price?",
    chips: [
      { label: "Yes: $65 members, $95 others, $40 juniors", patch: { tickets: SAMPLE_EVENT.tickets } },
      { label: "No, $75 for everyone", patch: { tickets: [{ name: "General", price: 75 }] } },
      { label: "It's free", patch: { tickets: [{ name: "General", price: 0 }] } },
    ],
  },
  {
    ask: "Anything guests need to bring or rent?",
    chips: [
      { label: "Ear and eye protection, and shells", patch: { gear: SAMPLE_EVENT.gear } },
      { label: "Nothing", patch: { gear: [] } },
    ],
  },
  {
    ask: "Should I ask each guest anything when they sign up?",
    chips: [
      { label: "Their experience level", patch: { question: SAMPLE_EVENT.question } },
      { label: "No questions", patch: { question: "" } },
    ],
  },
];

interface Line {
  who: "helper" | "you";
  text: string;
}

export function ChatFlow() {
  const [event, setEvent] = useState<PrototypeEvent>(EMPTY_EVENT);
  const [lines, setLines] = useState<Line[]>([{ who: "helper", text: OPENING }]);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState("");
  const current = STEPS[step];
  const finished = step >= STEPS.length;

  const answer = (label: string, patch: Partial<PrototypeEvent>) => {
    setEvent((value) => ({ ...value, ...patch }));
    const next = STEPS[step + 1];
    setLines((value) => [
      ...value,
      { who: "you", text: label },
      { who: "helper", text: next ? next.ask : "All set. Your draft is on the right. Want to publish it?" },
    ]);
    setStep(step + 1);
  };

  const submitTyped = (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!draft.trim() || !current) return;
    // Prototype: typed answers take the first chip's meaning.
    answer(draft.trim(), current.chips[0]?.patch ?? {});
    setDraft("");
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <section aria-label="Chat" className="flex min-h-[640px] flex-col rounded-[28px] bg-[#f4f1fb] p-6">
        <ol className="m-0 flex flex-1 list-none flex-col gap-4 p-0" aria-live="polite">
          {lines.map((line, index) => (
            <li key={index} className={`flex ${line.who === "you" ? "justify-end" : "justify-start"}`}>
              <span
                className={`max-w-[85%] rounded-[22px] px-5 py-3.5 text-[19px] leading-[1.45] ${
                  line.who === "you" ? "rounded-br-[6px] bg-[#5b3fd1] text-white" : "rounded-bl-[6px] bg-white text-[#221a3d]"
                }`}
              >
                {line.text}
              </span>
            </li>
          ))}
        </ol>
        {current && (
          <div className="mt-6 flex flex-wrap gap-3">
            {current.chips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => answer(chip.label, chip.patch)}
                className="min-h-[48px] rounded-full border-2 border-[#cfc4f5] bg-white px-5 text-[17px] font-semibold text-[#3d2a99] hover:border-[#5b3fd1]"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={submitTyped} className="mt-4 flex gap-3">
          <input
            aria-label="Type a reply"
            value={draft}
            onChange={(evt) => setDraft(evt.target.value)}
            disabled={finished}
            placeholder={finished ? "Done" : "Or type your answer"}
            className="min-h-[56px] flex-1 rounded-full border-2 border-[#ddd5f7] bg-white px-6 text-[18px] outline-none focus:border-[#5b3fd1]"
          />
          <button type="submit" disabled={finished} className="min-h-[56px] rounded-full bg-[#5b3fd1] px-7 text-[18px] font-bold text-white disabled:opacity-50">
            Send
          </button>
        </form>
      </section>

      <aside aria-label="Draft event" className="self-start rounded-[28px] border border-[#e6e1f5] bg-white p-7 lg:sticky lg:top-6">
        <p className="m-0 text-[15px] font-semibold text-[#6b6390]">Draft, filling in as you chat</p>
        <h2 className="m-0 mt-2 text-[30px] font-bold leading-[1.15] tracking-[-0.015em] text-[#221a3d]">
          {event.title || "Untitled event"}
        </h2>
        <dl className="m-0 mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-4 text-[18px]">
          <dt className="text-[#6b6390]">Where</dt>
          <dd className="m-0">{event.title ? `${event.property}, ${event.location}` : "…"}</dd>
          <dt className="text-[#6b6390]">When</dt>
          <dd className="m-0">{event.date ? `${event.date}, ${event.startTime} to ${event.endTime}` : "…"}</dd>
          <dt className="text-[#6b6390]">Spots</dt>
          <dd className="m-0">{step > 1 ? event.spots : "…"}</dd>
          <dt className="text-[#6b6390]">Tickets</dt>
          <dd className="m-0">{event.tickets.length ? event.tickets.map((t) => `${t.name} ${money(t.price)}`).join(", ") : "…"}</dd>
          <dt className="text-[#6b6390]">Gear</dt>
          <dd className="m-0">{step > 3 ? event.gear.map((g) => g.name).join(", ") || "None" : "…"}</dd>
          <dt className="text-[#6b6390]">Asks</dt>
          <dd className="m-0">{step > 4 ? event.question || "Nothing" : "…"}</dd>
        </dl>
        {finished && (
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" className="min-h-[54px] rounded-full bg-[#5b3fd1] px-7 text-[18px] font-bold text-white">
              Publish
            </button>
            <button type="button" className="min-h-[54px] rounded-full border-2 border-[#ddd5f7] px-6 text-[18px] font-semibold">
              Open full editor
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
