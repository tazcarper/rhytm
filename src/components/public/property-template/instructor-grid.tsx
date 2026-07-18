"use client";

import { useMemo, useState } from "react";
import { PersonAvatar } from "./person-avatar";
import { PropertyButton } from "./property-button";

export interface InstructorProfile {
  name: string;
  disciplines: ReadonlyArray<string>;
  bio: string;
  photoUrl?: string | null;
}

interface InstructorGridProps {
  instructors: ReadonlyArray<InstructorProfile>;
  bookHref: string;
}

// Discipline-filterable instructor roster (education.html "Meet The
// Instructors"). Filters are derived from the roster passed in, so a
// filter pill can never appear with nobody behind it — same rule the
// mockup's own inline JS enforced.
export function InstructorGrid({ instructors, bookHref }: InstructorGridProps) {
  const [discipline, setDiscipline] = useState("All");

  const disciplines = useMemo(() => {
    const set = new Set<string>();
    instructors.forEach((i) => i.disciplines.forEach((d) => set.add(d)));
    return ["All", ...[...set].sort()];
  }, [instructors]);

  const visible = instructors.filter(
    (i) => discipline === "All" || i.disciplines.includes(discipline),
  );

  return (
    <div>
      <div className="mb-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <span className="shrink-0 font-property-sans text-[11px] uppercase tracking-widest text-property-accent-dark sm:w-20 sm:text-right">
          Discipline
        </span>
        <div className="flex flex-wrap justify-center gap-3">
          {disciplines.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDiscipline(d)}
              className={`border px-6 py-2 font-property-sans text-property-label uppercase transition-all ${
                d === discipline
                  ? "border-property-accent bg-property-ink text-white"
                  : "border-property-ink/25 text-property-ink/90 hover:border-property-ink hover:text-property-ink"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center font-property-sans text-property-ink/50">
          No instructors match this filter yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {visible.map((instructor) => (
            <div key={instructor.name} className="flex flex-col">
              <PersonAvatar
                name={instructor.name}
                photoUrl={instructor.photoUrl}
                className="mb-6 aspect-[4/5] w-full"
                initialsClassName="text-6xl"
              />
              <span className="mb-2 font-property-sans text-xs uppercase text-property-accent-dark">
                {instructor.disciplines.join(" · ")}
              </span>
              <h3 className="property-headline mb-2 font-property-display text-2xl uppercase text-property-ink">
                {instructor.name}
              </h3>
              <p className="mb-6 flex-grow font-property-sans text-property-ink-variant">
                {instructor.bio || "Bio coming soon."}
              </p>
              <PropertyButton href={bookHref} variant="ink" size="sm" className="self-start">
                Book Lesson
              </PropertyButton>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
