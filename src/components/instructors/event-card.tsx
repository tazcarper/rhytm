import Link from "next/link";
import {
  formatDateLongTz,
  formatSlotLabelTz,
} from "@/src/services/public/format";
import type { InstructorEventSummary } from "@/src/services/instructors/events";
import s from "./event-card.module.css";

// One row in the instructor's upcoming list. The whole card is a tap target
// into the full gameplan. Shows just enough to recognize the event at a
// glance: when, who, party size, what they're shooting, and where.
export function EventCard({ event }: { event: InstructorEventSummary }) {
  const dateLabel = formatDateLongTz(event.startTime, event.timezone);
  const timeLabel = formatSlotLabelTz(event.startTime, event.timezone);
  const partyLabel =
    event.guestCount === 1 ? "1 guest" : `${event.guestCount} guests`;

  return (
    <Link href={`/instructor/${event.bookingId}`} className={s.card}>
      <div className={s.when}>
        <span className={s.date}>{dateLabel}</span>
        <span className={s.time}>
          {timeLabel} CT · {event.durationHours} hr
        </span>
      </div>

      <div className={s.guest}>
        <span className={s.guestName}>{event.guestName}</span>
        <span className={s.party}>{partyLabel}</span>
      </div>

      {event.activities.length > 0 && (
        <ul className={s.chips}>
          {event.activities.map((activity) => (
            <li key={activity} className={s.chip}>
              {activity}
            </li>
          ))}
        </ul>
      )}

      <span className={s.property}>{event.propertyName}</span>
    </Link>
  );
}
