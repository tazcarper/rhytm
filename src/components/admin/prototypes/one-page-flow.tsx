"use client";

import { useState, type ReactNode } from "react";
import { SAMPLE_EVENT, type PrototypeEvent } from "@/src/constants/admin/event-prototypes";
import { money } from "./prototype-shell";

// Prototype: everything on one page, but only the current part is open.
// Finished parts fold into a one-line summary with "Edit". Cool, crisp,
// document-like look.

type PartKey = "basics" | "when" | "spots" | "tickets" | "gear" | "publish";

const fieldCls =
  "min-h-[52px] w-full rounded-[8px] border border-[#c7ccd6] bg-white px-4 text-[18px] text-[#14213d] focus:border-[#2f5bd3] focus:outline-none focus:ring-4 focus:ring-[#2f5bd3]/20";
const labelCls = "text-[17px] font-semibold text-[#14213d]";

export function OnePageFlow() {
  const [event, setEvent] = useState<PrototypeEvent>(SAMPLE_EVENT);
  const [open, setOpen] = useState<PartKey>("spots");
  const [done, setDone] = useState<ReadonlySet<PartKey>>(new Set(["basics", "when"]));
  const set = (patch: Partial<PrototypeEvent>) => setEvent((current) => ({ ...current, ...patch }));

  const parts: ReadonlyArray<{ key: PartKey; title: string; summary: string; optional?: boolean; body: ReactNode }> = [
    {
      key: "basics",
      title: "Basics",
      summary: `${event.title} · ${event.kind} · ${event.property}`,
      body: (
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-2 sm:col-span-2">
            <span className={labelCls}>Event name</span>
            <input className={fieldCls} value={event.title} onChange={(evt) => set({ title: evt.target.value })} />
          </label>
          <label className="flex flex-col gap-2">
            <span className={labelCls}>Kind of event</span>
            <input className={fieldCls} value={event.kind} onChange={(evt) => set({ kind: evt.target.value })} />
          </label>
          <label className="flex flex-col gap-2">
            <span className={labelCls}>Where</span>
            <input className={fieldCls} value={event.location} onChange={(evt) => set({ location: evt.target.value })} />
          </label>
        </div>
      ),
    },
    {
      key: "when",
      title: "Date and time",
      summary: `${event.date}, ${event.startTime} to ${event.endTime}`,
      body: (
        <div className="grid gap-5 sm:grid-cols-3">
          {(["date", "startTime", "endTime"] as const).map((key) => (
            <label key={key} className="flex flex-col gap-2">
              <span className={labelCls}>{key === "date" ? "Date" : key === "startTime" ? "Starts" : "Ends"}</span>
              <input className={fieldCls} value={event[key]} onChange={(evt) => set({ [key]: evt.target.value })} />
            </label>
          ))}
        </div>
      ),
    },
    {
      key: "spots",
      title: "Spots",
      summary: `${event.spots} spots, up to ${event.perSignup} per sign-up`,
      body: (
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className={labelCls}>Total spots</span>
            <input type="number" className={fieldCls} value={event.spots} onChange={(evt) => set({ spots: Number(evt.target.value) })} />
          </label>
          <label className="flex flex-col gap-2">
            <span className={labelCls}>Most one person can sign up</span>
            <input type="number" className={fieldCls} value={event.perSignup} onChange={(evt) => set({ perSignup: Number(evt.target.value) })} />
          </label>
        </div>
      ),
    },
    {
      key: "tickets",
      title: "Tickets and prices",
      summary: event.tickets.map((ticket) => `${ticket.name} ${money(ticket.price)}`).join(" · "),
      body: (
        <div className="flex flex-col gap-4">
          {event.tickets.map((ticket, index) => (
            <div key={index} className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
              <input className={fieldCls} aria-label="Ticket name" defaultValue={ticket.name} />
              <input className={fieldCls} aria-label="Price" defaultValue={ticket.price} />
            </div>
          ))}
        </div>
      ),
    },
    {
      key: "gear",
      title: "Gear and questions",
      optional: true,
      summary: [event.gear.map((item) => item.name).join(", "), event.question].filter(Boolean).join(" · ") || "None",
      body: (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {event.gear.map((item) => (
            <li key={item.name} className="rounded-[8px] bg-[#f1f4fa] px-4 py-3 text-[18px]">
              <strong>{item.name}.</strong> {item.note}
            </li>
          ))}
          <li className="rounded-[8px] bg-[#f1f4fa] px-4 py-3 text-[18px]">
            <strong>Question:</strong> {event.question}
          </li>
        </ul>
      ),
    },
    {
      key: "publish",
      title: "Publish",
      summary: "Draft",
      body: (
        <div className="flex flex-wrap gap-4">
          <button type="button" className="min-h-[52px] rounded-[8px] bg-[#2f5bd3] px-7 text-[18px] font-bold text-white">
            Publish now
          </button>
          <button type="button" className="min-h-[52px] rounded-[8px] border border-[#c7ccd6] bg-white px-6 text-[18px] font-semibold">
            Keep as draft
          </button>
        </div>
      ),
    },
  ];

  const finish = (key: PartKey) => {
    setDone((current) => new Set([...current, key]));
    const index = parts.findIndex((part) => part.key === key);
    const next = parts[index + 1];
    if (next) setOpen(next.key);
  };

  return (
    <div className="mx-auto max-w-[820px] text-[#14213d]">
      <h1 className="m-0 text-[40px] font-bold leading-[1.1] tracking-[-0.02em]">{event.title}</h1>
      <p className="mb-8 mt-2 text-[19px] text-[#4a5672]">
        {done.size} of {parts.length} parts done · Draft, guests can't see it yet
      </p>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {parts.map((part, index) => {
          const isOpen = open === part.key;
          const isDone = done.has(part.key);
          return (
            <li key={part.key} className={`rounded-[14px] border bg-white ${isOpen ? "border-[#2f5bd3] shadow-[0_4px_20px_rgba(20,33,61,0.08)]" : "border-[#dde1ea]"}`}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(part.key)}
                className="flex w-full items-center gap-4 px-6 py-5 text-left"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[16px] font-bold ${
                    isDone ? "bg-[#e3ecff] text-[#2f5bd3]" : isOpen ? "bg-[#2f5bd3] text-white" : "border-2 border-[#c7ccd6] text-[#4a5672]"
                  }`}
                  aria-hidden="true"
                >
                  {isDone ? "✓" : index + 1}
                </span>
                <span className="flex-1">
                  <span className="block text-[21px] font-bold">
                    {part.title}
                    {part.optional && <span className="ml-2 text-[16px] font-normal text-[#4a5672]">Optional</span>}
                  </span>
                  {!isOpen && <span className="mt-1 block text-[17px] text-[#4a5672]">{isDone ? part.summary : "Not started"}</span>}
                </span>
                {!isOpen && <span className="text-[17px] font-semibold text-[#2f5bd3]">{isDone ? "Edit" : "Start"}</span>}
              </button>
              {isOpen && (
                <div className="flex flex-col gap-6 border-t border-[#eef0f5] px-6 pb-6 pt-5">
                  {part.body}
                  {part.key !== "publish" && (
                    <button
                      type="button"
                      onClick={() => finish(part.key)}
                      className="self-start min-h-[52px] rounded-[8px] bg-[#14213d] px-7 text-[18px] font-bold text-white"
                    >
                      Done, next part
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
