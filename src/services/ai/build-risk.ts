import type { GitHubIssuesClient } from "@/lib/github/issues-client";
import type { FeatureBuild } from "@/src/services/ai/capability-requests";

// How careful to be publishing a feature build (Taz, 2026-11-10). Judged
// from the files the build's pull request actually changes, not from how
// the request was worded. Three levels:
//
// - normal: adds new things (a column, a table, a screen). Any admin
//   publishes it.
// - careful: touches money, guests' inboxes, bookings, member records or
//   the database's automatic rules. Any admin may still publish it (Taz
//   wants staff to be able to ship things like online payment), but the
//   card says what to check and the owner is emailed when it goes live.
// - owner: can't be undone or exposes data: deletes or rewrites existing
//   data, removes or renames fields, changes who can see data, sign-in or
//   the site's setup. Only the owner may publish it.

export interface ChangedFile {
  filename: string;
  status: string; // GitHub's: added, modified, removed, renamed, …
  // The diff. GitHub leaves it out for very large files.
  patch?: string;
}

export type BuildRiskLevel = "normal" | "careful" | "owner";

export interface BuildRisk {
  level: BuildRiskLevel;
  // Plain reasons, one per kind of risk, for the request card.
  reasons: string[];
}

interface Finding {
  reason: string;
  level: Exclude<BuildRiskLevel, "normal">;
}

interface Rule extends Finding {
  test: RegExp;
}

// SQL a migration adds that changes or removes something that exists.
const SQL_RULES: ReadonlyArray<Rule> = [
  {
    reason: "Changes who can see or change data",
    level: "owner",
    test: /\b(create|alter|drop)\s+policy\b|\b(enable|disable|force|no\s+force)\s+row\s+level\s+security\b|\b(grant|revoke)\b/i,
  },
  {
    reason: "Adds or changes the database's automatic rules",
    level: "careful",
    test: /\bcreate\s+(or\s+replace\s+)?(trigger|function|rule)\b|\b(alter|drop)\s+(trigger|function|rule)\b/i,
  },
  {
    reason: "Removes or renames existing fields or tables",
    level: "owner",
    test: /\bdrop\s+(table|column|view|type|index|constraint|schema)\b|\brename\s+(to|column)\b|\balter\s+column\b[^;]*\b(type|set\s+not\s+null|drop)\b/i,
  },
  {
    reason: "Rewrites or deletes existing data",
    level: "owner",
    test: /\bupdate\s+[\w."]+\s+set\b|\bdelete\s+from\b|\btruncate\b/i,
  },
];

// Code areas where a change reaches money, guests' inboxes, logins or
// people's records.
const PATH_RULES: ReadonlyArray<Rule> = [
  { reason: "Changes how payments work", level: "careful", test: /(^|\/)stripe(\/|[-.])|deposit|refund|checkout/i },
  { reason: "Changes emails sent to people", level: "careful", test: /^src\/services\/notifications\/|(^|\/)emails?\//i },
  { reason: "Changes sign-in or who can open which pages", level: "owner", test: /^lib\/(auth|supabase)\/|^proxy\.ts$|^app\/auth\/|^src\/services\/auth\//i },
  { reason: "Changes bookings or member records", level: "careful", test: /^src\/services\/(bookings|members)\/|^app\/member\//i },
  { reason: "Changes how the site is set up or deployed", level: "owner", test: /^(package(-lock)?\.json|next\.config\.\w+|tsconfig\.json|vercel\.json)$|^\.github\//i },
];

const isMigration = (filename: string) => /^supabase\/migrations\/.+\.sql$/i.test(filename);

// Only the lines the change adds (a migration's removed lines don't run).
const addedLines = (patch: string) =>
  patch
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1).replace(/--.*$/, ""))
    .join("\n");

const tableName = (name: string) => name.replace(/"/g, "").replace(/^public\./i, "").toLowerCase();

// Tables the change itself creates. Rules, access and data on a brand-new
// table can't affect anything that exists, so they stay normal (every new
// table needs its access rules: CLAUDE.md's RLS rules).
function createdTables(sql: string): Set<string> {
  const names = [...sql.matchAll(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)/gi)].map((match) => tableName(match[1]));
  return new Set(names);
}

// The table a statement acts on, when it names one.
function targetTable(statement: string): string | null {
  const match =
    statement.match(/\b(?:policy|trigger)\b[\s\S]*?\bon\s+(?:table\s+)?([\w."]+)/i) ??
    statement.match(/\bgrant\b[\s\S]*?\bon\s+(?:table\s+)?([\w."]+)/i) ??
    statement.match(/\brevoke\b[\s\S]*?\bon\s+(?:table\s+)?([\w."]+)/i) ??
    statement.match(/\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([\w."]+)/i) ??
    statement.match(/\bupdate\s+([\w."]+)\s+set\b/i) ??
    statement.match(/\bdelete\s+from\s+([\w."]+)/i) ??
    statement.match(/\btruncate\s+(?:table\s+)?([\w."]+)/i);
  return match ? tableName(match[1]) : null;
}

function sqlRules(sql: string): Finding[] {
  const created = createdTables(sql);
  const matched = new Set<Rule>();
  for (const statement of sql.split(";")) {
    const table = targetTable(statement);
    // Functions are shared by everything, so even one for a new table counts.
    const definesFunction = /\b(create|alter|drop)\s+(or\s+replace\s+)?function\b/i.test(statement);
    if (table !== null && created.has(table) && !definesFunction) continue;
    for (const rule of SQL_RULES) if (rule.test.test(statement)) matched.add(rule);
  }
  return [...matched];
}

const EDITED_MIGRATION: Finding = { reason: "Changes a database update that already ran", level: "owner" };
const UNREADABLE_MIGRATION: Finding = { reason: "Has a database update too large to check", level: "owner" };
const REMOVED_FILE: Finding = { reason: "Removes part of the site", level: "careful" };

export function assessBuildRisk(files: ReadonlyArray<ChangedFile>): BuildRisk {
  const matched = new Set<Finding>();
  for (const file of files) {
    if (isMigration(file.filename)) {
      // Editing a migration that already ran can't change a database that
      // has it; whatever it means, it isn't the normal additive path.
      if (file.status !== "added") matched.add(EDITED_MIGRATION);
      if (file.patch === undefined) matched.add(UNREADABLE_MIGRATION);
      for (const rule of sqlRules(addedLines(file.patch ?? ""))) matched.add(rule);
      continue;
    }
    if (file.status === "removed") matched.add(REMOVED_FILE);
    for (const rule of PATH_RULES) if (rule.test.test(file.filename)) matched.add(rule);
  }
  const rules = [...matched];
  const level: BuildRiskLevel = rules.some((rule) => rule.level === "owner")
    ? "owner"
    : rules.length > 0
      ? "careful"
      : "normal";
  // The reasons that set the level come first.
  const reasons = [...rules.filter((rule) => rule.level === "owner"), ...rules.filter((rule) => rule.level !== "owner")].map(
    (rule) => rule.reason,
  );
  return { level, reasons };
}

// Risk when the files couldn't be read: assume the worst.
export const UNCHECKED_RISK: BuildRisk = {
  level: "owner",
  reasons: ["Couldn't check what this build changes"],
};

// The owner(s): BUILD_OWNER_EMAILS, comma-separated. They alone publish
// owner-level builds and get an email when a careful one goes live. When
// it's unset nobody can publish owner-level builds from the dashboard
// (merge them on GitHub instead).
export function buildOwnerEmails(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.BUILD_OWNER_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isBuildOwner(email: string | null | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  return !!email && buildOwnerEmails(env).includes(email.trim().toLowerCase());
}

// The risk of a build that's waiting to be published (its pull request is
// open). Null when there's nothing to publish.
export async function getBuildRisk(
  github: Pick<GitHubIssuesClient, "listPullRequestFiles">,
  build: FeatureBuild | null,
): Promise<BuildRisk | null> {
  const pr = build?.pullRequest;
  if (pr?.state !== "open" || pr.number === null) return null;
  const listed = await github.listPullRequestFiles(pr.number);
  return listed.ok ? assessBuildRisk(listed.files) : UNCHECKED_RISK;
}

// Risk for each request with a build waiting to be published, keyed by id.
export async function getBuildRiskFor(
  github: Pick<GitHubIssuesClient, "listPullRequestFiles">,
  rows: ReadonlyArray<{ id: string; build: FeatureBuild | null }>,
): Promise<Record<string, BuildRisk>> {
  const results = await Promise.all(rows.map(async (row) => [row.id, await getBuildRisk(github, row.build)] as const));
  return Object.fromEntries(results.filter((entry): entry is readonly [string, BuildRisk] => entry[1] !== null));
}
