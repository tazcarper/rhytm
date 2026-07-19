import type { ReactNode } from "react";
import Link from "next/link";
import type { PublicEventListItem } from "@/src/services/public/events";
import { PropertyImage } from "./property-image";
import { SectionHeading } from "./section-heading";

interface UpcomingEventsStripProps {
  events: ReadonlyArray<PublicEventListItem>;
  /** e.g. "/horseshoe-bay" — prefixes both the "View Full Calendar" link
      and every event card's detail link. */
  basePath: string;
  heading: ReactNode;
  eyebrow?: ReactNode;
  viewAllLabel?: string;
  emptyMessage?: string;
}

function formatEventMonthDay(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  }).format(new Date(iso));
}

// The heading/link row + event-card grid + empty state shared by every
// property's homepage ("Featured Events") and Club Life page ("What's
// Next") — six call sites carried byte-identical markup before this was
// pulled out. Deliberately does NOT own the wrapping <Section> (tone
// varies per property/page — Hog Heaven's homepage uses "paper" where
// Horseshoe Bay's and Packsaddle's use "surfaceHighest" — so that stays
// visible and independently reviewable at each call site) or the
// eyebrow/heading copy (still passed in as props, not hidden inside the
// component).
export function UpcomingEventsStrip({
  events,
  basePath,
  heading,
  eyebrow,
  viewAllLabel = "View Full Calendar",
  emptyMessage = "No events scheduled right now — check back soon.",
}: UpcomingEventsStripProps) {
  return (
    <>
      <div className="mb-12 flex flex-col items-end justify-between gap-6 md:flex-row">
        <SectionHeading eyebrow={eyebrow} heading={heading} />
        <Link
          href={`${basePath}/events`}
          className="border-b border-property-ink pb-1 font-property-label text-property-eyebrow uppercase tracking-widest text-property-ink transition-colors hover:border-property-camel"
        >
          {viewAllLabel}
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="font-property-sans italic text-property-ink-variant">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`${basePath}/events/${event.id}`}
              className="group block border border-property-ink/10 bg-property-surface-lowest"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <PropertyImage src={event.imageUrl} alt="" filename="events.jpg" />
              </div>
              <div className="p-6">
                <h3 className="property-headline mb-2 font-property-display text-xl uppercase text-property-ink">
                  {event.title}
                </h3>
                <p className="font-property-sans text-sm text-property-ink-variant">
                  {formatEventMonthDay(event.startAt)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
