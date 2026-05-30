import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { inngestFunctions } from "@/lib/inngest/functions";

// Inngest's serve handler exposes three HTTP methods at this route:
//
//   PUT  — Inngest's dashboard hits this to register/sync the function
//          list. Run after every deploy that adds or changes a function.
//   POST — Inngest's runner hits this to execute a function step. The
//          handler verifies the signature using INNGEST_SIGNING_KEY.
//   GET  — Diagnostic ping. Returns a small JSON payload describing the
//          registered functions. Safe to expose; not a secret.
//
// Local dev: run `npx inngest-cli@latest dev` (or set up the Docker
// dev server) which auto-discovers this route and shows runs in a
// local UI at http://localhost:8288. Set `INNGEST_DEV=1` in
// `.env.local` so the Inngest 4.x client enters dev mode (it no longer
// infers this from NODE_ENV); without it the serve handler will reject
// the dev server's requests for missing a signing key.
//
// Production: requires INNGEST_EVENT_KEY (for `inngest.send()` to
// authenticate when firing events) and INNGEST_SIGNING_KEY (for the
// handler to verify incoming step executions). Both come from the
// Inngest dashboard once an account exists. If either is missing the
// client / handler fail closed and throw — there is no silent skip.

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
