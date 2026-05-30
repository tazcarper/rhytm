import "server-only";
import { onBidCreated } from "./on-bid-created";

// Barrel of every Inngest function registered with the `serve` handler
// in `app/api/inngest/route.ts`. Adding a new function:
//
//   1. Write it in a sibling file (one function per file, named for
//      the event + verb it handles).
//   2. Import + add it to the array below.
//
// The route handler registers whatever's in this array; functions
// not listed here are unreachable even if defined.

export const inngestFunctions = [onBidCreated];
