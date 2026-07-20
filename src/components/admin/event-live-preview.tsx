import { Badge } from "@/lib/ui";
import s from "./event-live-preview.module.css";

// Content-accurate preview of the event being edited — not a pixel clone of
// any one property's branded public page (each property has its own
// property-template theming; matching that per-property here is out of
// scope). Styled with this app's real product tokens so it reads
// consistently with the rest of /admin, and tells the admin exactly what
// data will be saved and shown publicly.

export interface EventPreviewData {
  title: string;
  type: string;
  discipline: string;
  featured: boolean;
  includedWithMembership: boolean;
  audience: "members_and_public" | "members_only";
  dateLabel: string;
  timeLabel: string;
  location: string;
  instructors: string;
  capacityLabel: string;
  imageUrl: string;
  description: string;
  expectItems: ReadonlyArray<{ heading: string; items: string[] }>;
  memberPrice: string;
  nonMemberPrice: string;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className={s.metaRow}>
      <span className={s.metaLabel}>{label}</span>
      <span className={s.metaValue}>{value}</span>
    </div>
  );
}

export function EventLivePreview({ event }: { event: EventPreviewData }) {
  const eyebrow = [event.type, event.discipline].filter(Boolean).join(" · ") || "Type · Discipline";

  return (
    <div>
      <p className={s.panelTitle}>Live preview</p>
      <div className={s.card}>
        <div
          className={s.imageSlot}
          style={event.imageUrl ? { backgroundImage: `url('${event.imageUrl}')` } : undefined}
        >
          {!event.imageUrl && "Image slot (16:9)"}
        </div>
        <div className={s.body}>
          <span className={s.eyebrow}>{eyebrow}</span>
          <div className={s.title}>{event.title || "Event name"}</div>

          <div className={s.tags}>
            {event.featured && <Badge variant="open">★ Featured</Badge>}
            {event.includedWithMembership && <Badge variant="tierMember">✓ Included with membership</Badge>}
            <Badge variant="neutral">
              {event.audience === "members_only" ? "Members only" : "Members & public"}
            </Badge>
          </div>

          <div className={s.meta}>
            <MetaRow label="Date" value={event.dateLabel} />
            <MetaRow label="Time" value={event.timeLabel} />
            <MetaRow label="Location" value={event.location} />
            <MetaRow label="Instructors" value={event.instructors} />
            <MetaRow label="Capacity" value={event.capacityLabel} />
          </div>

          <p className={s.desc}>{event.description || "Description appears here."}</p>

          {event.expectItems.map((box, index) => (
            <div key={index}>
              <p className={s.expectHeading}>{box.heading}</p>
              <ul className={s.expect}>
                {box.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{item}</li>
                ))}
              </ul>
            </div>
          ))}

          {(event.memberPrice || event.nonMemberPrice) && (
            <div className={s.price}>
              {event.memberPrice && (
                <div>
                  <span className={s.priceValue}>{event.memberPrice}</span>
                  <span className={s.priceLabel}>Member</span>
                </div>
              )}
              {event.nonMemberPrice && (
                <div>
                  <span className={s.priceValue}>{event.nonMemberPrice}</span>
                  <span className={s.priceLabel}>Non-member</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
