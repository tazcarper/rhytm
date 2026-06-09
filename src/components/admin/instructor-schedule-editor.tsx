"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/lib/ui";
import {
  addInstructorExceptionAction,
  deleteInstructorExceptionAction,
  saveInstructorScheduleAction,
} from "@/app/admin/instructors/actions";
import {
  addInstructorSelfExceptionAction,
  deleteInstructorSelfExceptionAction,
  saveInstructorSelfScheduleAction,
} from "@/app/instructor/profile/actions";
import type {
  AvailabilityWindow,
  ExceptionKind,
  ScheduleException,
} from "@/src/services/admin/instructor-schedule";

// Two editors for one instructor's schedule:
//   1. Recurring weekly windows per property (replace-all save).
//   2. Date-specific exceptions — time off + one-off availability (add/delete).
// Times are property-local "HH:MM". The recurring set is held in local state and
// saved as a whole; exceptions mutate one row at a time and re-read from the
// server (router.refresh), so the list always reflects the DB.

const labelCls = "block font-sans text-[12px] tracking-[0.5px] uppercase text-gray mb-1";
const inputCls =
  "border border-rule rounded px-3 py-2 font-serif text-[15px] text-olive focus:border-olive focus:outline-none bg-paper";
const sectionTitleCls = "font-serif font-semibold text-[22px] text-olive mt-8 mb-3";

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

interface WindowDraft {
  key: string;
  propertyId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

const CLOCK_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function InstructorScheduleEditor({
  instructorId,
  properties,
  initialWindows,
  initialExceptions,
  mode = "admin",
}: {
  instructorId: string;
  properties: ReadonlyArray<{ id: string; name: string }>;
  initialWindows: ReadonlyArray<AvailabilityWindow>;
  initialExceptions: ReadonlyArray<ScheduleException>;
  // "admin" edits the passed instructorId (gated by requireInstructorManager);
  // "self" edits the signed-in instructor (the self actions ignore instructorId
  // and resolve the current instructor server-side).
  mode?: "admin" | "self";
}) {
  const router = useRouter();
  const propertyNameById = new Map(properties.map((property) => [property.id, property.name]));

  // ---- Recurring weekly windows -------------------------------------------
  const [isSavingSchedule, startScheduleTransition] = useTransition();
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const keyCounter = useRef(0);
  const makeKey = () => `new-${(keyCounter.current += 1)}`;

  const [windows, setWindows] = useState<WindowDraft[]>(() =>
    initialWindows.map((window) => ({
      key: `existing-${window.id}`,
      propertyId: window.propertyId,
      dayOfWeek: window.dayOfWeek,
      startTime: window.startTime,
      endTime: window.endTime,
    })),
  );

  const addWindow = (propertyId: string, dayOfWeek: number) =>
    setWindows((current) => [
      ...current,
      { key: makeKey(), propertyId, dayOfWeek, startTime: "09:00", endTime: "11:00" },
    ]);

  const updateWindow = (key: string, patch: Partial<WindowDraft>) =>
    setWindows((current) =>
      current.map((window) => (window.key === key ? { ...window, ...patch } : window)),
    );

  const removeWindow = (key: string) =>
    setWindows((current) => current.filter((window) => window.key !== key));

  // Quick-start: drop a 9–5 window on every day of the week that doesn't already
  // have one for this property. Non-destructive — existing windows are kept, so
  // the admin can then trim weekends or adjust a day. Still requires Save.
  const fillStandardWeek = (propertyId: string) =>
    setWindows((current) => {
      const additions: WindowDraft[] = [];
      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const alreadyScheduled = current.some(
          (window) => window.propertyId === propertyId && window.dayOfWeek === dayOfWeek,
        );
        if (!alreadyScheduled) {
          additions.push({
            key: makeKey(),
            propertyId,
            dayOfWeek,
            startTime: "09:00",
            endTime: "17:00",
          });
        }
      }
      return [...current, ...additions];
    });

  const saveSchedule = () => {
    setScheduleError(null);
    setScheduleSaved(false);

    const hasBlankTime = windows.some(
      (window) => !CLOCK_PATTERN.test(window.startTime) || !CLOCK_PATTERN.test(window.endTime),
    );
    if (hasBlankTime) {
      setScheduleError("Fill in a start and end time for every window.");
      return;
    }
    const hasBadRange = windows.some((window) => window.startTime >= window.endTime);
    if (hasBadRange) {
      setScheduleError("Each window's end time must be after its start time.");
      return;
    }

    startScheduleTransition(async () => {
      const windowInputs = windows.map((window) => ({
        propertyId: window.propertyId,
        dayOfWeek: window.dayOfWeek,
        startTime: window.startTime,
        endTime: window.endTime,
      }));
      const result =
        mode === "self"
          ? await saveInstructorSelfScheduleAction({ windows: windowInputs })
          : await saveInstructorScheduleAction({ instructorId, windows: windowInputs });
      if (!result.ok) {
        setScheduleError(result.error);
        return;
      }
      setScheduleSaved(true);
      router.refresh();
    });
  };

  // ---- Exceptions ----------------------------------------------------------
  const [isMutatingException, startExceptionTransition] = useTransition();
  const [exceptionError, setExceptionError] = useState<string | null>(null);
  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionKind, setExceptionKind] = useState<ExceptionKind>("unavailable");
  const [exceptionPropertyId, setExceptionPropertyId] = useState(""); // "" = all properties
  const [exceptionWholeDay, setExceptionWholeDay] = useState(true);
  const [exceptionStart, setExceptionStart] = useState("09:00");
  const [exceptionEnd, setExceptionEnd] = useState("11:00");
  const [exceptionReason, setExceptionReason] = useState("");

  // One-off availability must be property- and window-scoped.
  const requiresWindow = exceptionKind === "available";
  const wholeDay = requiresWindow ? false : exceptionWholeDay;

  const changeKind = (kind: ExceptionKind) => {
    setExceptionKind(kind);
    if (kind === "available" && exceptionPropertyId === "") {
      setExceptionPropertyId(properties[0]?.id ?? "");
    }
  };

  const resetExceptionForm = () => {
    setExceptionDate("");
    setExceptionKind("unavailable");
    setExceptionPropertyId("");
    setExceptionWholeDay(true);
    setExceptionStart("09:00");
    setExceptionEnd("11:00");
    setExceptionReason("");
  };

  const addException = () => {
    setExceptionError(null);
    if (!exceptionDate) {
      setExceptionError("Pick a date for the exception.");
      return;
    }
    if (requiresWindow && exceptionPropertyId === "") {
      setExceptionError("One-off availability needs a specific property.");
      return;
    }
    const startTime = wholeDay ? null : exceptionStart;
    const endTime = wholeDay ? null : exceptionEnd;
    if (startTime !== null && endTime !== null && startTime >= endTime) {
      setExceptionError("End time must be after start time.");
      return;
    }

    startExceptionTransition(async () => {
      const exceptionInput = {
        propertyId: exceptionPropertyId === "" ? null : exceptionPropertyId,
        date: exceptionDate,
        kind: exceptionKind,
        startTime,
        endTime,
        reason: exceptionReason.trim() || undefined,
      };
      const result =
        mode === "self"
          ? await addInstructorSelfExceptionAction(exceptionInput)
          : await addInstructorExceptionAction({ instructorId, ...exceptionInput });
      if (!result.ok) {
        setExceptionError(result.error);
        return;
      }
      resetExceptionForm();
      router.refresh();
    });
  };

  const removeException = (exceptionId: string) => {
    setExceptionError(null);
    startExceptionTransition(async () => {
      const result =
        mode === "self"
          ? await deleteInstructorSelfExceptionAction({ exceptionId })
          : await deleteInstructorExceptionAction({ instructorId, exceptionId });
      if (!result.ok) {
        setExceptionError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2 max-w-3xl">
      {properties.length === 0 ? (
        <Alert variant="info" title="No properties assigned">
          Assign this instructor to a property on their profile before setting a schedule.
        </Alert>
      ) : (
        <>
          {/* Recurring weekly schedule */}
          <div className={sectionTitleCls}>Weekly hours</div>
          {scheduleError && (
            <Alert variant="error" title="Couldn't save the schedule">
              {scheduleError}
            </Alert>
          )}
          {scheduleSaved && (
            <Alert variant="success" title="Saved">
              Weekly schedule updated.
            </Alert>
          )}

          <div className="flex flex-col gap-6">
            {properties.map((property) => (
              <fieldset
                key={property.id}
                className="border border-rule rounded-card p-4 m-0"
              >
                <legend className="font-serif font-semibold text-[16px] text-olive px-2">
                  {property.name}
                </legend>
                <div className="flex justify-end mb-2">
                  <button
                    type="button"
                    className="font-sans text-[12px] uppercase tracking-[0.5px] text-olive underline underline-offset-2"
                    onClick={() => fillStandardWeek(property.id)}
                  >
                    Fill week with 9–5
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {DAY_LABELS.map((dayLabel, dayOfWeek) => {
                    const dayWindows = windows.filter(
                      (window) =>
                        window.propertyId === property.id && window.dayOfWeek === dayOfWeek,
                    );
                    return (
                      <div
                        key={dayOfWeek}
                        className="flex items-start gap-3 flex-wrap py-1 border-b border-rule/40 last:border-0"
                      >
                        <span className="font-sans text-[13px] text-olive w-24 pt-2">
                          {dayLabel}
                        </span>
                        <div className="flex flex-col gap-2 flex-1">
                          {dayWindows.length === 0 ? (
                            <span className="font-serif italic text-[14px] text-gray pt-2">
                              Unavailable
                            </span>
                          ) : (
                            dayWindows.map((window) => (
                              <div key={window.key} className="flex items-center gap-2">
                                <input
                                  type="time"
                                  className={inputCls}
                                  value={window.startTime}
                                  onChange={(event) =>
                                    updateWindow(window.key, { startTime: event.target.value })
                                  }
                                />
                                <span className="text-gray">–</span>
                                <input
                                  type="time"
                                  className={inputCls}
                                  value={window.endTime}
                                  onChange={(event) =>
                                    updateWindow(window.key, { endTime: event.target.value })
                                  }
                                />
                                <button
                                  type="button"
                                  className="font-sans text-[12px] uppercase tracking-[0.5px] text-[color:var(--error)] ml-1"
                                  onClick={() => removeWindow(window.key)}
                                >
                                  Remove
                                </button>
                              </div>
                            ))
                          )}
                          <button
                            type="button"
                            className="self-start font-sans text-[12px] uppercase tracking-[0.5px] text-olive underline underline-offset-2"
                            onClick={() => addWindow(property.id, dayOfWeek)}
                          >
                            + Add hours
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="mt-4">
            <Button
              type="button"
              variant="primary"
              loading={isSavingSchedule}
              onClick={saveSchedule}
            >
              {isSavingSchedule ? "Saving…" : "Save weekly schedule"}
            </Button>
          </div>

          {/* Date-specific exceptions */}
          <div className={sectionTitleCls}>Time off &amp; one-off availability</div>
          {exceptionError && (
            <Alert variant="error" title="Couldn't update exceptions">
              {exceptionError}
            </Alert>
          )}

          {initialExceptions.length === 0 ? (
            <p className="font-serif italic text-[14px] text-gray">No exceptions yet.</p>
          ) : (
            <ul className="flex flex-col gap-1 m-0 p-0 list-none">
              {initialExceptions.map((exception) => (
                <li
                  key={exception.id}
                  className="flex items-center gap-3 flex-wrap border border-rule rounded px-3 py-2"
                >
                  <span className="font-sans text-[13px] text-olive">{exception.date}</span>
                  <span
                    className={`font-sans text-[11px] uppercase tracking-[0.5px] rounded-pill px-2 py-[2px] border ${
                      exception.kind === "available"
                        ? "text-[color:var(--success)] border-[color:var(--success)]"
                        : "text-[color:var(--error)] border-[color:var(--error)]"
                    }`}
                  >
                    {exception.kind === "available" ? "Extra hours" : "Time off"}
                  </span>
                  <span className="font-serif text-[14px] text-olive">
                    {exception.propertyId
                      ? propertyNameById.get(exception.propertyId) ?? "Unknown property"
                      : "All properties"}
                  </span>
                  <span className="font-serif text-[14px] text-gray">
                    {exception.startTime && exception.endTime
                      ? `${exception.startTime}–${exception.endTime}`
                      : "All day"}
                  </span>
                  {exception.reason && (
                    <span className="font-serif italic text-[13px] text-gray">
                      {exception.reason}
                    </span>
                  )}
                  <button
                    type="button"
                    className="ml-auto font-sans text-[12px] uppercase tracking-[0.5px] text-[color:var(--error)] disabled:opacity-40"
                    disabled={isMutatingException}
                    onClick={() => removeException(exception.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="border border-rule rounded-card p-4 mt-3 flex flex-col gap-3">
            <span className="font-serif font-semibold text-[16px] text-olive">Add an exception</span>
            <div className="flex gap-3 flex-wrap items-end">
              <label className="block">
                <span className={labelCls}>Date</span>
                <input
                  type="date"
                  className={inputCls}
                  value={exceptionDate}
                  onChange={(event) => setExceptionDate(event.target.value)}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Type</span>
                <select
                  className={inputCls}
                  value={exceptionKind}
                  onChange={(event) => changeKind(event.target.value as ExceptionKind)}
                >
                  <option value="unavailable">Time off</option>
                  <option value="available">Extra hours</option>
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Property</span>
                <select
                  className={inputCls}
                  value={exceptionPropertyId}
                  onChange={(event) => setExceptionPropertyId(event.target.value)}
                >
                  {!requiresWindow && <option value="">All properties</option>}
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex gap-3 flex-wrap items-end">
              {!requiresWindow && (
                <label className="flex items-center gap-2 pb-2">
                  <input
                    type="checkbox"
                    checked={exceptionWholeDay}
                    onChange={(event) => setExceptionWholeDay(event.target.checked)}
                  />
                  <span className="font-serif text-[14px] text-olive">Whole day</span>
                </label>
              )}
              {!wholeDay && (
                <>
                  <label className="block">
                    <span className={labelCls}>From</span>
                    <input
                      type="time"
                      className={inputCls}
                      value={exceptionStart}
                      onChange={(event) => setExceptionStart(event.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className={labelCls}>To</span>
                    <input
                      type="time"
                      className={inputCls}
                      value={exceptionEnd}
                      onChange={(event) => setExceptionEnd(event.target.value)}
                    />
                  </label>
                </>
              )}
              <label className="block flex-1 min-w-[180px]">
                <span className={labelCls}>Reason (optional)</span>
                <input
                  type="text"
                  className={`${inputCls} w-full`}
                  value={exceptionReason}
                  placeholder="Vacation, special clinic…"
                  onChange={(event) => setExceptionReason(event.target.value)}
                />
              </label>
            </div>

            <div>
              <Button
                type="button"
                variant="secondary"
                loading={isMutatingException}
                onClick={addException}
              >
                Add exception
              </Button>
            </div>
            {requiresWindow && (
              <p className="font-serif italic text-[13px] text-gray m-0">
                Extra hours add availability outside the weekly pattern, so they need a specific
                property and time window.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
