import { notFound } from "next/navigation";
import { Alert, Badge, Eyebrow, Heading } from "@/lib/ui";
import type { BadgeVariant } from "@/lib/ui";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getBidDetail,
  type BidDetail,
  type BidStatus,
} from "@/src/services/bids/get-bid";
import { parseBidUrlParams } from "@/src/services/bids/bid-url";
import {
  applyBidPreview,
  isValidPreviewState,
} from "@/src/services/bids/preview";
import { BOOKING_TYPE_META } from "@/src/constants/public/booking-types";
import {
  formatDateLongTz,
  formatMoney,
  formatSlotLabelTz,
} from "@/src/services/public/format";
import { MarkdownProse } from "@/src/components/shared/markdown";
import { BidTimeline } from "@/src/components/public/bid-timeline";
import { BidCelebration } from "@/src/components/public/bid-celebration";
import { DepositPaymentForm } from "@/src/components/public/deposit-payment-form";
import { SignatureForm } from "@/src/components/public/signature-form";
import { WaiverSignModal } from "@/src/components/public/waiver-sign-modal";
import { BidPreviewToolbar } from "@/src/components/admin/bid-preview-toolbar";
import { getWaiverProvider, type WaiverProvider } from "@/lib/waiver/provider";
import {
  getActiveWaiverTemplate,
  type WaiverTemplate,
} from "@/src/services/waiver/get-active-waiver-template";
import { createServiceRoleClient } from "@/lib/supabase/service";
import s from "./bid-page.module.css";

const ADMIN_ROLES = new Set([
  "super_admin",
  "admin",
  "property_manager",
]);

async function isAdminViewer(): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const role = user.app_metadata?.role as string | undefined;
  return role !== undefined && ADMIN_ROLES.has(role);
}

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
  searchParams,
}: {
  params: Promise<{ slug: string; code: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const routeParams = await params;
  const parsed = parseBidUrlParams(routeParams);
  if (!parsed) notFound();

  const rawDetail = await getBidDetail(parsed.slug, parsed.code);
  if (!rawDetail) notFound();

  // Admin-only state preview. Anonymous viewers and non-admin
  // members see the real DB state; admins can use ?preview=<state>
  // to inspect alternative renders without touching data.
  const adminViewer = await isAdminViewer();
  const search = await searchParams;
  const detail =
    adminViewer && isValidPreviewState(search.preview)
      ? applyBidPreview(rawDetail, search.preview)
      : rawDetail;

  // Waiver signing backend (default native; WAIVER_PROVIDER=dropbox_sign
  // reverts). For the native path, load the property's active waiver
  // template here via service-role — guests have no RLS read on
  // waiver_templates — so the modal can show the legal text + consent copy.
  const provider = getWaiverProvider();
  const alreadySigned =
    detail.bid.signedAt !== null || detail.bid.status === "signed";
  const waiverTemplate =
    provider === "native" && isActiveBid(detail.bid.status) && !alreadySigned
      ? await getActiveWaiverTemplate(
          createServiceRoleClient(),
          detail.property.id,
        )
      : null;

  return (
    <main className={s.wrap}>
      {adminViewer && <BidPreviewToolbar />}
      <BidHero detail={detail} />
      {showsTimeline(detail.bid.status) && (
        <BidTimeline
          status={detail.bid.status}
          signedAt={detail.bid.signedAt}
          requiresDeposit={detail.booking.requiresDeposit}
        />
      )}
      <StatusBanner
        status={detail.bid.status}
        detail={detail}
        celebrationKey={parsed.slug}
      />

      {isActiveBid(detail.bid.status) && (
        <>
          <GuestSummary detail={detail} />
          <DisciplineSection detail={detail} />
          <GearList detail={detail} />
          <ScheduleSection detail={detail} />
          <FaqSection detail={detail} />
          <MapSlot detail={detail} />
          <SignatureSlot
            status={detail.bid.status}
            detail={detail}
            accessCode={parsed.code}
            requiresDeposit={detail.booking.requiresDeposit}
            provider={provider}
            template={waiverTemplate}
          />
          {detail.booking.requiresDeposit && (
            <DepositSlot
              status={detail.bid.status}
              detail={detail}
              accessCode={parsed.code}
            />
          )}
        </>
      )}

      <ContactFooter detail={detail} />
    </main>
  );
}

// ============================================================
// Status helpers
// ============================================================

// pending_review and denied/expired/refunded show only the hero + status
// banner. The other three (confirmed / signed / paid) render the full
// bid body including signature + deposit slots — signed/paid show those
// slots in a "done" state rather than hiding them, so the guest can see
// the trail of what they've completed.
function isActiveBid(status: BidStatus): boolean {
  return (
    status === "confirmed" || status === "signed" || status === "paid"
  );
}

// Timeline shows for every non-terminal status. denied/expired/refunded
// are off-path — no progression to track.
function showsTimeline(status: BidStatus): boolean {
  return (
    status !== "denied" && status !== "expired" && status !== "refunded"
  );
}

// Public-side palette mirrors the admin BidStatusBadge taxonomy so a
// status reads the same color to staff and guests. See
// src/components/admin/bid-status-badge.tsx for the full rationale.
function statusBadge(status: BidStatus): {
  variant: BadgeVariant;
  label: string;
} {
  switch (status) {
    case "pending_review":
      return { variant: "filling", label: "In review" };
    case "confirmed":
      return { variant: "tierCharter", label: "Confirmed" };
    case "signed":
      return { variant: "tierMember", label: "Signed" };
    case "paid":
      return { variant: "open", label: "Booked" };
    case "denied":
      return { variant: "full", label: "Closed" };
    case "expired":
      return { variant: "past", label: "Expired" };
    case "refunded":
      return { variant: "draft", label: "Refunded" };
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
  celebrationKey,
}: {
  status: BidStatus;
  detail: BidDetail;
  celebrationKey: string;
}) {
  if (status === "pending_review") {
    return (
      <div className={s.banner}>
        <Alert variant="info" title="Your bid is being prepared">
          {`The team will review your request and confirm within 24 hours. You’ll get an email at `}
          <span className={s.bannerStrong}>{detail.booking.guestEmail}</span>
          {` with the full itinerary, a signature link, and a deposit link as soon as it’s ready.`}
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

  if (status === "refunded") {
    return (
      <div className={s.banner}>
        <Alert variant="warn" title="This bid has been refunded">
          Your deposit was returned and this booking has been cancelled.
          Reach out if you&rsquo;d like to plan something else &mdash; we&rsquo;ll
          send a fresh bid.
        </Alert>
      </div>
    );
  }

  // Active path (confirmed / signed / paid). Sign and pay are independent
  // signals; what "finalized" means depends on whether a deposit is owed:
  //   deposit required → signed AND paid
  //   no deposit       → signed alone (the bid never reaches 'paid')
  const requiresDeposit = detail.booking.requiresDeposit;
  const signed = detail.bid.signedAt !== null || status === "signed";
  const paid = status === "paid";
  const finalized = requiresDeposit ? signed && paid : signed;
  const dateLong = formatDateLongTz(
    detail.booking.startTime,
    detail.property.timezone,
  );

  if (finalized) {
    const firstName = detail.booking.guestName.trim().split(/\s+/)[0];
    const greetingName = firstName ? `, ${firstName}` : "";
    return (
      <div className={`${s.banner} ${s.finaleBanner}`}>
        <BidCelebration celebrationKey={celebrationKey} />
        <Alert
          variant="success"
          title={`You're all set${greetingName} — we can't wait to see you.`}
        >
        {`${
  requiresDeposit
    ? "Deposit’s in, waiver’s signed"
    : "Waiver’s signed"
}, ${dateLong.toString()} is locked in. Nothing left to do but show up. Save this page — everything you need is right here. See you at ${detail.property.name}!`}
        </Alert>
      </div>
    );
  }

  // Deposit-required, paid but not yet signed: nudge toward the waiver.
  if (requiresDeposit && paid && !signed) {
    return (
      <div className={s.banner}>
        <Alert variant="success" title="Deposit received">
          Thanks &mdash; we&rsquo;ve got your deposit. One more step: sign your
          waiver above before {dateLong}.
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
  accessCode,
  requiresDeposit,
  provider,
  template,
}: {
  status: BidStatus;
  detail: BidDetail;
  accessCode: string;
  requiresDeposit: boolean;
  provider: WaiverProvider;
  template: WaiverTemplate | null;
}) {
  // After App 6, sign and pay are independent — `paid` no longer
  // implies signed. The only reliable signal that the waiver is on
  // file is `bid.signed_at`. `status === "signed"` is also a done state
  // but is now an intermediate one (pay-pending); treat it as signed for
  // slot UI.
  const done = detail.bid.signedAt !== null || status === "signed";
  const payDoneButNotSigned = status === "paid" && !done;

  // Native path (default): show the modal once a template is loaded.
  // Vendor path (deprecated): show the embedded iframe once the envelope
  // exists. Exactly one is active per the WAIVER_PROVIDER switch.
  const nativeReady = provider === "native" && !done && template !== null;
  const vendorReady =
    provider === "dropbox_sign" &&
    !done &&
    detail.bid.dropboxSignEnvelopeId !== null;

  // With no deposit, the waiver is the only thing standing between the
  // guest and a finalized booking — label it accordingly.
  const eyebrow = done ? "Signed ✓" : requiresDeposit ? "Step 1" : "Last step";

  return (
    <section className={`${s.slot} ${done ? s.slotDone : ""}`}>
      <p className={s.slotEyebrow}>{eyebrow}</p>
      <p className={s.slotTitle}>
        {done ? "Waiver signed" : "Sign your waiver"}
      </p>
      <p className={s.slotBody}>
        {done
          ? "Thanks — your waiver is on file."
          : !requiresDeposit
            ? "Sign your waiver to finalize your booking — it’s the only step left."
            : payDoneButNotSigned
              ? "Your deposit is in — one last step left. Sign your waiver to lock the booking."
              : "You can sign before or after paying — both are required to finalize."}
      </p>
      {nativeReady && template && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <WaiverSignModal
            bidSlug={detail.bid.slug}
            bidAccessCode={accessCode}
            defaultName={detail.booking.guestName}
            waiverTitle={template.title}
            waiverBody={template.body}
            consentText={template.consentText}
          />
        </div>
      )}
      {vendorReady && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <SignatureForm
            bidSlug={detail.bid.slug}
            bidAccessCode={accessCode}
          />
        </div>
      )}
      {!done && !nativeReady && !vendorReady && (
        <p className={s.slotMeta}>
          Waiver is being prepared. Refresh in a moment.
        </p>
      )}
    </section>
  );
}

function DepositSlot({
  status,
  detail,
  accessCode,
}: {
  status: BidStatus;
  detail: BidDetail;
  accessCode: string;
}) {
  const done = status === "paid";
  const deposit = detail.booking.depositAmount;
  const quoteNote = detail.bid.quoteNote;

  // "Effective quote" — admin's confirmed_price override OR the
  // auto-estimate if blank (see BidBooking.effectiveQuote).
  const quoted = detail.booking.effectiveQuote;
  const amountPaid = detail.booking.amountPaid;

  if (done) {
    const balanceDue =
      quoted !== null ? Math.max(0, quoted - amountPaid) : 0;
    const isFull = balanceDue < 0.005;
    return (
      <section className={`${s.slot} ${s.slotDone}`}>
        <p className={s.slotEyebrow}>Paid ✓</p>
        <p className={s.slotTitle}>
          ${formatMoney(amountPaid)} received
          {quoted !== null && !isFull && ` of $${formatMoney(quoted)}`}
        </p>
        <p className={s.slotBody}>
          {isFull
            ? "Thanks — your booking is paid in full. We'll see you at the property."
            : `Thanks — the remaining $${formatMoney(balanceDue)} settles at the property.`}
        </p>
        {quoteNote && (
          <div style={{ marginTop: "var(--space-2)" }}>
            <MarkdownProse small>{quoteNote}</MarkdownProse>
          </div>
        )}
      </section>
    );
  }

  // Defensive: the page only mounts DepositSlot when requiresDeposit is
  // true (deposit_amount > 0), so a non-positive amount shouldn't reach
  // here. A non-positive deposit means "no deposit required" — render
  // nothing rather than a stale "pending" placeholder.
  if (deposit === null || deposit <= 0) return null;

  const allowsVariableAmount = quoted !== null && quoted > deposit;

  return (
    <section className={s.slot}>
      <p className={s.slotEyebrow}>Step 2</p>
      <p className={s.slotTitle}>
        {allowsVariableAmount
          ? `Pay your deposit, the full $${formatMoney(quoted)}, or any amount in between`
          : `Pay your $${formatMoney(deposit)} deposit`}
      </p>
      <p className={s.slotBody}>
        {allowsVariableAmount
          ? `Minimum $${formatMoney(deposit)} deposit · maximum $${formatMoney(quoted)} quote · remainder settles at the property.`
          : "Card or bank transfer. The balance settles at the property."}
      </p>
      {quoteNote && (
        <div style={{ marginTop: "var(--space-2)" }}>
          <MarkdownProse small>{quoteNote}</MarkdownProse>
        </div>
      )}
      <div style={{ marginTop: "var(--space-3)" }}>
        <DepositPaymentForm
          bidSlug={detail.bid.slug}
          bidAccessCode={accessCode}
          depositAmount={deposit}
          quotedAmount={quoted}
        />
      </div>
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
