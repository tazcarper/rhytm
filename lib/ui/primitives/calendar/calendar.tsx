"use client";

import { DayPicker, type DayPickerProps } from "react-day-picker";
import s from "./calendar.module.css";

export type CalendarProps = DayPickerProps;

// Thin wrapper around react-day-picker v10. `navLayout="around"` places
// the prev/next buttons as siblings of MonthCaption inside the .month
// element; .month is then a 3-column grid that lays them out in one row.
// Selection mode and handlers come from the caller.
export function Calendar({ classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      navLayout="around"
      classNames={{
        root: s.root,
        months: s.months,
        month: s.month,
        button_previous: s.navBtn,
        button_next: s.navBtn,
        chevron: s.chevron,
        month_caption: s.caption,
        caption_label: s.captionLabel,
        month_grid: s.grid,
        weekdays: s.weekdays,
        weekday: s.weekday,
        week: s.week,
        day: s.day,
        day_button: s.dayBtn,
        today: s.today,
        outside: s.outside,
        disabled: s.disabled,
        selected: s.selected,
        hidden: s.hidden,
        ...classNames,
      }}
      {...props}
    />
  );
}
