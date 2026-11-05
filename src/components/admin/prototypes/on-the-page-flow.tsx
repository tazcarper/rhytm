"use client";

import { useState, type ReactNode } from "react";
import { SAMPLE_EVENT, type PrototypeEvent } from "@/src/constants/admin/event-prototypes";
import { money } from "./prototype-shell";

// Prototype: the guest-facing event page is the editor. Hover shows what's
// editable; clicking a part swaps it for an inline field. A small checklist
// shows what's still missing. Editorial look: serif headline, dark band.

type Part = "title" | "when" | "summary" | "tickets" | "spots" | null;

const editInputCls =
  "w-full rounded-[8px] border-2 border-[#d9a441] bg-white px-4 py-2.5 text-[20px] text-[#1d1a16] outline-none";

function Editable({
  label,
  isEditing,
  onEdit,
  view,
  edit,
  onDone,
}: {
  label: string;
  isEditing: boolean;
  onEdit: () => void;
  view: ReactNode;
  edit: ReactNode;
  onDone: () => void;
}) {
  if (isEditing) {
    return (
      <div className="flex flex-col gap-3 rounded-[12px] bg-[#fff8e8] p-4 ring-2 ring-[#d9a441]">
        {edit}
        <button type="button" onClick={onDone} className="self-start min-h-[44px] rounded-[8px] bg-[#1d1a16] px-5 text-[17px] font-bold text-white">
          Done
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Edit ${label}`}
      className="group relative -m-2 block w-[calc(100%+16px)] rounded-[10px] p-2 text-left outline-none hover:bg-[#fff8e8] hover:ring-2 hover:ring-[#d9a441]/60 focus-visible:ring-2 focus-visible:ring-[#d9a441]"
    >
      {view}
      <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-[#d9a441] px-3 py-1 text-[14px] font-bold text-[#1d1a16] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
        Edit
      </span>
    </button>
  );
}

export function OnThePageFlow() {
  const [event, setEvent] = useState<PrototypeEvent>({ ...SAMPLE_EVENT, summary: "", tickets: [] });
  const [editing, setEditing] = useState<Part>(null);
  const set = (patch: Partial<PrototypeEvent>) => setEvent((current) => ({ ...current, ...patch }));
  const done = () => setEditing(null);

  const missing = [
    !event.summary && { part: "summary" as const, label: "A short description" },
    event.tickets.length === 0 && { part: "tickets" as const, label: "Ticket prices" },
  ].filter(Boolean) as Array<{ part: Exclude<Part, null>; label: string }>;

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <article className="overflow-hidden rounded-[20px] bg-[#faf7f2] text-[#1d1a16] shadow-[0_10px_40px_rgba(29,26,22,0.12)]">
        <div className="flex aspect-[16/6] items-end bg-[linear-gradient(135deg,#3a3326,#6b5a3a)] p-8">
          <button type="button" className="rounded-full bg-white/90 px-4 py-2 text-[16px] font-semibold">
            + Add a photo
          </button>
        </div>
        <div className="flex flex-col gap-8 p-8 sm:p-12">
          <div className="flex flex-col gap-3">
            <p className="m-0 text-[15px] font-semibold uppercase tracking-[0.14em] text-[#8a6a2a]">
              {event.kind} · {event.property}
            </p>
            <Editable
              label="title"
              isEditing={editing === "title"}
              onEdit={() => setEditing("title")}
              onDone={done}
              view={<h1 className="m-0 font-serif text-[52px] font-semibold leading-[1.05] tracking-[-0.02em]">{event.title}</h1>}
              edit={<input autoFocus aria-label="Event name" className={editInputCls} value={event.title} onChange={(e) => set({ title: e.target.value })} />}
            />
          </div>

          <div className="grid gap-6 border-y border-[#e6dccb] py-6 sm:grid-cols-2">
            <div className={editing === "when" ? "sm:col-span-2" : undefined}>
            <Editable
              label="date and time"
              isEditing={editing === "when"}
              onEdit={() => setEditing("when")}
              onDone={done}
              view={
                <div>
                  <p className="m-0 text-[15px] text-[#6d6352]">When</p>
                  <p className="m-0 mt-1 text-[21px] font-semibold">
                    {event.date}, {event.startTime} to {event.endTime}
                  </p>
                </div>
              }
              edit={
                <div className="grid gap-3 sm:grid-cols-3">
                  <input aria-label="Date" className={editInputCls} value={event.date} onChange={(e) => set({ date: e.target.value })} />
                  <input aria-label="Starts" className={editInputCls} value={event.startTime} onChange={(e) => set({ startTime: e.target.value })} />
                  <input aria-label="Ends" className={editInputCls} value={event.endTime} onChange={(e) => set({ endTime: e.target.value })} />
                </div>
              }
            />
            </div>
            <Editable
              label="spots"
              isEditing={editing === "spots"}
              onEdit={() => setEditing("spots")}
              onDone={done}
              view={
                <div>
                  <p className="m-0 text-[15px] text-[#6d6352]">Spots</p>
                  <p className="m-0 mt-1 text-[21px] font-semibold">{event.spots} shooters</p>
                </div>
              }
              edit={<input type="number" aria-label="Spots" className={editInputCls} value={event.spots} onChange={(e) => set({ spots: Number(e.target.value) })} />}
            />
          </div>

          <Editable
            label="description"
            isEditing={editing === "summary"}
            onEdit={() => setEditing("summary")}
            onDone={done}
            view={
              event.summary ? (
                <p className="m-0 max-w-[60ch] text-[20px] leading-[1.6]">{event.summary}</p>
              ) : (
                <p className="m-0 rounded-[10px] border-2 border-dashed border-[#d9c9a8] px-5 py-6 text-[19px] text-[#8a7a5a]">
                  + Add a short description guests will read
                </p>
              )
            }
            edit={
              <textarea
                autoFocus
                aria-label="Description"
                rows={4}
                className={editInputCls}
                value={event.summary}
                onChange={(e) => set({ summary: e.target.value })}
              />
            }
          />

          <section className="flex flex-col gap-4">
            <h2 className="m-0 font-serif text-[30px] font-semibold tracking-[-0.01em]">Tickets</h2>
            <Editable
              label="tickets"
              isEditing={editing === "tickets"}
              onEdit={() => setEditing("tickets")}
              onDone={done}
              view={
                event.tickets.length ? (
                  <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {event.tickets.map((ticket) => (
                      <li key={ticket.name} className="flex justify-between rounded-[10px] bg-white px-5 py-4 text-[20px]">
                        <span>{ticket.name}</span>
                        <strong>{money(ticket.price)}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="m-0 rounded-[10px] border-2 border-dashed border-[#d9c9a8] px-5 py-6 text-[19px] text-[#8a7a5a]">
                    + Add ticket prices
                  </p>
                )
              }
              edit={
                <button
                  type="button"
                  onClick={() => set({ tickets: SAMPLE_EVENT.tickets })}
                  className="self-start rounded-[8px] border-2 border-[#d9a441] bg-white px-5 py-3 text-[18px]"
                >
                  Use member $65 / non-member $95 / junior $40
                </button>
              }
            />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="m-0 font-serif text-[30px] font-semibold tracking-[-0.01em]">What to bring</h2>
            <ul className="m-0 flex flex-col gap-2 pl-6 text-[19px]">
              {event.gear.map((item) => (
                <li key={item.name}>
                  <strong>{item.name}:</strong> {item.note}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </article>

      <aside className="self-start rounded-[16px] bg-[#1d1a16] p-6 text-white xl:sticky xl:top-6">
        <p className="m-0 text-[15px] font-semibold uppercase tracking-[0.12em] text-[#d9a441]">Before you publish</p>
        {missing.length === 0 ? (
          <p className="m-0 mt-3 text-[19px]">Everything's filled in.</p>
        ) : (
          <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
            {missing.map((item) => (
              <li key={item.part}>
                <button type="button" onClick={() => setEditing(item.part)} className="text-left text-[19px] underline underline-offset-4">
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          disabled={missing.length > 0}
          className="mt-6 min-h-[54px] w-full rounded-[10px] bg-[#d9a441] text-[18px] font-bold text-[#1d1a16] disabled:opacity-40"
        >
          Publish
        </button>
        <p className="m-0 mt-4 text-[16px] text-white/70">Tip: hover any part of the page and click to change it.</p>
      </aside>
    </div>
  );
}
