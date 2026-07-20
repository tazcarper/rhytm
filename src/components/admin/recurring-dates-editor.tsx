"use client";

import { useState } from "react";
import { Button } from "@/lib/ui";
import s from "./bid-editor-form.module.css";

// Recurring-dates picker for the New event form only. Generates a list of
// extra ISO dates (same time-of-day as the Starts/Ends fields above) — the
// form then bulk-creates one independent events row per date via
// saveRecurringEventsAction, rather than modeling recurrence as an array on
// a single row (see saveRecurringEvents in src/services/admin/events.ts for
// why: this keeps every occurrence's capacity/roster independent, matching
// how the rest of this app's event registration already works).

const FREQUENCY_OPTIONS = [
  { label: "Weekly", days: 7 },
  { label: "Every 2 weeks", days: 14 },
  { label: "Monthly", days: 30 },
  { label: "Daily", days: 1 },
];

function fmtDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[month - 1]} ${day}, ${year}`;
}

export function RecurringDatesEditor({
  startDate,
  extraDates,
  onChange,
}: {
  startDate: string;
  extraDates: string[];
  onChange: (dates: string[]) => void;
}) {
  const [enabled, setEnabled] = useState(extraDates.length > 0);
  const [frequencyDays, setFrequencyDays] = useState(7);
  const [occurrences, setOccurrences] = useState(4);
  const [manualDate, setManualDate] = useState("");

  function generate() {
    if (!startDate) return;
    const dates: string[] = [];
    let cursor = new Date(`${startDate}T00:00:00`);
    for (let i = 1; i < Math.max(1, Math.min(52, occurrences)); i++) {
      cursor = new Date(cursor.getTime() + frequencyDays * 86400000);
      dates.push(cursor.toISOString().slice(0, 10));
    }
    onChange(dates);
  }

  function addManualDate() {
    if (!manualDate || extraDates.includes(manualDate)) return;
    onChange([...extraDates, manualDate].sort());
    setManualDate("");
  }

  function removeDate(date: string) {
    onChange(extraDates.filter((d) => d !== date));
  }

  return (
    <div className="mt-3">
      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(evt) => {
            setEnabled(evt.target.checked);
            if (!evt.target.checked) onChange([]);
          }}
        />
        <span className="text-[14px] text-olive">Repeat this event on more dates</span>
      </label>

      {enabled && (
        <div className="mt-3 rounded-card border border-dashed border-rule p-4 bg-paper-warm">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-[13px] text-gray">Quick add:</span>
            <select
              value={frequencyDays}
              onChange={(evt) => setFrequencyDays(Number(evt.target.value))}
              className={s.input}
              style={{ width: "auto" }}
            >
              {FREQUENCY_OPTIONS.map((option) => (
                <option key={option.label} value={option.days}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="text-[13px] text-gray">for</span>
            <input
              type="number"
              min={1}
              max={52}
              value={occurrences}
              onChange={(evt) => setOccurrences(Number(evt.target.value) || 1)}
              className={s.input}
              style={{ width: "4rem" }}
            />
            <span className="text-[13px] text-gray">occurrences</span>
            <Button type="button" variant="ghost" size="sm" onClick={generate} disabled={!startDate}>
              Generate
            </Button>
          </div>

          <div className="flex gap-2 mb-3">
            <input
              type="date"
              value={manualDate}
              onChange={(evt) => setManualDate(evt.target.value)}
              className={s.input}
            />
            <Button type="button" variant="ghost" size="sm" onClick={addManualDate}>
              Add date
            </Button>
          </div>

          {extraDates.length === 0 ? (
            <p className="text-[12px] text-gray italic m-0">No additional dates yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {extraDates.map((date) => (
                <span
                  key={date}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-rule bg-paper px-2.5 py-1 text-[12px] text-olive"
                >
                  {fmtDate(date)}
                  <button
                    type="button"
                    onClick={() => removeDate(date)}
                    className="text-tan-deep font-bold leading-none"
                    aria-label={`Remove ${date}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="text-[12px] text-gray mt-2 mb-0">
            Each date becomes its own event with its own registrations and capacity.
          </p>
        </div>
      )}
    </div>
  );
}
