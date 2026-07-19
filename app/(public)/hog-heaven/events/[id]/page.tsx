import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicPropertyBySlug } from "@/src/services/public/properties";
import { getPublicEvent } from "@/src/services/public/events";
import { getPublicInstructorsForProperty } from "@/src/services/public/instructors";
import { PropertyImage } from "@/src/components/public/property-template/property-image";
import { EventContentBand } from "@/src/components/public/property-template/event-content-band";
import { EventRegistrationForm } from "@/src/components/public/property-template/event-registration-form";
import { InstructorRowValue } from "@/src/components/public/property-template/instructor-row-value";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  }).format(new Date(iso));
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  }).format(new Date(iso));
}

function audienceLabel(audience: "members_and_public" | "members_only"): string {
  return audience === "members_only" ? "Members Only" : "Members & Public";
}

function formatPrice(value: number | null): string {
  return value === null ? "Free" : `$${value.toFixed(0)}`;
}

export default async function HogHeavenEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const [event, { data: property }] = await Promise.all([
    getPublicEvent(supabase, id),
    getPublicPropertyBySlug(supabase, "hog-heaven"),
  ]);

  if (!event) {
    notFound();
  }

  const instructorRoster = property ? await getPublicInstructorsForProperty(supabase, property.id) : [];

  const infoRows: Array<[string, ReactNode]> = event.startAt
    ? [
        ["Date", formatDate(event.startAt)],
        ["Time", formatTime(event.startAt)],
        ["Location", event.location || property?.name || "Hog Heaven Sporting Club"],
      ]
    : [
        ["Schedule", event.scheduleText || "—"],
        ["Location", event.location || property?.name || "Hog Heaven Sporting Club"],
      ];
  if (event.instructors) {
    infoRows.push(["Instructors", <InstructorRowValue instructorsText={event.instructors} roster={instructorRoster} />]);
  }
  infoRows.push(["Capacity", `${event.maxCapacity} spots`]);

  return (
    <main>
      <div className="mx-auto max-w-property-max px-property-gutter pt-10">
        <p className="font-property-sans text-[13px] uppercase tracking-[0.15em] text-property-ink">
          <Link href="/hog-heaven/events" className="transition-colors hover:text-property-accent">
            Events Calendar
          </Link>
          <span className="mx-2 text-property-ink-variant">/</span>
          <span>{event.title}</span>
        </p>
      </div>

      <div className="mx-auto max-w-property-max px-property-gutter py-10">
        <section className="grid grid-cols-1 items-stretch gap-12 lg:grid-cols-12">
          <div className="flex lg:col-span-7">
            <div className="min-h-[420px] w-full overflow-hidden border border-property-ink/10">
              <div className="relative min-h-[420px]">
                <PropertyImage src={event.imageUrl} alt="" filename="event.jpg" />
              </div>
            </div>
          </div>
          <div className="flex flex-col lg:col-span-5">
            {(event.type || event.discipline) && (
              <p className="mb-3 font-property-sans text-[13px] uppercase tracking-[0.2em] text-property-accent-dark">
                {[event.type, event.discipline].filter(Boolean).join(" · ")}
              </p>
            )}
            <div className="mb-3 flex flex-wrap gap-2">
              {event.includedWithMembership && (
                <span className="inline-block border border-property-ink/20 px-3 py-1 font-property-sans text-[11px] uppercase tracking-widest text-property-ink">
                  ✓ Included with Membership
                </span>
              )}
              {event.audience === "members_only" && (
                <span className="inline-block border border-property-ink/20 px-3 py-1 font-property-sans text-[11px] uppercase tracking-widest text-property-ink">
                  {audienceLabel(event.audience)}
                </span>
              )}
            </div>
            {event.isSoldOut && (
              <p className="mb-3 font-property-sans text-[13px] uppercase tracking-[0.2em] text-property-accent-dark">
                Sold Out — Waitlist Open
              </p>
            )}
            <h1 className="property-headline font-property-display text-4xl uppercase leading-tight text-property-ink md:text-5xl">
              {event.title}
            </h1>
            <div className="space-y-3 border-y border-property-ink/10 py-6 mt-6">
              {infoRows.map(([label, value]) => (
                <div key={label} className="flex items-baseline gap-4">
                  <span className="w-28 shrink-0 font-property-sans text-[11px] uppercase tracking-widest text-property-ink-variant">
                    {label}
                  </span>
                  <span className="font-property-sans text-property-ink">{value}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-8">
              <div className="mb-6 flex items-end gap-8">
                <div>
                  <p className="mb-1 font-property-sans text-[10px] uppercase tracking-widest text-property-ink-variant">
                    Member
                  </p>
                  <p className="property-display font-property-display text-3xl text-property-ink">
                    {formatPrice(event.memberPrice)}
                  </p>
                </div>
                <div>
                  <p className="mb-1 font-property-sans text-[10px] uppercase tracking-widest text-property-ink-variant">
                    Non-Member
                  </p>
                  <p className="property-display font-property-display text-3xl text-property-ink">
                    {formatPrice(event.nonMemberPrice)}
                  </p>
                </div>
              </div>
              <EventRegistrationForm eventId={event.id} maxGuestsPerRegistration={event.maxGuestsPerRegistration} />
            </div>
          </div>
        </section>

        {event.description && (
          <EventContentBand heading="About This Event">
            <div className="font-property-sans text-property-body-lg text-property-ink">
              {event.description.split(/\n\n+/).map((paragraph) => (
                <p key={paragraph} className="mb-4 last:mb-0">
                  {paragraph}
                </p>
              ))}
            </div>
          </EventContentBand>
        )}

        {event.infoBoxes.map((box) => (
          <EventContentBand key={box.id} heading={box.heading}>
            {box.boxType === "description" ? (
              <p className="whitespace-pre-wrap font-property-sans text-property-body-lg text-property-ink">
                {box.body}
              </p>
            ) : (
              <ul className="flex flex-col gap-3 font-property-sans text-property-body-lg text-property-ink">
                {(box.items ?? []).map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-property-ink" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </EventContentBand>
        ))}
      </div>

      <div className="border-t border-property-ink/10">
        <div className="mx-auto max-w-property-max px-property-gutter py-10 text-center">
          <Link
            href="/hog-heaven/events"
            className="font-property-sans text-[13px] uppercase tracking-widest text-property-ink transition-colors hover:text-property-accent"
          >
            &larr; Back to Calendar
          </Link>
        </div>
      </div>
    </main>
  );
}
