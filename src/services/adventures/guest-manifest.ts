// Guest manifest helpers — the additional guests in an RSVP's party
// (beyond the lead member). Stored as a jsonb array of { name } on
// member_adventure_rsvps.guests. Shared by the member portal (edit), the
// admin roster (display), and the save service (write), so parsing and
// normalization live in exactly one place.

export interface GuestManifestEntry {
  name: string;
}

// Tolerant read of the jsonb column → a clean entry list. Accepts the
// canonical [{ name }] shape and also bare strings (["Sam", …]) defensively,
// dropping anything blank. Never throws.
export function parseGuestManifest(value: unknown): GuestManifestEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: GuestManifestEntry[] = [];
  for (const item of value) {
    const name =
      typeof item === "string"
        ? item
        : item && typeof item === "object" && typeof (item as { name?: unknown }).name === "string"
          ? (item as { name: string }).name
          : "";
    const trimmed = name.trim();
    if (trimmed) entries.push({ name: trimmed });
  }
  return entries;
}

// Normalize names submitted from the editor before writing: trim, drop
// blanks, collapse whitespace, and cap to `max` (= guest_count - 1). Order
// is preserved.
export function normalizeGuestNames(names: string[], max: number): GuestManifestEntry[] {
  const cap = Math.max(0, max);
  return names
    .map((n) => n.replace(/\s+/g, " ").trim())
    .filter((n) => n.length > 0)
    .slice(0, cap)
    .map((name) => ({ name }));
}
