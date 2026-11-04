"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  EMPTY_EVENT,
  PROTOTYPE_KINDS,
  PROTOTYPE_PROPERTIES,
  SAMPLE_EVENT,
  type PrototypeEvent,
} from "@/src/constants/admin/event-prototypes";
import { money } from "./prototype-shell";

// Prototype: one big question per screen (wizard). Warm, centred, very
// large type. Enter moves on; every answer is editable from the summary.

interface Question {
  key: string;
  ask: string;
  hint: string;
  render: (event: PrototypeEvent, set: (patch: Partial<PrototypeEvent>) => void) => ReactNode;
  answer: (event: PrototypeEvent) => string;
}

const inputCls =
  "w-full border-0 border-b-[3px] border-[#c9b98f] bg-transparent px-1 py-3 text-[32px] text-[#2b2416] outline-none placeholder:text-[#b3a888] focus:border-[#8a5a1c]";

const choiceCls = (active: boolean) =>
  `min-h-[60px] rounded-[14px] border-2 px-5 text-left text-[20px] transition-colors ${
    active ? "border-[#8a5a1c] bg-[#fbf1df] font-semibold" : "border-[#e2d8c0] bg-white hover:border-[#c9b98f]"
  }`;

const QUESTIONS: ReadonlyArray<Question> = [
  {
    key: "title",
    ask: "What's the event called?",
    hint: "The name guests will see on the calendar.",
    render: (event, set) => (
      <input
        autoFocus
        aria-label="Event name"
        className={inputCls}
        placeholder="Thanksgiving Turkey Shoot"
        value={event.title}
        onChange={(evt) => set({ title: evt.target.value })}
      />
    ),
    answer: (event) => event.title,
  },
  {
    key: "property",
    ask: "Which club is it at?",
    hint: "",
    render: (event, set) => (
      <div className="grid gap-3">
        {PROTOTYPE_PROPERTIES.map((property) => (
          <button
            key={property}
            type="button"
            className={choiceCls(event.property === property)}
            onClick={() => set({ property })}
          >
            {property}
          </button>
        ))}
      </div>
    ),
    answer: (event) => event.property,
  },
  {
    key: "kind",
    ask: "What kind of event is it?",
    hint: "This decides which questions come next.",
    render: (event, set) => (
      <div className="grid gap-3 sm:grid-cols-2">
        {PROTOTYPE_KINDS.map((kind) => (
          <button key={kind} type="button" className={choiceCls(event.kind === kind)} onClick={() => set({ kind })}>
            {kind}
          </button>
        ))}
      </div>
    ),
    answer: (event) => event.kind,
  },
  {
    key: "when",
    ask: "When is it?",
    hint: "Happens more than once? You can add the other dates after.",
    render: (event, set) => (
      <div className="grid gap-6 sm:grid-cols-3">
        <input aria-label="Date" className={inputCls} placeholder="Sat, Nov 22" value={event.date} onChange={(evt) => set({ date: evt.target.value })} />
        <input aria-label="Starts" className={inputCls} placeholder="9:00 AM" value={event.startTime} onChange={(evt) => set({ startTime: evt.target.value })} />
        <input aria-label="Ends" className={inputCls} placeholder="1:00 PM" value={event.endTime} onChange={(evt) => set({ endTime: evt.target.value })} />
      </div>
    ),
    answer: (event) => [event.date, [event.startTime, event.endTime].filter(Boolean).join(" to ")].filter(Boolean).join(", "),
  },
  {
    key: "spots",
    ask: "How many people can come?",
    hint: "",
    render: (event, set) => (
      <div className="flex items-center gap-4">
        <button type="button" aria-label="Fewer" className="h-16 w-16 rounded-full border-2 border-[#e2d8c0] text-[30px]" onClick={() => set({ spots: Math.max(1, event.spots - 5) })}>
          −
        </button>
        <span className="min-w-[4ch] text-center text-[56px] font-semibold tabular-nums">{event.spots}</span>
        <button type="button" aria-label="More" className="h-16 w-16 rounded-full border-2 border-[#e2d8c0] text-[30px]" onClick={() => set({ spots: event.spots + 5 })}>
          +
        </button>
        <span className="text-[22px] text-[#6b5f4a]">spots</span>
      </div>
    ),
    answer: (event) => `${event.spots} spots`,
  },
  {
    key: "tickets",
    ask: "What does it cost?",
    hint: "Add a ticket for each price, like members and non-members.",
    render: (event, set) => (
      <div className="flex flex-col gap-4">
        {event.tickets.map((ticket, index) => (
          <div key={index} className="flex items-center gap-4 text-[22px]">
            <span className="flex-1">{ticket.name}</span>
            <span className="font-semibold">{money(ticket.price)}</span>
            <button type="button" className="text-[17px] underline" onClick={() => set({ tickets: event.tickets.filter((_, i) => i !== index) })}>
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="self-start rounded-[12px] border-2 border-dashed border-[#c9b98f] px-5 py-3 text-[19px]"
          onClick={() => set({ tickets: SAMPLE_EVENT.tickets })}
        >
          {event.tickets.length === 0 ? "Use member / non-member / junior prices" : "Reset to sample prices"}
        </button>
      </div>
    ),
    answer: (event) => event.tickets.map((ticket) => `${ticket.name} ${money(ticket.price)}`).join(", ") || "Free",
  },
  {
    key: "gear",
    ask: "Do guests need any gear?",
    hint: "Optional. Skip if not.",
    render: (event, set) => (
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" className={choiceCls(event.gear.length === 0)} onClick={() => set({ gear: [] })}>
          No gear needed
        </button>
        <button type="button" className={choiceCls(event.gear.length > 0)} onClick={() => set({ gear: SAMPLE_EVENT.gear })}>
          Yes: ear and eye protection, shells
        </button>
      </div>
    ),
    answer: (event) => event.gear.map((item) => item.name).join(", ") || "None",
  },
];

export function OneQuestionFlow() {
  const [event, setEvent] = useState<PrototypeEvent>(EMPTY_EVENT);
  const [index, setIndex] = useState(0);
  const set = (patch: Partial<PrototypeEvent>) => setEvent((current) => ({ ...current, ...patch }));
  const isSummary = index >= QUESTIONS.length;
  const question = QUESTIONS[index];

  const next = (formEvent?: FormEvent) => {
    formEvent?.preventDefault();
    setIndex((i) => Math.min(QUESTIONS.length, i + 1));
  };

  return (
    <div className="min-h-[70vh] rounded-[24px] bg-[#fbf7ee] px-6 py-12 sm:px-16">
      <div className="mx-auto flex max-w-[760px] flex-col gap-10">
        <div className="flex items-center gap-4 text-[17px] text-[#6b5f4a]">
          <span>{isSummary ? "All done" : `Question ${index + 1} of ${QUESTIONS.length}`}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#ece2cc]">
            <div className="h-full bg-[#8a5a1c] transition-all" style={{ width: `${(Math.min(index, QUESTIONS.length) / QUESTIONS.length) * 100}%` }} />
          </div>
          <button type="button" className="underline" onClick={() => setEvent(SAMPLE_EVENT)}>
            Fill with sample
          </button>
        </div>

        {question && !isSummary && (
          <form onSubmit={next} className="flex flex-col gap-8" key={question.key}>
            <div className="flex flex-col gap-3">
              <h1 className="m-0 text-[44px] font-bold leading-[1.1] tracking-[-0.02em] text-[#2b2416]">{question.ask}</h1>
              {question.hint && <p className="m-0 text-[20px] text-[#6b5f4a]">{question.hint}</p>}
            </div>
            {question.render(event, set)}
            <div className="flex items-center gap-5">
              <button type="submit" className="min-h-[60px] rounded-[14px] bg-[#8a5a1c] px-9 text-[20px] font-bold text-white">
                OK
              </button>
              <span className="text-[16px] text-[#6b5f4a]">or press Enter</span>
              {index > 0 && (
                <button type="button" className="ml-auto text-[18px] underline" onClick={() => setIndex(index - 1)}>
                  Back
                </button>
              )}
            </div>
          </form>
        )}

        {isSummary && (
          <div className="flex flex-col gap-8">
            <h1 className="m-0 text-[44px] font-bold leading-[1.1] tracking-[-0.02em] text-[#2b2416]">Here's your event</h1>
            <dl className="m-0 flex flex-col divide-y divide-[#ece2cc] rounded-[16px] bg-white px-6">
              {QUESTIONS.map((q, i) => (
                <div key={q.key} className="flex items-start justify-between gap-6 py-5">
                  <div>
                    <dt className="text-[16px] text-[#6b5f4a]">{q.ask}</dt>
                    <dd className="m-0 mt-1 text-[21px] font-semibold">{q.answer(event) || "Not answered"}</dd>
                  </div>
                  <button type="button" className="text-[17px] underline" onClick={() => setIndex(i)}>
                    Change
                  </button>
                </div>
              ))}
            </dl>
            <div className="flex gap-4">
              <button type="button" className="min-h-[60px] rounded-[14px] bg-[#8a5a1c] px-9 text-[20px] font-bold text-white">
                Publish
              </button>
              <button type="button" className="min-h-[60px] rounded-[14px] border-2 border-[#e2d8c0] bg-white px-7 text-[20px] font-semibold">
                Save as draft
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
