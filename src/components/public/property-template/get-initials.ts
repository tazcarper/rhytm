// Initials for a person's name — the fallback content for PersonAvatar
// when there's no photo. "Ben Morton" -> "BM"; a single name uses just its
// first letter; any middle names are ignored (first + last only, the
// common monogram convention).
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}
