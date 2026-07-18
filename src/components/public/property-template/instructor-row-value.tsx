import type { PublicInstructor } from "@/src/services/public/instructors";
import { InstructorHoverCard } from "./instructor-hover-card";

// The event detail page's `instructors` field is free text (e.g. "Ben
// Morton, Casey Duran") — events aren't structurally linked to the real
// instructor roster. This matches each comma-separated name against the
// property's roster by exact name (case-insensitive) so a real match gets
// the hover card; anything that doesn't match (a guest instructor, a typo)
// still renders as plain text rather than breaking.
export function InstructorRowValue({
  instructorsText,
  roster,
}: {
  instructorsText: string;
  roster: ReadonlyArray<PublicInstructor>;
}) {
  const rosterByName = new Map(roster.map((instructor) => [instructor.name.trim().toLowerCase(), instructor]));
  const names = instructorsText
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  return (
    <span>
      {names.map((name, index) => {
        const matched = rosterByName.get(name.toLowerCase());
        return (
          <span key={`${name}-${index}`}>
            {index > 0 && ", "}
            {matched ? <InstructorHoverCard instructor={matched} /> : name}
          </span>
        );
      })}
    </span>
  );
}
