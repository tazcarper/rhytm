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

export function formatMoney(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
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
