import type { AdminInquiryEvent, InquiryEventType } from "@/src/services/admin/inquiries";

const EVENT_LABEL: Record<InquiryEventType, string> = {
  note: "Note added",
  contacted: "Contacted",
  denied: "Denied",
  resolved: "Marked resolved",
};

function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  }).format(new Date(iso));
}

// Chronological audit trail for one inquiry — every note, contact, denial,
// and the resolve action itself. This is what an admin sees when they open
// a resolved inquiry: not just the final state, but what happened.
export function InquiryAuditLog({ events }: { events: AdminInquiryEvent[] }) {
  if (events.length === 0) {
    return <p className="font-serif italic text-[15px] text-gray m-0">No activity yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {events.map((event) => (
        <li key={event.id} className="border-l-2 border-rule pl-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-olive">
              {EVENT_LABEL[event.eventType]}
            </span>
            <span className="text-micro text-gray">{formatTimestamp(event.createdAt)}</span>
          </div>
          {event.note && <p className="mt-1 text-[13px] text-olive m-0">{event.note}</p>}
        </li>
      ))}
    </ol>
  );
}
