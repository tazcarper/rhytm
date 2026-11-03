// Turns "repeat this event" into the list of dates each copy runs on.
// Pure date math on "YYYY-MM-DD" calendar dates (no time zones involved:
// every copy keeps the first event's wall-clock start and end times).
//
// Used by the admin editor's repeat picker and by the AI helper, so both
// produce the same dates for the same choice.

export const REPEAT_FREQUENCIES = [
  "daily",
  "weekly",
  "every_2_weeks",
  "monthly_same_weekday",
  "monthly_same_date",
] as const;

export type RepeatFrequency = (typeof REPEAT_FREQUENCIES)[number];

export const REPEAT_FREQUENCY_LABELS: Record<RepeatFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  every_2_weeks: "Every 2 weeks",
  monthly_same_weekday: "Monthly, same weekday (e.g. 2nd Wednesday)",
  monthly_same_date: "Monthly, same date",
};

// The editor and the helper both cap a series here: a year of weekly dates.
export const MAX_REPEAT_OCCURRENCES = 52;

const DAY_MS = 86_400_000;

function parseDate(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

// Same day of the month; a month without that day (the 31st in April) uses
// its last day instead.
function monthlySameDate(first: Date, monthsAhead: number): Date {
  const year = first.getUTCFullYear();
  const monthIndex = first.getUTCMonth() + monthsAhead;
  const day = Math.min(first.getUTCDate(), daysInMonth(year, monthIndex));
  return new Date(Date.UTC(year, monthIndex, day));
}

// Same weekday in the same week of the month ("2nd Wednesday"). If the
// first date is a 5th weekday and a month has only four, the last one is used.
function monthlySameWeekday(first: Date, monthsAhead: number): Date {
  const weekday = first.getUTCDay();
  const weekOfMonth = Math.floor((first.getUTCDate() - 1) / 7);
  const year = first.getUTCFullYear();
  const monthIndex = first.getUTCMonth() + monthsAhead;
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const firstMatchDay = 1 + ((weekday - firstOfMonth.getUTCDay() + 7) % 7);
  let day = firstMatchDay + weekOfMonth * 7;
  if (day > daysInMonth(year, monthIndex)) day -= 7;
  return new Date(Date.UTC(year, monthIndex, day));
}

const NEXT_DATE: Record<RepeatFrequency, (first: Date, step: number) => Date> = {
  daily: (first, step) => new Date(first.getTime() + step * DAY_MS),
  weekly: (first, step) => new Date(first.getTime() + step * 7 * DAY_MS),
  every_2_weeks: (first, step) => new Date(first.getTime() + step * 14 * DAY_MS),
  monthly_same_weekday: monthlySameWeekday,
  monthly_same_date: monthlySameDate,
};

// Every date in the series, the first date included. `occurrences` is the
// total number of events, clamped to 1..MAX_REPEAT_OCCURRENCES. Returns an
// empty list for a date that isn't "YYYY-MM-DD".
export function repeatDates(firstDate: string, frequency: RepeatFrequency, occurrences: number): string[] {
  const first = parseDate(firstDate);
  if (!first) return [];
  const count = Math.max(1, Math.min(MAX_REPEAT_OCCURRENCES, Math.floor(occurrences)));
  return Array.from({ length: count }, (_, step) => formatDate(NEXT_DATE[frequency](first, step)));
}
