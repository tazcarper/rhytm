import { notFound } from "next/navigation";
import { Alert, Badge, Eyebrow, Heading } from "@/lib/ui";
import type { BadgeVariant } from "@/lib/ui";
import {
  getBidDetail,
  type BidDetail,
  type BidStatus,
} from "@/src/services/bids/get-bid";
import { parseBidUrlParams } from "@/src/services/bids/bid-url";
import { BOOKING_TYPE_META } from "@/src/constants/public/booking-types";
import {
  formatDateLongTz,
  formatMoney,
  formatSlotLabelTz,
} from "@/src/services/public/format";
import { MarkdownProse } from "@/src/components/shared/markdown";
import { BidTimeline } from "@/src/components/public/bid-timeline";
import s from "./bid-page.module.css";

// Public bid page. Outside the booking funnel — does NOT mount
// BookingFlowProvider; reads everything from Postgres via the bid slug
// + access code.
//
// Five status branches (see Phase 3 bid_status_enum):
//   pending_review → hero + "we're preparing your bid". No embeds.
//   confirmed      → full bid + active sign + pay placeholder slots.
//   signed         → confirmed view, signature slot marked done.
//   paid           → all slots done; "we'll see you on <date>".
//   denied / expired → "no longer active" + no embeds.
//
// Stripe deposit (App 6) and Dropbox Sign signature (App 7) render as
// labeled placeholder cards — those phases swap the slot, not the
// surrounding chrome.

export const dynamic = "force-dynamic";

export default async function BidPage({
  params,
}: {
  params: Promise<{ slug: string; code: string }>;
}) {
  const routeParams = await params;
  const parsed = parseBidUrlParams(routeParams);
  if (!parsed) notFound();

  const detail = await getBidDetail(parsed.slug, parsed.code);
  if (!detail) notFound();

  return (
    <main className={s.wrap}>
      <BidHero detail={detail} />
      {showsTimeline(detail.bid.status) && (
        <BidTimeline status={detail.bid.status} />
      )}
      <StatusBanner status={detail.bid.status} detail={detail} />

      {isActiveBid(detail.bid.status) && (
        <>
          <GuestSummary detail={detail} />
          <DisciplineSection detail={detail} />
          <GearList detail={detail} />
          <ScheduleSection detail={detail} />
          <FaqSection detail={detail} />
          <MapSlot detail={detail} />
          <SignatureSlot status={detail.bid.status} detail={detail} />
          <DepositSlot status={detail.bid.status} detail={detail} />
        </>
      )}

      <ContactFooter detail={detail} />
    </main>
  );
}

// ============================================================
// Status helpers
// ============================================================

// pending_review and denied/expired show only the hero + status banner.
// The other three (confirmed / signed / paid) render the full bid body
// including signature + deposit slots — signed/paid show those slots in
// a "done" state rather than hiding them, so the guest can see the
// trail of what they've completed.
function isActiveBid(status: BidStatus): boolean {
  return (
    status === "confirmed" || status === "signed" || status === "paid"
  );
}

// Timeline shows for every non-terminal status. denied/expired are off-path
// — no progression to track.
function showsTimeline(status: BidStatus): boolean {
  return status !== "denied" && status !== "expired";
}

function statusBadge(status: BidStatus): {
  variant: BadgeVariant;
  label: string;
} {
  switch (status) {
    case "pending_review":
      return { variant: "draft", label: "In review" };
    case "confirmed":
      return { variant: "open", label: "Confirmed" };
    case "signed":
      return { variant: "filling", label: "Signed" };
    case "paid":
      return { variant: "open", label: "Booked" };
    case "denied":
      return { variant: "past", label: "Closed" };
    case "expired":
      return { variant: "past", label: "Expired" };
  }
}

// ============================================================
// Sections
// ============================================================

function BidHero({ detail }: { detail: BidDetail }) {
  const { booking, property, bid } = detail;
  const badge = statusBadge(bid.status);
  const dateLong = formatDateLongTz(booking.startTime, property.timezone);
  const start = formatSlotLabelTz(booking.startTime, property.timezone);
  const end = formatSlotLabelTz(booking.endTime, property.timezone);

  return (
    <header className={s.hero}>
      <Eyebrow variant="crest" as="div" className={s.heroEyebrow}>
        Your Bid
      </Eyebrow>
      <Heading level={1} size="display" className={s.heroTitle}>
        {property.name}
      </Heading>
      <p className={s.heroWhen}>
        {dateLong} · {start} – {end} CT
      </p>
      <div className={s.heroStatus}>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
    </header>
  );
}

function StatusBanner({
  status,
  detail,
}: {
  status: BidStatus;
  detail: BidDetail;
}) {
  if (status === "pending_review") {
    return (
      <div className={s.banner}>
        <Alert variant="info" title="Your bid is being prepared">
          The team will review your request and confirm within 24 hours.
          You&rsquo;ll get an email at{" "}
          <strong>{detail.booking.guestEmail}</strong> with the full
          itinerary, a signature link, and a deposit link as soon as it&rsquo;s
          ready.
        </Alert>
      </div>
    );
  }

  if (status === "denied" || status === "expired") {
    return (
      <div className={s.banner}>
        <Alert
          variant="warn"
          title={
            status === "denied"
              ? "This bid is no longer active"
              : "This bid has expired"
          }
        >
          This bid has expired and can no longer be confirmed online. We hold each
  date open for a limited window so other guests have a fair shot at the
  same slot — once that window closes, the bid releases automatically.
                <br/>   <br/>                                                                                                                                                                                                                                                                            
  The good news: nothing is lost. Reach out and we&rsquo;ll check
  availability for your original date (or something close to it) and send
  you a fresh bid to sign.
        </Alert>
      </div>
    );
  }

  if (status === "paid") {
    const dateLong = formatDateLongTz(
      detail.booking.startTime,
      detail.property.timezone,
    );
    return (
      <div className={s.banner}>
        <Alert variant="success" title={`We'll see you on ${dateLong}.`}>
          Your deposit is in and your waiver is signed. Save this page —
          everything you need is here.
        </Alert>
      </div>
    );
  }

  return null;
}

function GuestSummary({ detail }: { detail: BidDetail }) {
  const { booking } = detail;
  return (
    <section className={s.section}>
      <div className={s.sectionHead}>
        <p className={s.sectionEyebrow}>For</p>
      </div>
      <div className={s.guest}>
        <div>
          <p className={s.guestLabel}>Guest</p>
          <p className={s.guestValue}>{booking.guestName}</p>
        </div>
        <div>
          <p className={s.guestLabel}>Party size</p>
          <p className={s.guestValue}>
            {booking.guestCount}{" "}
            {booking.guestCount === 1 ? "guest" : "guests"}
          </p>
        </div>
      </div>
      {booking.guestNotes && (
        <p className={s.empty} style={{ marginTop: "var(--space-3)" }}>
          &ldquo;{booking.guestNotes}&rdquo;
        </p>
      )}
    </section>
  );
}

function DisciplineSection({ detail }: { detail: BidDetail }) {
  const { disciplines, addOns, booking } = detail;
  const typeMeta = BOOKING_TYPE_META[booking.bookingType];

  if (disciplines.length === 0 && booking.bookingType === "host_an_occasion") {
    return (
      <section className={s.section}>
        <div className={s.sectionHead}>
          <Heading level={2} size="h3" className={s.sectionTitle}>
            {typeMeta.title}
          </Heading>
        </div>
        <p className={s.empty}>
          Exclusive use of the property for your group — disciplines selected
          on the day.
        </p>
      </section>
    );
  }

  if (disciplines.length === 0) {
    return null;
  }

  const addOnsByService = new Map<string, typeof addOns>();
  for (const addOn of addOns) {
    const bucket = addOnsByService.get(addOn.serviceId);
    if (bucket) bucket.push(addOn);
    else addOnsByService.set(addOn.serviceId, [addOn]);
  }

  return (
    <section className={s.section}>
      <div className={s.sectionHead}>
        <Heading level={2} size="h3" className={s.sectionTitle}>
          {typeMeta.title}
        </Heading>
      </div>
      <ul className={s.disciplineList}>
        {disciplines.map((discipline) => {
          const ownAddOns = addOnsByService.get(discipline.id) ?? [];
          return (
            <li key={discipline.id} className={s.disciplineCard}>
              <p className={s.disciplineName}>{discipline.name}</p>
              {discipline.description && (
                <p className={s.disciplineDesc}>{discipline.description}</p>
              )}
              {ownAddOns.length > 0 && (
                <ul className={s.addOnList}>
                  {ownAddOns.map((addOn) => (
                    <li key={addOn.id} className={s.addOnRow}>
                      <span>{addOn.name}</span>
                      <span className={s.addOnQty}>× {addOn.quantity}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function GearList({ detail }: { detail: BidDetail }) {
  const items = detail.bid.gearList;

  return (
    <section className={s.section}>
      <div className={s.sectionHead}>
        <Heading level={2} size="h3" className={s.sectionTitle}>
          What we&rsquo;ll bring
        </Heading>
      </div>
      {items.length === 0 ? (
        <p className={s.empty}>
          Your gear list lands here once the team confirms.
        </p>
      ) : (
        <ul className={s.gearList}>
          {items.map((item, idx) => (
            <li key={`${item.name}-${idx}`} className={s.gearItem}>
              <span className={s.gearItemName}>{item.name}</span>
              {item.description && (
                <div className={s.gearItemDesc}>
                  <MarkdownProse small>{item.description}</MarkdownProse>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ScheduleSection({ detail }: { detail: BidDetail }) {
  const { booking, property, instructor, bid } = detail;
  const start = formatSlotLabelTz(booking.startTime, property.timezone);
  const end = formatSlotLabelTz(booking.endTime, property.timezone);

  return (
    <section className={s.section}>
      <div className={s.sectionHead}>
        <Heading level={2} size="h3" className={s.sectionTitle}>
          Schedule
        </Heading>
      </div>
      <div className={s.scheduleGrid}>
        <div className={s.scheduleCell}>
          <p className={s.scheduleLabel}>Arrive</p>
          <p className={s.scheduleValue}>{start} CT</p>
        </div>
        <div className={s.scheduleCell}>
          <p className={s.scheduleLabel}>Wrap</p>
          <p className={s.scheduleValue}>{end} CT</p>
        </div>
        <div className={s.scheduleCell}>
          <p className={s.scheduleLabel}>Duration</p>
          <p className={s.scheduleValue}>
            {booking.durationHours}{" "}
            {booking.durationHours === 1 ? "hour" : "hours"}
          </p>
        </div>
        {instructor && (
          <div className={s.scheduleCell}>
            <p className={s.scheduleLabel}>Instructor</p>
            <p className={s.scheduleValue}>{instructor.name}</p>
          </div>
        )}
      </div>
      {bid.scheduleNotes && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <MarkdownProse>{bid.scheduleNotes}</MarkdownProse>
        </div>
      )}
    </section>
  );
}

function FaqSection({ detail }: { detail: BidDetail }) {
  const items = detail.bid.faq;

  return (
    <section className={s.section}>
      <div className={s.sectionHead}>
        <Heading level={2} size="h3" className={s.sectionTitle}>
          Things to know
        </Heading>
      </div>
      {items.length === 0 ? (
        <p className={s.empty}>
          Notes from the team land here once your bid is confirmed.
        </p>
      ) : (
        <div className={s.faqList}>
          {items.map((item, idx) => (
            <details key={`${item.question}-${idx}`} className={s.faqItem}>
              <summary className={s.faqQuestion}>{item.question}</summary>
              <div className={s.faqAnswer}>
                <MarkdownProse small>{item.answer}</MarkdownProse>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function MapSlot({ detail }: { detail: BidDetail }) {
  return (
    <section className={s.section}>
      <div className={s.sectionHead}>
        <Heading level={2} size="h3" className={s.sectionTitle}>
          Getting there
        </Heading>
      </div>
      <div className={s.slot}>
        <p className={s.slotEyebrow}>Directions</p>
        <p className={s.slotTitle}>{detail.property.name}</p>
        <p className={s.slotBody}>
          A map and driving directions land here. Call us if you&rsquo;d like
          turn-by-turn before then.
        </p>
      </div>
    </section>
  );
}

function SignatureSlot({
  status,
  detail,
}: {
  status: BidStatus;
  detail: BidDetail;
}) {
  const done = status === "signed" || status === "paid";

  return (
    <section className={`${s.slot} ${done ? s.slotDone : ""}`}>
      <p className={s.slotEyebrow}>{done ? "Signed ✓" : "Step 1"}</p>
      <p className={s.slotTitle}>
        {done ? "Waiver signed" : "Sign your waiver"}
      </p>
      <p className={s.slotBody}>
        {done && detail.bid.signedAt
          ? "Thanks — your waiver is on file."
          : "Once you sign, we'll unlock the deposit step below."}
      </p>
      <p className={s.slotMeta}>App 7 · Dropbox Sign embed</p>
    </section>
  );
}

function DepositSlot({
  status,
  detail,
}: {
  status: BidStatus;
  detail: BidDetail;
}) {
  const done = status === "paid";
  const deposit = detail.booking.depositAmount;
  const quoteNote = detail.bid.quoteNote;

  return (
    <section className={`${s.slot} ${done ? s.slotDone : ""}`}>
      <p className={s.slotEyebrow}>{done ? "Paid ✓" : "Step 2"}</p>
      <p className={s.slotTitle}>
        {done
          ? "Deposit received"
          : deposit !== null
            ? `Pay your $${formatMoney(deposit)} deposit`
            : "Pay your deposit"}
      </p>
      <p className={s.slotBody}>
        {done
          ? "Thanks — we'll see you at the property."
          : "Card or bank transfer. The balance settles at the property."}
      </p>
      {quoteNote && (
        <div style={{ marginTop: "var(--space-2)" }}>
          <MarkdownProse small>{quoteNote}</MarkdownProse>
        </div>
      )}
      <p className={s.slotMeta}>App 6 · Stripe deposit embed</p>
    </section>
  );
}

function ContactFooter({ detail }: { detail: BidDetail }) {
  return (
    <footer className={s.footer}>
      <p className={s.footerLine}>
        Questions? Reach the {detail.property.name} team — we&rsquo;ll get back
        to you the same day.
      </p>
      <p className={s.footerLine}>
        Save this page — it&rsquo;s the home base for your booking.
      </p>
    </footer>
  );
}
