import "server-only";
import { eventType, staticSchema } from "inngest";

// Typed event registry — the contract between code paths that FIRE
// events and the Inngest functions that subscribe to them.
//
// Each event is an `EventType` instance:
//   - It can be passed as a trigger to `inngest.createFunction(...)`
//   - It defines the data shape used inside handlers
//   - It's the canonical name used when firing via `inngest.send(...)`
//
// `staticSchema<TData>()` is a Standard-Schema-shaped passthrough — no
// runtime validation, types only. Migrate to Zod later if we ever need
// runtime guards on payloads (worth it for HubSpot webhook ingest).
//
// Naming convention: `<resource>/<lifecycle-verb>` (slash-separated,
// past-tense verb). Matches Inngest's docs and dashboard URLs.
//
// Status of events below:
//
//   - SCHEMAS DEFINED: the type contract is in place.
//   - NOT YET FIRED: existing code paths (Server Actions, webhook
//     handlers) do not call `inngest.send(...)` for these events yet.
//     Wiring those calls is App 9 sub-phase 9.2 — one event at a time,
//     each with a deliberate "fire-after-commit" pattern to avoid
//     phantom workflows when transactions roll back.
//
// Adding a new event:
//
//   1. Add an export below using `eventType("name", { schema: ... })`.
//   2. Create a function under `lib/inngest/functions/` that subscribes
//      via `inngest.createFunction({ id, triggers: [theEvent] }, ...)`.
//   3. Register the function in `lib/inngest/functions/index.ts`.
//   4. Fire from the originating Server Action / handler via
//      `inngest.send({ name: "...", data: {...} })`.

// ---- Bid lifecycle ---------------------------------------------------------

export const bidCreated = eventType("bid/created", {
  schema: staticSchema<{
    bidId: string;
    bookingId: string;
    propertySlug: string;
    guestEmail: string;
    // Relative bid path with the one-time plaintext access code already
    // embedded (e.g. "/bids/<slug>/<code>"). The plaintext only exists
    // for the lifetime of the create request — the DB stores only the
    // bcrypt hash — so the URL is captured into the event payload here
    // for any subscriber that needs to link the guest back to their bid
    // (confirmation email, future HubSpot deal note). Subscribers
    // prepend `getSiteOrigin()` to produce an absolute URL.
    bidPath: string;
  }>(),
});

export const bidConfirmed = eventType("bid/confirmed", {
  schema: staticSchema<{
    bidId: string;
    confirmedByStaffId: string;
  }>(),
});

export const bidDenied = eventType("bid/denied", {
  schema: staticSchema<{
    bidId: string;
  }>(),
});

export const bidSigned = eventType("bid/signed", {
  schema: staticSchema<{
    bidId: string;
    signedAt: string;
  }>(),
});

export const bidDepositPaid = eventType("bid/deposit-paid", {
  schema: staticSchema<{
    bidId: string;
    amountPaidCents: number;
    paymentIntentId: string;
  }>(),
});

export const bidExpired = eventType("bid/expired", {
  schema: staticSchema<{
    bidId: string;
    expiredReason: "no_signature" | "no_payment" | "manual";
  }>(),
});

// ---- Booking lifecycle -----------------------------------------------------

export const bookingConfirmed = eventType("booking/confirmed", {
  schema: staticSchema<{
    bookingId: string;
    bidId: string;
    eventStartAt: string; // ISO timestamp — base for T-14/T-3/T-1 schedules
  }>(),
});

// ---- Adventure lifecycle ---------------------------------------------------

// An inquire-mode adventure reservation request — no online payment; the
// concierge follows up. Fired from requestAdventureAction; a subscriber
// emails the property's notification inbox.
export const adventureRequested = eventType("adventure/requested", {
  schema: staticSchema<{
    rsvpId: string;
    adventureId: string;
    adventureTitle: string;
    propertyId: string;
    propertyName: string;
    guestName: string;
    guestCount: number;
  }>(),
});

// A confirmed/pending adventure seat was freed (a cancellation) — ping the
// waitlist to claim it. Fired from cancel-adventure-rsvp.
export const adventureSpotOpened = eventType("adventure/spot-opened", {
  schema: staticSchema<{
    adventureId: string;
  }>(),
});

// ---- Membership lifecycle --------------------------------------------------

export const membershipApplicationSubmitted = eventType(
  "membership/application-submitted",
  {
    schema: staticSchema<{
      applicationId: string;
      propertySlug: string;
      applicantEmail: string;
    }>(),
  },
);

export const membershipApproved = eventType("membership/approved", {
  schema: staticSchema<{
    membershipId: string;
    personId: string;
    approvedByStaffId: string;
  }>(),
});
