import type { ReactElement } from "react";

import { GuestBookingConfirmation } from "@/src/components/email/templates/guest-booking-confirmation";
import { BidConfirmedWithDeposit } from "@/src/components/email/templates/bid-confirmed-with-deposit";
import { BidConfirmedNoDeposit } from "@/src/components/email/templates/bid-confirmed-no-deposit";
import { BidDenied } from "@/src/components/email/templates/bid-denied";
import { WaiverSigned } from "@/src/components/email/templates/waiver-signed";
import { PreVisit } from "@/src/components/email/templates/pre-visit";
import { PostEventFollowup } from "@/src/components/email/templates/post-event-followup";
import { DepositReceipt } from "@/src/components/email/templates/deposit-receipt";
import { RefundNotice } from "@/src/components/email/templates/refund-notice";
import { AdventureRsvpReceipt } from "@/src/components/email/templates/adventure-rsvp-receipt";
import { AdventureCancellation } from "@/src/components/email/templates/adventure-cancellation";
import { AdventureSpotOpened } from "@/src/components/email/templates/adventure-spot-opened";
import { AdventureRequestNotification } from "@/src/components/email/templates/adventure-request-notification";
import { NewBidStaffNotification } from "@/src/components/email/templates/new-bid-staff-notification";
import { UnsignedBidDigest } from "@/src/components/email/templates/unsigned-bid-digest";
import type { ReminderSection } from "@/src/services/reminders/compose-sections";

// Typed sample-data registry for the dev email-template gallery (App 15).
//
// This is the heart of the feature. Each entry is a REAL
// `<Component {...sample} />`, so the sample props are checked against the
// live template prop interface at build time — change a template's props and
// `npm run typecheck` fails here until the sample is updated. That drift guard
// is the whole reason fixtures live in the registry (in the /dev tree) rather
// than as `PreviewProps` exports on the production template files, where they
// would ship to prod and add a public surface.
//
// The detail pane renders `entry.element.props` as JSON, so the samples
// double as the visible "inputs" for each preview. Keep every sample value
// JSON-serializable (primitives, nullables, plain arrays/objects) — these
// templates already constrain their props to that shape for the dev-outbox
// payload log, so there's nothing to special-case.
//
// Drop with the rest of /dev pre-launch (see the route + this file in the
// drop-checklist comment in 20260521080000_create_dev_email_outbox.sql).

// The four sidebar groups, in display order. Entries render grouped under
// these headings, preserving registry order within each group.
export const TEMPLATE_GROUPS = [
  "Guest booking",
  "Payments",
  "Adventures",
  "Staff & internal",
] as const;

export type TemplateGroup = (typeof TEMPLATE_GROUPS)[number];

export interface TemplatePreview {
  // URL key (the `?t=` value), e.g. "waiver-signed--finalized". Unique per
  // entry, including per variant.
  id: string;
  // Sidebar + detail-header label.
  label: string;
  // Sidebar group heading.
  group: TemplateGroup;
  // Short note shown in the detail header — what state this sample represents
  // (e.g. which variant / branch). Empty string for single-state templates.
  variantNote: string;
  // A real rendered element with sample props — the type-safety net.
  element: ReactElement;
}

// ---- Shared sample values --------------------------------------------------
// Reused across entries so the gallery reads as one coherent fictional booking
// rather than fifteen unrelated ones. Not exhaustive — entries override freely.

const GUEST_NAME = "Jordan Avery";
const HORSESHOE_BAY = "Horseshoe Bay Sporting Club";
const HOG_HEAVEN = "Hog Heaven Sporting Club";
const DATE_LONG = "Saturday, May 23";
const TIME_LABEL = "9 AM CT";
const BID_URL = "https://rhythm.co/bids/horseshoe-bay-clays/8F3K2Q";
const ADMIN_BID_URL = "https://rhythm.co/admin/bids/c1f9a8e2-4d6b-4a10-9f3e-2b7c1d5e8a90";

const PRE_VISIT_SECTIONS: ReminderSection[] = [
  {
    heading: "What to bring",
    items: [
      "Eye and ear protection (loaners available if you forget)",
      "Closed-toe shoes and weather-appropriate layers",
      "A hat with a brim and sunscreen",
    ],
  },
  {
    heading: "What to expect",
    body: "Your instructor will meet you at the clubhouse for a short safety briefing, then you'll head out to the sporting-clays course for the morning.",
  },
  {
    heading: "Getting here",
    body: "From Marble Falls, take RR 2147 west for 6 miles; the gated entrance is on your right just past the lake overlook. Tell the gate attendant you're with Rhythm Outdoors.",
  },
  {
    heading: "Weather",
    body: "Keep an eye on the forecast as your date nears and dress in layers — we run rain or shine unless you hear otherwise from us.",
  },
  {
    heading: "Arrival",
    body: "Plan to arrive a few minutes before 9 AM CT so we can get you settled and started on time.",
  },
];

// ---- The registry ----------------------------------------------------------

export const TEMPLATE_PREVIEWS: TemplatePreview[] = [
  // ---- Guest booking -------------------------------------------------------
  {
    id: "guest-booking-confirmation",
    label: "Guest booking confirmation",
    group: "Guest booking",
    variantNote: "Sent immediately after a public booking request",
    element: (
      <GuestBookingConfirmation
        guestName={GUEST_NAME}
        propertyName={HORSESHOE_BAY}
        dateLong={DATE_LONG}
        timeLabel={TIME_LABEL}
        bidUrl={BID_URL}
      />
    ),
  },
  {
    id: "bid-confirmed-with-deposit",
    label: "Bid confirmed — with deposit",
    group: "Guest booking",
    variantNote: "Deposit required; guest signs + pays on the bid page",
    element: (
      <BidConfirmedWithDeposit
        guestName={GUEST_NAME}
        propertyName={HORSESHOE_BAY}
        dateLong={DATE_LONG}
        timeLabel={TIME_LABEL}
        guestCount={4}
        totalPrice="1,200"
        depositAmount="300"
        balanceDue="900"
        bidUrl={BID_URL}
      />
    ),
  },
  {
    id: "bid-confirmed-no-deposit",
    label: "Bid confirmed — no deposit",
    group: "Guest booking",
    variantNote: "No deposit; only the waiver remains before the visit",
    element: (
      <BidConfirmedNoDeposit
        guestName={GUEST_NAME}
        propertyName={HORSESHOE_BAY}
        dateLong={DATE_LONG}
        timeLabel={TIME_LABEL}
        guestCount={2}
        totalPrice="450"
        bidUrl={BID_URL}
      />
    ),
  },
  {
    id: "bid-denied",
    label: "Bid denied",
    group: "Guest booking",
    variantNote: "Admin declined the request, with a note from the team",
    element: (
      <BidDenied
        guestName={GUEST_NAME}
        propertyName={HORSESHOE_BAY}
        dateLong={DATE_LONG}
        timeLabel={TIME_LABEL}
        reason={
          "We're fully booked that Saturday morning, but we'd love to get you " +
          "out on the afternoon flight or the following weekend. Just reply and " +
          "we'll set it up."
        }
      />
    ),
  },
  {
    id: "waiver-signed--finalized",
    label: "Waiver signed — finalized",
    group: "Guest booking",
    variantNote: "finalized=true — signing was the last step; balance settles on-site",
    element: (
      <WaiverSigned
        guestName={GUEST_NAME}
        propertyName={HORSESHOE_BAY}
        dateLong={DATE_LONG}
        timeLabel={TIME_LABEL}
        guestCount={2}
        finalized={true}
        atPropertyAmount="450"
        depositAmount={null}
        balanceAfterDeposit={null}
        bidUrl={BID_URL}
      />
    ),
  },
  {
    id: "waiver-signed--deposit-owed",
    label: "Waiver signed — deposit owed",
    group: "Guest booking",
    variantNote: "finalized=false — waiver on file, deposit still due (pay CTA)",
    element: (
      <WaiverSigned
        guestName={GUEST_NAME}
        propertyName={HORSESHOE_BAY}
        dateLong={DATE_LONG}
        timeLabel={TIME_LABEL}
        guestCount={4}
        finalized={false}
        atPropertyAmount={null}
        depositAmount="300"
        balanceAfterDeposit="900"
        bidUrl={BID_URL}
      />
    ),
  },
  {
    id: "pre-visit",
    label: "Pre-visit reminder",
    group: "Guest booking",
    variantNote: "W3 cadence — kickoff touch with the full section set",
    element: (
      <PreVisit
        guestName={GUEST_NAME}
        propertyName={HORSESHOE_BAY}
        dateLong={DATE_LONG}
        timeLabel={TIME_LABEL}
        guestCount={2}
        headline="Getting ready for your visit"
        intro="Your morning at Horseshoe Bay is just a few days out — here's everything you'll need to make the most of it."
        sections={PRE_VISIT_SECTIONS}
        bidUrl={BID_URL}
        mapUrl="https://maps.app.goo.gl/Qm7xZ2Tn4kS9aBcd"
      />
    ),
  },
  {
    id: "post-event-followup",
    label: "Post-event follow-up",
    group: "Guest booking",
    variantNote: "T+1 thank-you, with the optional membership CTA enabled",
    element: (
      <PostEventFollowup
        guestName={GUEST_NAME}
        propertyName={HORSESHOE_BAY}
        dateLong={DATE_LONG}
        membershipCtaUrl="https://rhythm.co/membership"
      />
    ),
  },

  // ---- Payments ------------------------------------------------------------
  {
    id: "deposit-receipt",
    label: "Deposit receipt",
    group: "Payments",
    variantNote: "Deposit paid; balance remains and waiver not yet signed",
    element: (
      <DepositReceipt
        guestName={GUEST_NAME}
        propertyName={HORSESHOE_BAY}
        dateLong={DATE_LONG}
        timeLabel={TIME_LABEL}
        amountPaid="300.00"
        depositAmount="300.00"
        balanceDue="900.00"
        isFullPayment={false}
        hasBalance={true}
        waiverSigned={false}
      />
    ),
  },
  {
    id: "refund-notice",
    label: "Refund notice",
    group: "Payments",
    variantNote: "Full refund — booking cancelled",
    element: (
      <RefundNotice
        guestName={GUEST_NAME}
        propertyName={HORSESHOE_BAY}
        dateLong={DATE_LONG}
        timeLabel={TIME_LABEL}
        depositAmount="300.00"
        refundAmount="300.00"
        isPartial={false}
      />
    ),
  },

  // ---- Adventures ----------------------------------------------------------
  {
    id: "adventure-rsvp-receipt",
    label: "Adventure RSVP receipt",
    group: "Adventures",
    variantNote: "Paid in full at RSVP",
    element: (
      <AdventureRsvpReceipt
        guestName={GUEST_NAME}
        adventureTitle="Argentina Dove & Decoy — Córdoba"
        propertyName={HOG_HEAVEN}
        dateLabel="December 4–9, 2026"
        amountPaid="8,350"
        balanceDue="0"
        guestCount={2}
      />
    ),
  },
  {
    id: "adventure-cancellation",
    label: "Adventure cancellation",
    group: "Adventures",
    variantNote: "Cancelled with a refund issued",
    element: (
      <AdventureCancellation
        guestName={GUEST_NAME}
        adventureTitle="Argentina Dove & Decoy — Córdoba"
        refunded={true}
        refundAmount="6,850"
        forfeited={false}
      />
    ),
  },
  {
    id: "adventure-spot-opened",
    label: "Adventure spot opened",
    group: "Adventures",
    variantNote: "Waitlist promotion — a seat freed up",
    element: (
      <AdventureSpotOpened
        guestName={GUEST_NAME}
        adventureTitle="Argentina Dove & Decoy — Córdoba"
        propertyName={HOG_HEAVEN}
        reserveUrl="https://rhythm.co/member/adventures/argentina-dove-cordoba"
      />
    ),
  },

  // ---- Staff & internal ----------------------------------------------------
  {
    id: "adventure-request-notification",
    label: "Adventure request (staff)",
    group: "Staff & internal",
    variantNote: "A member requested an inquire-mode adventure",
    element: (
      <AdventureRequestNotification
        propertyName={HOG_HEAVEN}
        adventureTitle="Argentina Dove & Decoy — Córdoba"
        guestName={GUEST_NAME}
        guestCount={2}
        reviewUrl="https://rhythm.co/admin/adventures/argentina-dove-cordoba/roster"
      />
    ),
  },
  {
    id: "new-bid-staff-notification",
    label: "New bid notification (staff)",
    group: "Staff & internal",
    variantNote: "Fires on bid/created — review needed",
    element: (
      <NewBidStaffNotification
        propertyName={HORSESHOE_BAY}
        guestName={GUEST_NAME}
        guestEmail="jordan.avery@example.com"
        dateLong={DATE_LONG}
        timeLabel={TIME_LABEL}
        guestCount={4}
        bookingTypeLabel="Private Lesson"
        reviewUrl={ADMIN_BID_URL}
      />
    ),
  },
  {
    id: "unsigned-bid-digest",
    label: "Unsigned-bid digest (staff)",
    group: "Staff & internal",
    variantNote: "Daily per-property digest with overflow",
    element: (
      <UnsignedBidDigest
        propertyName={HORSESHOE_BAY}
        bids={[
          {
            guestName: "Jordan Avery",
            dateLong: "Saturday, May 23",
            timeLabel: "9 AM CT",
            waitingLabel: "3 days waiting",
            reviewUrl: "https://rhythm.co/admin/bids/c1f9a8e2-1111-4a10-9f3e-2b7c1d5e8a90",
          },
          {
            guestName: "Riley Brooks",
            dateLong: "Sunday, May 24",
            timeLabel: "2 PM CT",
            waitingLabel: "2 days waiting",
            reviewUrl: "https://rhythm.co/admin/bids/c1f9a8e2-2222-4a10-9f3e-2b7c1d5e8a90",
          },
          {
            guestName: "Casey Nguyen",
            dateLong: "Friday, May 29",
            timeLabel: "10 AM CT",
            waitingLabel: "2 days waiting",
            reviewUrl: "https://rhythm.co/admin/bids/c1f9a8e2-3333-4a10-9f3e-2b7c1d5e8a90",
          },
        ]}
        overflowCount={3}
        bidsIndexUrl="https://rhythm.co/admin/bids"
      />
    ),
  },
];

// Lookup by `?t=` id. Returns null when the id is unknown (caller falls back
// to the first entry).
export function findTemplatePreview(id: string | undefined): TemplatePreview | null {
  if (!id) return null;
  return TEMPLATE_PREVIEWS.find((preview) => preview.id === id) ?? null;
}
