// Shared formatters for the public surface — funnel + bid page. Kept
// tiny so callers don't reach for a date lib; the two input shapes are:
//   - `YYYY-MM-DD` / `HH:MM` strings already pinned to wall-clock CT
//     (funnel: user picked a slot tile)
//   - timestamptz ISO + property timezone (bid page: DB-stored start_time)
// Both flavors render the same visible label, so the bid page and funnel
// stay copy-consistent.

export function formatSlotLabel(timeStr: string): string {
  const [hStr, mStr] = timeStr.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  const minSuffix = m === 0 ? "" : `:${mStr}`;
  return `${hour12}${minSuffix} ${period}`;
}

export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// Date-only range, collapsed like the adventures reference cards:
//   same month  → "December 4–9, 2026"
//   same year   → "December 30 – January 2, 2027"
//   single day  → "December 4, 2026"
// Inputs are 'YYYY-MM-DD' wall-clock dates (member_adventures.start_date /
// end_date are `date` columns — no time, no timezone). Built with a local
// Date so there's no UTC day-shift.
export function formatDateRange(startIso: string, endIso: string): string {
  const [y1, m1, d1] = startIso.split("-").map(Number);
  const [y2, m2, d2] = endIso.split("-").map(Number);
  const monthLong = (y: number, m: number): string =>
    new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long" });

  if (y1 === y2 && m1 === m2) {
    if (d1 === d2) return `${monthLong(y1, m1)} ${d1}, ${y1}`;
    return `${monthLong(y1, m1)} ${d1}–${d2}, ${y1}`;
  }
  if (y1 === y2) {
    return `${monthLong(y1, m1)} ${d1} – ${monthLong(y2, m2)} ${d2}, ${y1}`;
  }
  return `${monthLong(y1, m1)} ${d1}, ${y1} – ${monthLong(y2, m2)} ${d2}, ${y2}`;
}

export function formatMoney(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// Money with cents — for itemized financial surfaces (e.g. the bid quote
// breakdown) where the displayed lines must visibly sum to the displayed
// subtotal. formatMoney rounds to whole dollars for headline figures and can
// make a line-item list appear not to add up.
export function formatMoneyExact(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Round to cents. The single definition for money arithmetic across the app —
// pricing reconciliation, override math, and display all round the same way so
// they can never disagree by a sub-cent float artifact.
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Coerce a PostgREST numeric (Postgres `numeric` columns arrive as strings)
// into a number, preserving null. Callers that want a 0 default coalesce with
// `?? 0` at the call site, so a genuinely-absent value stays distinguishable
// from a real zero.
export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? parseFloat(value) : value;
}

// Module-level formatter caches. Intl.DateTimeFormat instantiation is
// the expensive part (>1ms); .format() on an existing instance is
// effectively free. With one timezone in use today this map degenerates
// to a singleton, but it survives the day a second property timezone
// shows up without an audit pass.
const dateLongCache = new Map<string, Intl.DateTimeFormat>();
const timeCache = new Map<string, Intl.DateTimeFormat>();

function dateLongFmt(timezone: string): Intl.DateTimeFormat {
  let fmt = dateLongCache.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: timezone,
    });
    dateLongCache.set(timezone, fmt);
  }
  return fmt;
}

function timeFmt(timezone: string): Intl.DateTimeFormat {
  let fmt = timeCache.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone,
    });
    timeCache.set(timezone, fmt);
  }
  return fmt;
}

// timestamptz-aware variants — bid page and any other consumer that
// holds a stored timestamp + needs to render in the property's zone.

export function formatDateLongTz(iso: string, timezone: string): string {
  return dateLongFmt(timezone).format(new Date(iso));
}

// Matches formatSlotLabel's "9 AM" / "11:30 AM" convention (drops :00).
export function formatSlotLabelTz(iso: string, timezone: string): string {
  const parts = timeFmt(timezone).formatToParts(new Date(iso));
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";
  const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value ?? "";
  return minute === "00"
    ? `${hour} ${dayPeriod}`
    : `${hour}:${minute} ${dayPeriod}`;
}
