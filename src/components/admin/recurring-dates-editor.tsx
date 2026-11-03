"use client";

import { useEffect, useState } from "react";
import { Button } from "@/lib/ui";
import {
  REPEAT_FREQUENCIES,
  MAX_REPEAT_OCCURRENCES,
  repeatDates,
  type RepeatFrequency,
} from "@/src/services/events/repeat-dates";
import s from "./bid-editor-form.module.css";

// "Repeats" picker for the event form. Produces the list of extra dates
// (beyond the Starts date), each at the same time of day. The form then
// creates one independent event per date (see saveRecurringEvents in
// src/services/admin/events.ts for why: each date keeps its own sign-ups
// and spots, matching how event registration already works).
//
// The date list updates as soon as the pattern changes, so staff see the
// exact dates before saving. They can also drop a date or add a one-off.

// Wording for the "Repeat ___" dropdown, read as a sentence.
const FREQUENCY_PHRASES: Record<RepeatFrequency, string> = {
  daily: "every day",
  weekly: "every week",
  every_2_weeks: "every other week",
  monthly_same_weekday: "every month on the same weekday (like the 2nd Wednesday)",
  monthly_same_date: "every month on the same date",
};

const DEFAULT_TOTAL = 4;

function fmtDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function RecurringDatesEditor({
  startDate,
  extraDates,
  onChange,
  isExistingEvent = false,
}: {
  startDate: string;
  extraDates: string[];
  onChange: (dates: string[]) => void;
  // On an existing event the extra dates become copies of it.
  isExistingEvent?: boolean;
}) {
  const [enabled, setEnabled] = useState(extraDates.length > 0);
  const [frequency, setFrequency] = useState<RepeatFrequency>("weekly");
  const [total, setTotal] = useState(DEFAULT_TOTAL);
  const [manualDate, setManualDate] = useState("");

  // The first date is the Starts date, which already exists as this event.
  const fill = (nextFrequency: RepeatFrequency, nextTotal: number) => {
    if (!startDate) return;
    onChange(repeatDates(startDate, nextFrequency, nextTotal).slice(1));
  };

  // A new Starts date moves the whole series with it.
  useEffect(() => {
    if (enabled) fill(frequency, total);
    // Only the start date should re-run this; the handlers cover the rest.
  }, [startDate]); // eslint-disable-line react-hooks/exhaustive-deps

  function addManualDate() {
    if (!manualDate || manualDate === startDate || extraDates.includes(manualDate)) return;
    onChange([...extraDates, manualDate].sort());
    setManualDate("");
  }

  return (
    <div className="mt-3">
      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(evt) => {
            setEnabled(evt.target.checked);
            if (evt.target.checked) fill(frequency, total);
            else onChange([]);
          }}
        />
        <span className="text-[14px] text-olive">
          {isExistingEvent ? "Add more dates for this event" : "This event happens more than once"}
        </span>
      </label>

      {enabled && (
        <div className="mt-3 rounded-card border border-dashed border-rule p-4 bg-paper-warm">
          {!startDate ? (
            <p className="text-[14px] text-gray m-0">Pick when it starts first, then choose how often it repeats.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[14px] text-olive">
                <span>Repeat</span>
                <select
                  value={frequency}
                  onChange={(evt) => {
                    const next = evt.target.value as RepeatFrequency;
                    setFrequency(next);
                    fill(next, total);
                  }}
                  className={s.input}
                  style={{ width: "auto" }}
                >
                  {REPEAT_FREQUENCIES.map((option) => (
                    <option key={option} value={option}>
                      {FREQUENCY_PHRASES[option]}
                    </option>
                  ))}
                </select>
                <span>,</span>
                <input
                  type="number"
                  min={2}
                  max={MAX_REPEAT_OCCURRENCES}
                  value={total}
                  onChange={(evt) => {
                    const next = Math.max(2, Math.min(MAX_REPEAT_OCCURRENCES, Number(evt.target.value) || 2));
                    setTotal(next);
                    fill(frequency, next);
                  }}
                  className={s.input}
                  style={{ width: "4.5rem" }}
                  aria-label="Number of dates in total"
                />
                <span>{isExistingEvent ? "dates in total, counting this one" : "dates in total"}</span>
              </div>

              <p className="mt-4 mb-2 text-[13px] font-semibold text-olive">
                {extraDates.length === 0
                  ? "No extra dates yet."
                  : isExistingEvent
                    ? `Saving adds ${extraDates.length} more ${extraDates.length === 1 ? "date" : "dates"}:`
                    : `Saving creates ${extraDates.length + 1} events:`}
              </p>
              <div className="flex flex-wrap gap-2">
                {!isExistingEvent && extraDates.length > 0 && (
                  <span className="inline-flex items-center rounded-pill border border-rule bg-paper px-2.5 py-1 text-[12px] text-olive">
                    {fmtDate(startDate)}
                  </span>
                )}
                {extraDates.map((date) => (
                  <span
                    key={date}
                    className="inline-flex items-center gap-1.5 rounded-pill border border-rule bg-paper px-2.5 py-1 text-[12px] text-olive"
                  >
                    {fmtDate(date)}
                    <button
                      type="button"
                      onClick={() => onChange(extraDates.filter((d) => d !== date))}
                      className="text-tan-deep font-bold leading-none"
                      aria-label={`Skip ${fmtDate(date)}`}
                      title="Skip this date"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[13px] text-gray">Add one more date:</span>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(evt) => setManualDate(evt.target.value)}
                  className={s.input}
                  style={{ width: "auto" }}
                />
                <Button type="button" variant="ghost" size="sm" onClick={addManualDate} disabled={!manualDate}>
                  Add
                </Button>
              </div>

              <p className="text-[12px] text-gray mt-3 mb-0">
                Each date is its own event, with its own sign-ups and spots. Click × to skip a date.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
