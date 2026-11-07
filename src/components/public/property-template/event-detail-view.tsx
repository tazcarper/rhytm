import type { ReactNode } from "react";
import Link from "next/link";
import type { PublicEventDetail } from "@/src/services/public/events";
import type { PublicInstructor } from "@/src/services/public/instructors";
import { PropertyImage } from "./property-image";
import { EventRegistrationForm } from "./event-registration-form";
import { EventPriceBlock } from "./event-price-block";
import { InstructorRowValue } from "./instructor-row-value";
import { StaffOnlyBanner } from "./staff-only-badge";

// One event's public page, shared by every property. Layout follows the
// usual event/booking page pattern: the story on the left (photo, title,
// key facts, description, info boxes) and a sign-up card on the right that
// stays in view while the guest scrolls (price first, then the form). On
// phones the card comes right after the key facts, before the long text.

interface EventDetailViewProps {
  event: PublicEventDetail;
  /** e.g. "/horseshoe-bay" */
  basePath: string;
  propertyName: string;
  instructorRoster: ReadonlyArray<PublicInstructor>;
}

const TZ = "America/Chicago";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: TZ }).format(new Date(iso));
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
}

const LABEL = "font-property-label text-[11px] uppercase tracking-widest text-property-ink-variant";
const SECTION_HEADING = "property-headline font-property-display text-2xl uppercase text-property-ink md:text-[28px]";

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="border-t border-property-ink/10 pt-10">
      <h2 className={`${SECTION_HEADING} mb-5`}>{heading}</h2>
      <div className="max-w-[65ch] font-property-sans text-property-body-lg leading-relaxed text-property-ink">{children}</div>
    </section>
  );
}

export function EventDetailView({ event, basePath, propertyName, instructorRoster }: EventDetailViewProps) {
  const location = event.location || propertyName;
  const facts: Array<[string, ReactNode]> = event.startAt
    ? [
        ["Date", formatDate(event.startAt)],
        ["Time", formatTime(event.startAt)],
        ["Location", location],
      ]
    : [
        ["Schedule", event.scheduleText || "—"],
        ["Location", location],
      ];
  if (event.instructors) {
    facts.push(["Instructors", <InstructorRowValue key="i" instructorsText={event.instructors} roster={instructorRoster} />]);
  }
  facts.push(["Spots", `${event.maxCapacity} total`]);

  const category = [event.type, event.discipline].filter(Boolean).join(" · ");

  return (
    <div>
      {event.staffOnlyStatus && <StaffOnlyBanner status={event.staffOnlyStatus} editHref={`/admin/events/${event.id}`} />}

      <div className="mx-auto max-w-property-max px-property-gutter pt-8">
        <p className="font-property-label text-[12px] uppercase tracking-[0.15em] text-property-ink-variant">
          <Link href={`${basePath}/events`} className="transition-colors hover:text-property-accent">
            Events Calendar
          </Link>
          <span className="mx-2">/</span>
          <span className="text-property-ink">{event.title}</span>
        </p>
      </div>

      <div className="mx-auto grid max-w-property-max grid-cols-1 gap-x-16 gap-y-10 px-property-gutter pb-20 pt-8 lg:grid-cols-12">
        {/* Story, top: photo, title, key facts */}
        <div className="flex flex-col gap-8 lg:col-span-7 lg:row-start-1">
          <div className="relative aspect-[16/10] w-full overflow-hidden border border-property-ink/10">
            <PropertyImage src={event.imageUrl} alt="" filename="event.jpg" />
          </div>
          <div className="flex flex-col gap-4">
            {category && <p className="font-property-label text-[13px] uppercase tracking-[0.2em] text-property-accent-dark">{category}</p>}
            <h1 className="property-headline font-property-display text-4xl uppercase leading-[1.05] text-property-ink md:text-5xl">{event.title}</h1>
            {(event.includedWithMembership || event.audience === "members_only") && (
              <div className="flex flex-wrap gap-2">
                {event.includedWithMembership && (
                  <span className="border border-property-ink/20 px-3 py-1 font-property-label text-[11px] uppercase tracking-widest text-property-ink">
                    Included with membership
                  </span>
                )}
                {event.audience === "members_only" && (
                  <span className="border border-property-ink/20 px-3 py-1 font-property-label text-[11px] uppercase tracking-widest text-property-ink">
                    Members only
                  </span>
                )}
              </div>
            )}
            {event.summary && <p className="max-w-[60ch] font-property-sans text-property-body-lg text-property-ink-variant">{event.summary}</p>}
          </div>
          <dl className="m-0 grid grid-cols-1 gap-x-10 gap-y-5 border-t border-property-ink/10 pt-6 sm:grid-cols-2">
            {facts.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1">
                <dt className={LABEL}>{label}</dt>
                <dd className="m-0 font-property-sans text-property-body text-property-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Sign-up card: right column on desktop (sticky), after the facts on phones */}
        <aside className="lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
          <div className="flex flex-col gap-6 border border-property-ink/10 bg-property-surface-lowest p-6 shadow-sm md:p-8 lg:sticky lg:top-8">
            <EventPriceBlock
              memberPrice={event.memberPrice}
              nonMemberPrice={event.nonMemberPrice}
              showNonMember={event.audience !== "members_only"}
              earlyBird={event.earlyBird}
              includedWithMembership={event.includedWithMembership}
            />
            {event.isSoldOut && (
              <p className="font-property-label text-[13px] uppercase tracking-[0.2em] text-property-accent-dark">Sold out · waitlist open</p>
            )}
            <div className="flex flex-col gap-4 border-t border-property-ink/10 pt-6">
              <h2 className="font-property-display text-xl uppercase text-property-ink">
                {event.isSoldOut ? "Join the waitlist" : "Reserve your spot"}
              </h2>
              <EventRegistrationForm eventId={event.id} maxGuestsPerRegistration={event.maxGuestsPerRegistration} />
            </div>
          </div>
        </aside>

        {/* Story, bottom: description and info boxes */}
        <div className="flex flex-col gap-10 lg:col-span-7 lg:row-start-2">
          {event.description && (
            <Section heading="About this event">
              {event.description.split(/\n\n+/).map((paragraph) => (
                <p key={paragraph} className="mb-4 last:mb-0">
                  {paragraph}
                </p>
              ))}
            </Section>
          )}
          {event.infoBoxes.map((box) => (
            <Section key={box.id} heading={box.heading}>
              {box.boxType === "description" ? (
                <p className="whitespace-pre-wrap">{box.body}</p>
              ) : (
                <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
                  {(box.items ?? []).map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-property-accent" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          ))}
          <Link
            href={`${basePath}/events`}
            className="self-start font-property-label text-[13px] uppercase tracking-widest text-property-ink transition-colors hover:text-property-accent"
          >
            &larr; Back to calendar
          </Link>
        </div>
      </div>
    </div>
  );
}
