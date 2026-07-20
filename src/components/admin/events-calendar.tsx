"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DayPicker, type DayButtonProps } from "react-day-picker";
import "react-day-picker/style.css";
import { cn } from "@/lib/ui";
import type { EventDensity, EventDayCell } from "@/src/services/admin/events-calendar";
import s from "./events-calendar.module.css";

// Plain-object form of the density Map for the server→client boundary.
export type EventDayCellMap = Record<string, EventDayCell>;

export interface PropertyOption {
  id: string;
  name: string;
}

export interface EventsCalendarProps {
  /** Displayed month as "YYYY-MM". */
  month: string;
  /** Selected day as "YYYY-MM-DD", or null when none. */
  selectedDay: string | null;
  /** Selected property filter — a property id, or "all". */
  propertyId: string;
  properties: ReadonlyArray<PropertyOption>;
  /** Per-day density keyed by "YYYY-MM-DD" (property-timezone calendar date). */
  dayCells: EventDayCellMap;
  /** Today as "YYYY-MM-DD" in the property timezone (drives the today ring). */
  today: string;
  basePath: string;
}

const ALL_PROPERTIES = "all";

const DENSITY_CLASS: Record<EventDensity, string> = {
  empty: s.empty,
  light: s.light,
  busy: s.busy,
  full: s.full,
};

const DENSITY_LABEL: Record<EventDensity, string> = {
  empty: "empty",
  light: "light",
  busy: "busy",
  full: "full",
};

const LEGEND_ITEMS: ReadonlyArray<{ density: EventDensity; label: string }> = [
  { density: "empty", label: "None" },
  { density: "light", label: "1 (light)" },
  { density: "busy", label: "2 (busy)" },
  { density: "full", label: "3+ (full)" },
];

/** "YYYY-MM" → first-of-month Date at local midnight (rdp works in local time). */
function monthToDate(month: string): Date {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1);
}

/** "YYYY-MM-DD" → Date at local midnight. */
function dayToDate(day: string): Date {
  const [year, monthNumber, dayOfMonth] = day.split("-").map(Number);
  return new Date(year, monthNumber - 1, dayOfMonth);
}

/** Date → "YYYY-MM-DD" from local components (matches CalendarDay.isoDate). */
function dateToKey(date: Date): string {
  const year = date.getFullYear();
  const monthNumber = String(date.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(date.getDate()).padStart(2, "0");
  return `${year}-${monthNumber}-${dayOfMonth}`;
}

const READABLE_DATE = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
});

export function EventsCalendar({
  month,
  selectedDay,
  propertyId,
  properties,
  dayCells,
  today,
  basePath,
}: EventsCalendarProps) {
  const router = useRouter();

  const navigate = useCallback(
    (overrides: { month?: string; property?: string; day?: string; range?: string }) => {
      const queryParams = new URLSearchParams();
      queryParams.set("month", overrides.month ?? month);
      queryParams.set("property", overrides.property ?? propertyId);
      const nextDay = overrides.day ?? selectedDay;
      if (nextDay) queryParams.set("day", nextDay);
      router.push(`${basePath}?${queryParams.toString()}`);
    },
    [router, basePath, month, propertyId, selectedDay],
  );

  // Custom day cell: density-colored, with a numeric count + descriptive
  // aria-label so the state never reads as color-only. Memoized on the data
  // it closes over so rdp isn't handed a fresh component identity each render.
  const components = useMemo(
    () => ({
      DayButton: function DensityDayButton({
        day,
        modifiers,
        className,
        ...buttonProps
      }: DayButtonProps) {
        const dateKey = day.isoDate;
        const cell = dayCells[dateKey];
        const total = cell?.total ?? 0;
        const density = cell?.density ?? "empty";
        const isToday = dateKey === today;
        const isPast = dateKey < today;
        const isSelected = dateKey === selectedDay;
        const countLabel =
          total === 0 ? "no events" : `${total} ${total === 1 ? "event" : "events"}`;

        return (
          <button
            {...buttonProps}
            className={cn(
              className,
              s.day,
              DENSITY_CLASS[density],
              isToday && s.today,
              isPast && s.past,
              isSelected && s.selected,
            )}
            aria-label={`${READABLE_DATE.format(day.date)} — ${countLabel}, ${DENSITY_LABEL[density]}`}
          >
            <span className={s.dayNumber}>{day.date.getDate()}</span>
            {total > 0 && <span className={s.dayCount}>{total}</span>}
          </button>
        );
      },
    }),
    [dayCells, today, selectedDay],
  );

  return (
    <div className={s.wrap}>
      <div className={s.controls}>
        <div className={s.filter} role="group" aria-label="Filter by property">
          <button
            type="button"
            className={cn(s.filterButton, propertyId === ALL_PROPERTIES && s.filterActive)}
            aria-pressed={propertyId === ALL_PROPERTIES}
            onClick={() => navigate({ property: ALL_PROPERTIES })}
          >
            All properties
          </button>
          {properties.map((property) => (
            <button
              key={property.id}
              type="button"
              className={cn(s.filterButton, propertyId === property.id && s.filterActive)}
              aria-pressed={propertyId === property.id}
              onClick={() => navigate({ property: property.id })}
            >
              {property.name}
            </button>
          ))}
        </div>
      </div>

      <DayPicker
        mode="single"
        // Two months side-by-side (this month + next). One nav pair moves both;
        // the second month is hidden by CSS below tablet width.
        numberOfMonths={2}
        month={monthToDate(month)}
        onMonthChange={(nextMonth) => navigate({ month: dateToKey(nextMonth).slice(0, 7) })}
        selected={selectedDay ? dayToDate(selectedDay) : undefined}
        onSelect={(_selected, triggerDate) =>
          navigate({ day: dateToKey(triggerDate) })
        }
        today={dayToDate(today)}
        showOutsideDays={false}
        components={components}
        className={s.calendar}
      />

      <div className={s.legend}>
        <span className={s.legendLabel}>Events per day</span>
        {LEGEND_ITEMS.map((legendItem) => (
          <span key={legendItem.density} className={s.legendItem}>
            <span
              className={cn(s.legendSwatch, DENSITY_CLASS[legendItem.density])}
              aria-hidden="true"
            />
            {legendItem.label}
          </span>
        ))}
      </div>
    </div>
  );
}
