#!/usr/bin/env node
/**
 * Dashboard-first content guard — PreToolUse hook.
 *
 * Purpose: a lot of this app's content and settings are editable by staff
 * directly in the admin dashboard (/admin) — FAQ & gear, property info and hours,
 * experiences & add-ons, pricing, adventures, waiver wording, instructors, team,
 * and the live bids/bookings/members records. A non-technical client driving this
 * repo through Claude often doesn't KNOW that, so the natural-but-wrong move is to
 * hand-write a SQL migration (or run psql) to change that data.
 *
 * That is always the wrong tool here: a migration that UPDATEs/INSERTs/DELETEs
 * managed content is brittle, bypasses validation, and won't even reach the live
 * site the way the dashboard does. The right move is "go edit it in /admin" — which
 * the client can do THEMSELVES, live, with no branch, PR, or developer.
 *
 * So when an edit to a .sql migration file (or a psql command) contains data
 * changes (INSERT / UPDATE / DELETE / UPSERT / MERGE / TRUNCATE) against a table
 * that the dashboard manages, this hook blocks it and points at the exact admin
 * page. It deliberately does NOT touch DDL (CREATE / ALTER) — adding a new
 * table/column for a genuinely new feature is the `build-a-feature` path and is
 * fine.
 *
 * Pairs with the `dashboard-first` skill (the proactive, conversational version of
 * this rule) and sits alongside `client-guardrails.mjs` (the live-data / review
 * backstop). Kept SEPARATE from that hook on purpose: this one's job is education
 * and redirection, not damage prevention, and its message is empowering ("you can
 * do this yourself") rather than a developer hand-off.
 *
 * ON BY DEFAULT, exactly like client-guardrails: the developer disables it on their
 * own machine with the (gitignored) `.claude/.developer-mode` marker — developers
 * legitimately write seed migrations, so they are exempt. The client's clone never
 * has the marker, so they are always guided.
 *
 * Contract: reads the PreToolUse JSON payload on stdin; to block, prints a
 * `permissionDecision: "deny"` object on stdout and exits 0. Allowing is a silent
 * exit 0.
 */

import fs from "node:fs";

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

let payload = {};
try {
  payload = JSON.parse(readStdin() || "{}");
} catch {
  payload = {};
}

const projectDir = process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd();

// Developer escape hatch — same marker as client-guardrails. On a dev machine,
// allow everything (developers write seed migrations as part of the job).
if (fs.existsSync(`${projectDir}/.claude/.developer-mode`)) {
  process.exit(0);
}

const toolName = payload.tool_name || "";
const toolInput = payload.tool_input || {};

// ---------------------------------------------------------------------------
// The map: every table the admin dashboard manages → where to edit it instead.
// Keep this in sync with src/components/admin/admin-nav.tsx and the admin pages.
// `label` is what the client recognizes; `path` is the in-app destination.
// ---------------------------------------------------------------------------
const DASHBOARD_TABLES = {
  // FAQ & Gear templates → Admin → Programming → "FAQ & Gear"
  bid_faq_templates: { label: "FAQ & Gear", path: "/admin/templates" },
  bid_faq_template_scopes: { label: "FAQ & Gear", path: "/admin/templates" },
  bid_gear_templates: { label: "FAQ & Gear", path: "/admin/templates" },
  bid_gear_template_scopes: { label: "FAQ & Gear", path: "/admin/templates" },

  // Property info, taglines, hours, contacts, map link, booking horizon, capacity
  properties: { label: "Properties", path: "/admin/properties" },

  // A property's catalog — experiences, add-ons, and their prices
  services: { label: "a property's Catalog (experiences & add-ons)", path: "/admin/properties" },
  add_ons: { label: "a property's Catalog (experiences & add-ons)", path: "/admin/properties" },
  service_add_ons: { label: "a property's Catalog (experiences & add-ons)", path: "/admin/properties" },
  pricing_rules: { label: "a property's Catalog (pricing)", path: "/admin/properties" },

  // Member adventures (curated trips)
  member_adventures: { label: "Adventures", path: "/admin/adventures" },
  member_adventure_rsvps: { label: "Adventures (the roster)", path: "/admin/adventures" },

  // Waiver wording
  waiver_templates: { label: "Waivers", path: "/admin/settings/waivers" },

  // Instructors — profiles, disciplines, properties, schedules
  instructors: { label: "Instructors", path: "/admin/instructors" },
  instructor_disciplines: { label: "Instructors", path: "/admin/instructors" },
  instructor_properties: { label: "Instructors", path: "/admin/instructors" },
  instructor_availability: { label: "Instructors (schedules)", path: "/admin/instructors" },
  instructor_availability_exceptions: { label: "Instructors (schedules)", path: "/admin/instructors" },
  instructor_portal_access: { label: "Instructors", path: "/admin/instructors" },

  // Staff / team profiles
  staff_profiles: { label: "Team", path: "/admin/team" },

  // Live records — never edited by SQL; managed through their dashboard screens
  bids: { label: "Bids", path: "/admin/bids" },
  bid_line_items: { label: "Bids", path: "/admin/bids" },
  bookings: { label: "Bookings", path: "/admin/bookings" },
  booking_add_ons: { label: "Bookings", path: "/admin/bookings" },
  booking_disciplines: { label: "Bookings", path: "/admin/bookings" },
  people: { label: "Members", path: "/admin/members" },
  memberships: { label: "Members", path: "/admin/members" },
  membership_people: { label: "Members", path: "/admin/members" },
};

// ---------------------------------------------------------------------------
// DML detection. We look ONLY for data changes (not CREATE/ALTER DDL) against the
// managed tables. Comments are stripped first so commented-out examples don't
// trip the guard. String-literal contents are NOT stripped (rare to hide a DML
// verb in a string, and stripping them safely is fragile) — acceptable risk.
// ---------------------------------------------------------------------------
function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ") // /* block */
    .replace(/--[^\n]*/g, " "); // -- line
}

// table-name fragment: optional `public.` schema, optional double-quotes.
const TBL = `(?:public\\s*\\.\\s*)?"?([a-z_][a-z0-9_]*)"?`;

const DML_PATTERNS = [
  { verb: "INSERT", re: new RegExp(`\\binsert\\s+into\\s+${TBL}`, "gi") },
  // UPDATE <table> [AS] [alias] SET …  (the trailing SET confirms it's a real
  // UPDATE statement, and the alias is skipped without swallowing the SET).
  {
    verb: "UPDATE",
    re: new RegExp(
      `\\bupdate\\s+(?:only\\s+)?${TBL}(?:\\s+(?:as\\s+)?(?!set\\b)[a-z_][a-z0-9_]*)?\\s+set\\b`,
      "gi",
    ),
  },
  { verb: "DELETE", re: new RegExp(`\\bdelete\\s+from\\s+(?:only\\s+)?${TBL}`, "gi") },
  { verb: "MERGE", re: new RegExp(`\\bmerge\\s+into\\s+${TBL}`, "gi") },
  { verb: "TRUNCATE", re: new RegExp(`\\btruncate\\s+(?:table\\s+)?(?:only\\s+)?${TBL}`, "gi") },
];

/**
 * Returns the first managed-table data change found, or null.
 * @returns {{verb:string, table:string, label:string, path:string} | null}
 */
function findManagedDml(sql) {
  if (!sql) return null;
  const cleaned = stripSqlComments(sql);
  for (const { verb, re } of DML_PATTERNS) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(cleaned)) !== null) {
      const table = (match[1] || "").toLowerCase();
      const page = DASHBOARD_TABLES[table];
      if (page) return { verb, table, label: page.label, path: page.path };
    }
  }
  return null;
}

function deny(hit) {
  const reason =
    `Hold on — "${hit.table}" is content you can edit yourself in the admin dashboard, ` +
    `so it shouldn't be changed with SQL.\n\n` +
    `You tried to ${hit.verb} rows in "${hit.table}". That table is managed under ` +
    `**${hit.label}** in the admin area:\n\n` +
    `    Open the site → Admin → go to ${hit.path}\n\n` +
    `Edit it there and it saves instantly and live — no code change, no branch, no ` +
    `pull request, and no waiting on your developer. (A lot of the site works this ` +
    `way: FAQ & gear, property info and hours, experiences & add-ons, pricing, ` +
    `adventures, waiver wording, instructors, team, plus your bids, bookings, and ` +
    `members — all editable in /admin.)\n\n` +
    `SQL migrations are only for changing the *structure* of the database (a brand-new ` +
    `table or column for a feature that doesn't exist yet) — not for editing content ` +
    `that already has a screen. If you genuinely need a new structure, that's the ` +
    `"build-a-feature" path; otherwise, please use the dashboard.`;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// File edits — only inspect .sql files (migrations live under supabase/migrations).
// ---------------------------------------------------------------------------
if (toolName === "Write" || toolName === "Edit" || toolName === "MultiEdit") {
  const filePath = String(toolInput.file_path || "").replace(/\\/g, "/");
  const isSql = filePath.toLowerCase().endsWith(".sql") || filePath.includes("supabase/migrations/");
  if (!isSql) process.exit(0);

  // Gather whatever new SQL this edit introduces.
  let incoming = "";
  if (toolName === "Write") incoming = String(toolInput.content || "");
  else if (toolName === "Edit") incoming = String(toolInput.new_string || "");
  else if (toolName === "MultiEdit") {
    incoming = (toolInput.edits || []).map((edit) => String(edit?.new_string || "")).join("\n");
  }

  const hit = findManagedDml(incoming);
  if (hit) deny(hit);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Bash — catch hand-run SQL (psql / supabase db ... -c "…" / heredocs).
// ---------------------------------------------------------------------------
if (toolName === "Bash") {
  const command = String(toolInput.command || "");
  // Only bother if this looks like it's running SQL at all.
  if (/\b(psql|supabase)\b/i.test(command) || /<<\s*['"]?\w*sql/i.test(command)) {
    const hit = findManagedDml(command);
    if (hit) deny(hit);
  }
  process.exit(0);
}

// Anything else: allow.
process.exit(0);
