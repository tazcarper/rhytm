/**
 * Seed test login accounts into the LOCAL Supabase stack.
 *
 * Creates one user per portal (member / partner / admin) with the right
 * `app_metadata.role` so a contributor can sign in and lay out every surface,
 * not just public pages.
 *
 * Run AFTER `npx supabase start` (so the local stack is up) with the local
 * env loaded:
 *
 *   node --env-file=.env.local scripts/seed-local.mjs
 *   # or:  npm run seed:local
 *
 * Safety: this only ever talks to NEXT_PUBLIC_SUPABASE_URL. It refuses to run
 * against anything that isn't a localhost URL, so it can never seed production.
 *
 * NOTE: this seeds AUTH accounts only. Domain fixtures (memberships, bookings,
 * RSVPs that make the member/partner portals show rich data) are a follow-up —
 * see docs/CLIENT_SETUP.md. Until then the portals render their shell with
 * "no data yet", which is still enough for most layout work.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SECRET_KEY || "";

const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(supabaseUrl);
if (!isLocal) {
  console.error(
    `Refusing to seed: NEXT_PUBLIC_SUPABASE_URL ("${supabaseUrl}") is not a local URL.\n` +
      `This script only seeds the local Docker stack. Start it with "npx supabase start" first.`,
  );
  process.exit(1);
}
if (!serviceKey) {
  console.error("Missing SUPABASE_SECRET_KEY. Run `npx supabase status` and fill it into .env.local.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_PASSWORD = "password123";
const testAccounts = [
  { email: "member@example.test", role: "member" },
  { email: "partner@example.test", role: "partner" },
  { email: "admin@example.test", role: "admin" },
];

let created = 0;
for (const account of testAccounts) {
  const { error } = await supabase.auth.admin.createUser({
    email: account.email,
    password: TEST_PASSWORD,
    email_confirm: true,
    app_metadata: { role: account.role },
  });
  if (error) {
    if (/already.*registered|exists/i.test(error.message)) {
      console.log(`• ${account.email} (${account.role}) — already exists, skipped`);
    } else {
      console.error(`✗ ${account.email}: ${error.message}`);
    }
  } else {
    created += 1;
    console.log(`✓ ${account.email} (${account.role}) — created`);
  }
}

console.log(
  `\nDone. ${created} account(s) created. Sign in locally with any of the emails above and password "${TEST_PASSWORD}".`,
);
