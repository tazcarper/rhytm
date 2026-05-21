// Shared formatters for the public booking funnel. Kept tiny so callers
// don't reach for a date lib — slot times and dates here are bounded to
// hour-aligned slots and YYYY-MM-DD inputs.

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
