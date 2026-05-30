import "server-only";
import { Inngest } from "inngest";

// `import "server-only"` blocks any client component from accidentally
// importing the Inngest client. Inngest fires from Server Actions and
// route handlers only — the browser has no reason to touch this.

// Single configured client for the project. App-wide id "rhythm-outdoors"
// namespaces events + function runs in the Inngest dashboard. Changing
// this later is a breaking move (cannot rename an app in place without
// orphaning prior runs), so the choice is deliberate.
//
// Note (Inngest 4.x): events are no longer registered via
// `EventSchemas.fromRecord<...>()` on the client. Instead each event is
// a first-class `EventType` created in `./events.ts` and passed to
// `inngest.createFunction({ triggers: [...] }, handler)`. The client
// stays config-light; the typed surface lives with the events.
//
// Mode resolution (Inngest 4.x — changed from 3.x): the client no longer
// infers dev mode from `NODE_ENV`. With no `isDev` option and no
// `INNGEST_DEV` env var set, the client defaults to "cloud" mode and
// requires `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`. Local development
// against `npx inngest-cli dev` therefore needs `INNGEST_DEV=1` in
// `.env.local` (or `isDev: true` here). Production reads the two key
// env vars and runs in cloud mode automatically.

export const inngest = new Inngest({
  id: "rhythm-outdoors",
});
