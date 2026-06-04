import { Badge, Card, Eyebrow, Heading, PageShell } from "@/lib/ui";
import type { SharedTrip } from "@/src/services/public/shared-trip";
import type { BookingType } from "@/src/services/members/bookings";
import {
  formatDateLongTz,
  formatSlotLabelTz,
} from "@/src/services/public/format";

const BOOKING_TYPE_LABELS: Record<BookingType, string> = {
  plan_a_visit: "Plan a Visit",
  private_lesson: "Private Lesson",
  host_an_occasion: "Host an Occasion",
};

// Anonymous, read-only trip overview for /trip/<token>. Property-branded
// (matches the host's identity for recipients who may not be members).
// Mirrors the member booking-detail sections MINUS anything sensitive —
// no pricing, payment, contact info, status, or bid access.
export function SharedTripView({ trip }: { trip: SharedTrip }) {
  const dateLabel = formatDateLongTz(trip.startTime, trip.property.timezone);
  const startLabel = formatSlotLabelTz(trip.startTime, trip.property.timezone);
  const endLabel = formatSlotLabelTz(trip.endTime, trip.property.timezone);

  return (
    <PageShell width="narrow">
      <Eyebrow as="div" className="mb-2">
        {trip.property.name}
      </Eyebrow>
      <Heading level={1} size="h1" underline>
        You&rsquo;re <em>invited</em>
      </Heading>
      <p className="font-serif italic text-tan-deep text-[16px] mt-1 mb-6">
        Hosted by {trip.hostName}
      </p>

      <div className="flex flex-col gap-6">
        {trip.shareNote && (
          <Card padding="loose">
            <Eyebrow as="div" className="mb-2">
              A note from {trip.hostName}
            </Eyebrow>
            <p className="font-serif text-[16px] text-olive whitespace-pre-line leading-[1.6] m-0">
              {trip.shareNote}
            </p>
          </Card>
        )}

        <Card padding="loose">
          <Eyebrow as="div" className="mb-2">
            {BOOKING_TYPE_LABELS[trip.bookingType]}
          </Eyebrow>
          <Heading level={2} size="h2">
            {dateLabel}
          </Heading>
          <div className="font-serif italic text-tan-deep text-[16px] mt-1">
            {startLabel} &ndash; {endLabel} &middot; {trip.property.name}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 mt-5 pt-5 border-t border-rule font-sans text-[13px]">
            <DefRow label="Party size">{trip.guestCount}</DefRow>
            {trip.instructor && <DefRow label="Instructor">{trip.instructor.name}</DefRow>}
            <DefRow label="Duration">{trip.durationHours}h</DefRow>
          </dl>
        </Card>

        {trip.scheduleNotes && (
          <Card padding="loose">
            <Eyebrow as="div" className="mb-2">
              From the team
            </Eyebrow>
            <Heading level={3} size="h3" underline>
              What to expect
            </Heading>
            <div className="mt-4 font-serif text-[16px] text-olive whitespace-pre-line leading-[1.6]">
              {trip.scheduleNotes}
            </div>
          </Card>
        )}

        {(trip.disciplines.length > 0 || trip.addOns.length > 0) && (
          <Card padding="loose">
            <Eyebrow as="div" className="mb-2">
              Activities
            </Eyebrow>
            <Heading level={3} size="h3" underline>
              What&rsquo;s planned
            </Heading>
            {trip.disciplines.length > 0 && (
              <ul className="mt-4 m-0 pl-5 text-olive font-serif text-[15px]">
                {trip.disciplines.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
            )}
            {trip.addOns.length > 0 && (
              <div className="mt-5 pt-5 border-t border-rule">
                <Eyebrow as="div" className="mb-2">
                  Add-ons
                </Eyebrow>
                <ul className="m-0 pl-5 text-olive font-serif text-[15px]">
                  {trip.addOns.map((name, i) => (
                    <li key={i}>{name}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )}

        {trip.gearList.length > 0 && (
          <Card padding="loose">
            <Eyebrow as="div" className="mb-2">
              Gear list
            </Eyebrow>
            <Heading level={3} size="h3" underline>
              What to bring
            </Heading>
            <ul className="mt-4 m-0 pl-5 text-olive font-serif text-[15px] flex flex-col gap-2">
              {trip.gearList.map((item, i) => (
                <li key={`${item.name}-${i}`}>
                  {item.name}
                  {item.quantity !== null && (
                    <span className="text-gray font-mono text-[13px]"> × {item.quantity}</span>
                  )}
                  {item.required && (
                    <Badge variant="filling" className="ml-2 text-[11px] align-middle">
                      required
                    </Badge>
                  )}
                  {item.description && (
                    <div className="text-gray font-serif italic text-[14px] mt-1">
                      {item.description}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {trip.faq.length > 0 && (
          <Card padding="loose">
            <Eyebrow as="div" className="mb-2">
              Common questions
            </Eyebrow>
            <Heading level={3} size="h3" underline>
              Good to know
            </Heading>
            <dl className="mt-4 flex flex-col gap-5">
              {trip.faq.map((entry, i) => (
                <div key={`${entry.question}-${i}`}>
                  <dt className="font-serif italic text-olive text-[16px] m-0">{entry.question}</dt>
                  <dd className="text-gray font-serif text-[15px] mt-1 leading-[1.6] m-0">
                    {entry.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        )}
      </div>
    </PageShell>
  );
}

function DefRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-gray tracking-[0.5px] uppercase">{label}</dt>
      <dd className="text-olive m-0">{children}</dd>
    </>
  );
}
