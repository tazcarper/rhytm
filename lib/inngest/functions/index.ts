import "server-only";
import { onBidCreated } from "./on-bid-created";
import { sendBidConfirmationEmail } from "./send-bid-confirmation-email";
import { sendNewBidStaffNotification } from "./send-new-bid-staff-notification";
import { sendBidConfirmedEmail } from "./send-bid-confirmed-email";
import { sendWaiverSignedEmail } from "./send-waiver-signed-email";
import { sendBidDeniedEmail } from "./send-bid-denied-email";
import { sendPreEventCadence } from "./send-pre-event-cadence";
import { sendUnsignedBidDigest } from "./send-unsigned-bid-digest";
import { releaseStaleAdventureHolds } from "./release-stale-adventure-holds";
import { sendAdventureRequestNotification } from "./send-adventure-request-notification";
import { notifyAdventureWaitlist } from "./notify-adventure-waitlist";

// Barrel of every Inngest function registered with the `serve` handler
// in `app/api/inngest/route.ts`. Adding a new function:
//
//   1. Write it in a sibling file (one function per file, named for
//      the event + verb it handles).
//   2. Import + add it to the array below.
//
// The route handler registers whatever's in this array; functions
// not listed here are unreachable even if defined.

export const inngestFunctions = [
  onBidCreated,
  sendBidConfirmationEmail,
  sendNewBidStaffNotification,
  sendBidConfirmedEmail,
  sendWaiverSignedEmail,
  sendBidDeniedEmail,
  sendPreEventCadence,
  sendUnsignedBidDigest,
  releaseStaleAdventureHolds,
  sendAdventureRequestNotification,
  notifyAdventureWaitlist,
];
