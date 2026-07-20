"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PublicEventListItem } from "@/src/services/public/events";
import { PropertyImage } from "./property-image";
import { PropertyButton } from "./property-button";

interface EventsListingProps {
  events: ReadonlyArray<PublicEventListItem>;
  /** Standing (indefinite, schedule-only) programmes — no start_at, shown in
   *  their own section rather than mixed into the dated list/featured slot. */
  standingPrograms?: ReadonlyArray<PublicEventListItem>;
  /** e.g. "/horseshoe-bay" — prefixes every event detail link. */
  basePath: string;
}

function formatEventDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  }).format(new Date(iso));
}

function formatMonth(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "America/Chicago" })
    .format(new Date(iso))
    .toUpperCase();
}

function formatDay(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "America/Chicago" }).format(new Date(iso));
}

function catLine(event: PublicEventListItem): string {
  return [event.type, event.discipline].filter(Boolean).join(" · ");
}

function FilterGroup({
  label,
  options,
  active,
  onSelect,
}: {
  label: string;
  options: ReadonlyArray<string>;
  active: string;
  onSelect: (value: string) => void;
}) {
  // A group with only "All" (nothing else to filter by yet) is dead weight.
  if (options.length <= 1) return null;
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <span className="shrink-0 font-property-sans text-[11px] uppercase tracking-widest text-property-accent-dark">
        {label}
      </span>
      <div className="flex flex-wrap justify-center gap-3">
        {options.map((option) => {
          const isActive = option === active;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              className={
                isActive
                  ? "border border-property-accent bg-property-ink px-6 py-2 font-property-sans text-property-label uppercase text-property-bg transition-all"
                  : "border border-property-ink/25 px-6 py-2 font-property-sans text-property-label uppercase text-property-ink/90 transition-all hover:border-property-ink hover:text-property-ink"
              }
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Filters, the featured-event callout, and the upcoming-events list — all
// client-side over one already-fetched, already-capped-at-6 event set
// (src/services/public/events.ts), same "server fetches, client filters"
// split as the reference mockup's own vanilla-JS version. Filter options
// are derived from the events actually present, so a pill never appears
// with nothing behind it (e.g. no Pistol pill shows until a Pistol event
// exists).
export function EventsListing({ events, standingPrograms = [], basePath }: EventsListingProps) {
  const [type, setType] = useState("All");
  const [discipline, setDiscipline] = useState("All");

  const typeOptions = useMemo(() => {
    const set = new Set(events.map((event) => event.type).filter((value): value is string => Boolean(value)));
    return ["All", ...[...set].sort()];
  }, [events]);

  const disciplineOptions = useMemo(() => {
    const set = new Set(events.map((event) => event.discipline).filter((value): value is string => Boolean(value)));
    return ["All", ...[...set].sort()];
  }, [events]);

  const filtered = events.filter(
    (event) =>
      (type === "All" || event.type === type) && (discipline === "All" || event.discipline === discipline),
  );

  const featured = filtered.find((event) => event.featured);
  const rest = featured ? filtered.filter((event) => event.id !== featured.id) : filtered;

  const hasFilters = typeOptions.length > 1 || disciplineOptions.length > 1;

  return (
    <>
      {hasFilters && (
        <section className="border-b border-property-ink/10 bg-property-surface/50 py-12">
          <div className="mx-auto flex max-w-property-max flex-col items-center justify-center gap-x-10 gap-y-4 px-property-gutter sm:flex-row">
            <FilterGroup label="Type" options={typeOptions} active={type} onSelect={setType} />
            <FilterGroup label="Discipline" options={disciplineOptions} active={discipline} onSelect={setDiscipline} />
          </div>
        </section>
      )}

      <div className="mx-auto max-w-property-max px-property-gutter py-property-section-mobile md:py-property-section-desktop">
        {featured && (
          <div className="mb-24">
            <div className="flex flex-col overflow-hidden border border-property-ink/10 bg-property-surface-lowest lg:flex-row">
              <div className="relative h-96 overflow-hidden lg:h-auto lg:min-h-[360px] lg:w-7/12">
                <PropertyImage src={featured.imageUrl} alt="" filename="events.jpg" />
                <div className="absolute left-8 top-8 bg-property-ink px-4 py-1 font-property-sans text-property-label uppercase tracking-widest text-property-bg">
                  Featured Event
                </div>
              </div>
              <div className="flex flex-col justify-start p-8 lg:w-5/12 lg:p-12">
                <span className="mb-4 font-property-sans text-property-label uppercase text-property-ink">
                  {formatEventDate(featured.startAt)}
                </span>
                <h2 className="property-headline mb-6 font-property-display text-property-headline uppercase leading-tight text-property-ink">
                  {featured.title}
                </h2>
                {featured.summary && (
                  <p className="mb-8 font-property-sans text-property-body-lg leading-relaxed text-property-ink-variant">
                    {featured.summary}
                  </p>
                )}
                <div>
                  <PropertyButton href={`${basePath}/events/${featured.id}`} variant="ink" size="sm">
                    Details
                  </PropertyButton>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 mb-8">
          <h3 className="property-headline font-property-display text-[24px] uppercase tracking-wider text-property-ink">
            Upcoming Events
          </h3>
          <div className="h-px flex-grow bg-property-ink/20" />
        </div>

        {rest.length === 0 && !featured ? (
          <p className="font-property-sans italic text-property-ink-variant">
            No events scheduled right now — check back soon.
          </p>
        ) : rest.length === 0 ? (
          <p className="font-property-sans italic text-property-ink-variant">
            No other events scheduled right now — check back soon.
          </p>
        ) : (
          <div className="flex flex-col gap-12">
            {rest.map((event) => (
              <div key={event.id} className="grid grid-cols-1 items-center gap-8 border-b border-property-ink/10 pb-12 md:grid-cols-12">
                <div className="md:col-span-2">
                  <div className="flex flex-col text-center">
                    <span className="font-property-sans text-property-label uppercase text-property-accent-dark">
                      {formatMonth(event.startAt)}
                    </span>
                    <span className="property-display font-property-display text-[48px] leading-none text-property-ink">
                      {formatDay(event.startAt)}
                    </span>
                  </div>
                </div>
                <div className="md:col-span-3">
                  <div className="relative aspect-video overflow-hidden border border-property-ink/5">
                    <PropertyImage src={event.imageUrl} alt="" filename="events.jpg" />
                  </div>
                </div>
                <div className="md:col-span-5">
                  {catLine(event) && (
                    <span className="mb-2 block font-property-sans text-[11px] uppercase tracking-[0.2em] text-property-accent-dark">
                      {catLine(event)}
                    </span>
                  )}
                  <Link href={`${basePath}/events/${event.id}`} className="group block">
                    <h4 className="property-headline font-property-display text-[28px] uppercase text-property-ink transition-colors group-hover:text-property-accent-dark">
                      {event.title}
                    </h4>
                  </Link>
                  {event.summary && (
                    <p className="mt-2 font-property-sans text-property-body text-property-ink-variant">
                      {event.summary}
                    </p>
                  )}
                </div>
                <div className="md:col-span-2 md:text-right">
                  <PropertyButton
                    href={`${basePath}/events/${event.id}`}
                    variant="ink"
                    size="sm"
                    className="w-full md:w-auto"
                  >
                    Details
                  </PropertyButton>
                </div>
              </div>
            ))}
          </div>
        )}

        {standingPrograms.length > 0 && (
          <div className="mt-24">
            <div className="flex items-center gap-4 mb-8">
              <h3 className="property-headline font-property-display text-[24px] uppercase tracking-wider text-property-ink">
                Standing Programs
              </h3>
              <div className="h-px flex-grow bg-property-ink/20" />
            </div>
            <div className="flex flex-col gap-8">
              {standingPrograms.map((program) => (
                <div
                  key={program.id}
                  className="grid grid-cols-1 items-center gap-6 border-b border-property-ink/10 pb-8 md:grid-cols-12"
                >
                  <div className="md:col-span-8">
                    {catLine(program) && (
                      <span className="mb-2 block font-property-sans text-[11px] uppercase tracking-[0.2em] text-property-accent-dark">
                        {catLine(program)}
                      </span>
                    )}
                    <Link href={`${basePath}/events/${program.id}`} className="group block">
                      <h4 className="property-headline font-property-display text-[22px] uppercase text-property-ink transition-colors group-hover:text-property-accent-dark">
                        {program.title}
                      </h4>
                    </Link>
                    {program.scheduleText && (
                      <p className="mt-1 font-property-sans text-property-body text-property-ink-variant">
                        {program.scheduleText}
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-4 md:text-right">
                    <PropertyButton
                      href={`${basePath}/events/${program.id}`}
                      variant="ink"
                      size="sm"
                      className="w-full md:w-auto"
                    >
                      Details
                    </PropertyButton>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
