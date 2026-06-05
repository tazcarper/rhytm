// Timestamp formatter for the dev dashboard tables. Extracted from the
// monolithic page so it has a single home (SRP).
export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toISOString().replace("T", " ").slice(0, 19);
  } catch {
    return value;
  }
}
