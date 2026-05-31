import { Badge, Card, Eyebrow, Heading } from "@/lib/ui";
import type {
  BookingDetail,
  BookingFaqEntry,
  BookingGearItem,
} from "@/src/services/members/booking-detail";
import type { BookingType } from "@/src/services/members/bookings";
import {
  formatDateLongTz,
  formatMoney,
  formatSlotLabelTz,
} from "@/src/services/public/format";

const BOOKING_TYPE_LABELS: Record<BookingType, string> = {
  plan_a_visit: "Plan a Visit",
  private_lesson: "Private Lesson",
  host_an_occasion: "Host an Occasion",
};

// Pure presentational composition of a booking's full detail view.
// Props in, JSX out. Each section is its own small component so
// admin preview-as-member can swap parts in App 3.8 if needed.
export function BookingDetailView({ booking }: { booking: BookingDetail }) {
  return (
    <div className="flex flex-col gap-6">
      <BookingSummarySection booking={booking} />
      {booking.bid?.scheduleNotes && (
        <ScheduleNotesSection notes={booking.bid.scheduleNotes} />
      )}
      <DisciplinesSection booking={booking} />
      {booking.bid && booking.bid.gearList.length > 0 && (
        <GearListSection items={booking.bid.gearList} />
      )}
      {booking.bid && booking.bid.faq.length > 0 && (
        <FaqSection entries={booking.bid.faq} />
      )}
      <PricingSection booking={booking} />
    </div>
  );
}

function BookingSummarySection({ booking }: { booking: BookingDetail }) {
  const dateLabel = formatDateLongTz(booking.startTime, booking.property.timezone);
  const startLabel = formatSlotLabelTz(booking.startTime, booking.property.timezone);
  const endLabel = formatSlotLabelTz(booking.endTime, booking.property.timezone);
  return (
    <Card padding="loose">
      <Eyebrow as="div" className="mb-2">
        {BOOKING_TYPE_LABELS[booking.bookingType]}
      </Eyebrow>
      <Heading level={2} size="h2">
        {dateLabel}
      </Heading>
      <div className="font-serif italic text-tan-deep text-[16px] mt-1">
        {startLabel} – {endLabel} &middot; {booking.property.name}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 mt-5 pt-5 border-t border-rule font-sans text-[13px]">
        <DefRow label="Guests">{booking.guestCount}</DefRow>
        {booking.instructor && (
          <DefRow label="Instructor">{booking.instructor.name}</DefRow>
        )}
        <DefRow label="Duration">{booking.durationHours}h</DefRow>
        <DefRow label="Status">{booking.status}</DefRow>
      </dl>

      {!booking.isMine && booking.bookedBy && (
        <p className="mt-5 pt-5 border-t border-rule font-serif italic text-[14px] text-tan-deep m-0">
          Booked by {booking.bookedBy.firstName} {booking.bookedBy.lastName}
        </p>
      )}
    </Card>
  );
}

function DefRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-gray tracking-[0.5px] uppercase">{label}</dt>
      <dd className="text-olive m-0">{children}</dd>
    </>
  );
}

function ScheduleNotesSection({ notes }: { notes: string }) {
  return (
    <Card padding="loose">
      <Eyebrow as="div" className="mb-2">
        From the team
      </Eyebrow>
      <Heading level={3} size="h3" underline>
        What to expect
      </Heading>
      <div className="mt-4 font-serif text-[16px] text-olive whitespace-pre-line leading-[1.6]">
        {notes}
      </div>
    </Card>
  );
}

function DisciplinesSection({ booking }: { booking: BookingDetail }) {
  if (booking.disciplines.length === 0 && booking.addOns.length === 0) {
    return null;
  }
  return (
    <Card padding="loose">
      <Eyebrow as="div" className="mb-2">
        Activities
      </Eyebrow>
      <Heading level={3} size="h3" underline>
        What you're booked for
      </Heading>
      {booking.disciplines.length > 0 && (
        <ul className="mt-4 m-0 pl-5 text-olive font-serif text-[15px]">
          {booking.disciplines.map((d) => (
            <li key={d.serviceId}>{d.serviceName}</li>
          ))}
        </ul>
      )}
      {booking.addOns.length > 0 && (
        <div className="mt-5 pt-5 border-t border-rule">
          <Eyebrow as="div" className="mb-2">
            Add-ons
          </Eyebrow>
          <ul className="m-0 pl-5 text-olive font-serif text-[15px]">
            {booking.addOns.map((a) => (
              <li key={`${a.serviceId}-${a.addOnId}`}>
                {a.addOnName} &middot;{" "}
                <span className="text-gray font-mono text-[13px]">
                  {a.quantity} × ${formatMoney(a.unitPrice)}
                </span>
                <span className="text-gray font-serif italic text-[13px]">
                  {" "}
                  ({a.serviceName})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function GearListSection({ items }: { items: BookingGearItem[] }) {
  return (
    <Card padding="loose">
      <Eyebrow as="div" className="mb-2">
        Gear list
      </Eyebrow>
      <Heading level={3} size="h3" underline>
        What to bring
      </Heading>
      <ul className="mt-4 m-0 pl-5 text-olive font-serif text-[15px] flex flex-col gap-2">
        {items.map((item, idx) => (
          <li key={`${item.name}-${idx}`}>
            <span className={item.required ? "text-olive" : "text-olive"}>
              {item.name}
            </span>
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
  );
}

function FaqSection({ entries }: { entries: BookingFaqEntry[] }) {
  return (
    <Card padding="loose">
      <Eyebrow as="div" className="mb-2">
        Common questions
      </Eyebrow>
      <Heading level={3} size="h3" underline>
        Good to know
      </Heading>
      <dl className="mt-4 flex flex-col gap-5">
        {entries.map((entry, idx) => (
          <div key={`${entry.question}-${idx}`}>
            <dt className="font-serif italic text-olive text-[16px] m-0">
              {entry.question}
            </dt>
            <dd className="text-gray font-serif text-[15px] mt-1 leading-[1.6] m-0">
              {entry.answer}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function PricingSection({ booking }: { booking: BookingDetail }) {
  const total = booking.pricing.confirmedPrice ?? booking.pricing.estimatedPrice;
  if (total === null && booking.pricing.amountPaid === 0) {
    return null;
  }
  const label =
    booking.pricing.confirmedPrice !== null ? "Total" : "Estimated total";
  return (
    <Card padding="loose">
      <Eyebrow as="div" className="mb-2">
        Billing
      </Eyebrow>
      <div className="flex flex-col gap-2 mt-2 font-sans text-[14px]">
        {total !== null && (
          <div className="flex justify-between">
            <span className="text-gray tracking-[0.5px] uppercase">{label}</span>
            <span className="text-olive font-mono">${formatMoney(total)}</span>
          </div>
        )}
        {booking.pricing.depositAmount !== null && (
          <div className="flex justify-between">
            <span className="text-gray tracking-[0.5px] uppercase">Deposit</span>
            <span className="text-olive font-mono">
              ${formatMoney(booking.pricing.depositAmount)}
            </span>
          </div>
        )}
        <div className="flex justify-between pt-2 border-t border-rule">
          <span className="text-gray tracking-[0.5px] uppercase">Paid</span>
          <span className="text-olive font-mono">
            ${formatMoney(booking.pricing.amountPaid)}
          </span>
        </div>
      </div>
    </Card>
  );
}
