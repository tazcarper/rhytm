#!/usr/bin/env node
/**
 * Client contributor guardrails — PreToolUse hook.
 *
 * Purpose: this repo is driven by a non-technical client through Claude Code on
 * their own machine. They make layout / CSS / front-end changes on feature
 * branches and open pull requests; a developer reviews and merges. This hook is
 * the HARD backstop (prompt instructions can be talked around — a hook cannot)
 * that stops the handful of actions that could damage live data or skip review:
 *
 *   • writing to a REMOTE/production database (Supabase CLI push/link, the
 *     Supabase MCP write tools, direct psql to a hosted host)
 *   • mutating live Stripe data (the Stripe MCP write tools)
 *   • committing/pushing to main, force-pushing, rewriting history, merging main
 *   • deploying directly (Vercel)
 *   • committing secrets (.env files)
 *   • editing the guardrails themselves
 *
 * It is ON BY DEFAULT. The developer disables it on their own machine by
 * creating an (gitignored) `.claude/.developer-mode` marker file — the client's
 * clone never has that file, so they are always guarded. Local-only work
 * (editing code, `supabase start`, local `supabase db reset`, `npm run dev`,
 * branch pushes, `gh pr create`) is fully allowed.
 *
 * Contract: reads the PreToolUse JSON payload on stdin; to block, prints a
 * `permissionDecision: "deny"` object on stdout and exits 0. Allowing is a
 * silent exit 0.
 */

import fs from "node:fs";
import { execSync } from "node:child_process";

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

// Developer escape hatch: if the marker exists, this is the developer's machine —
// do nothing and allow everything.
if (fs.existsSync(`${projectDir}/.claude/.developer-mode`)) {
  process.exit(0);
}

const toolName = payload.tool_name || "";
const toolInput = payload.tool_input || {};

const CONTACT =
  "\n\n👉 You're in a guard-railed contributor workspace. This action could affect live production data or skip developer review, so it's blocked. Whatever you're trying to do is captured in your branch and pull request instead — please contact your developer to apply it. You don't need to run this yourself.";

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason + CONTACT,
      },
    }),
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Supabase MCP — block anything that mutates the REMOTE (hosted) project.
// Read-only tools (list_tables, get_logs, get_advisors, get_project_url, …) pass.
// ---------------------------------------------------------------------------
const SUPABASE_REMOTE_WRITES = new Set([
  "apply_migration",
  "execute_sql",
  "create_branch",
  "delete_branch",
  "merge_branch",
  "rebase_branch",
  "reset_branch",
  "deploy_edge_function",
  "pause_project",
  "restore_project",
  "create_project",
  "confirm_cost",
]);
if (toolName.startsWith("mcp__plugin_supabase_supabase__")) {
  const operation = toolName.replace("mcp__plugin_supabase_supabase__", "");
  if (SUPABASE_REMOTE_WRITES.has(operation)) {
    deny(
      `Blocked the Supabase remote operation "${operation}". This workspace never touches the live database directly — a schema change becomes a migration file in your branch, which your developer applies.`,
    );
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Stripe MCP — block anything that creates/updates/cancels live data or runs
// arbitrary API calls. Read/search/docs tools pass.
// ---------------------------------------------------------------------------
if (toolName.startsWith("mcp__plugin_stripe_stripe__")) {
  const operation = toolName.replace("mcp__plugin_stripe_stripe__", "");
  const isWrite =
    /^(create_|update_|cancel_|finalize_)/.test(operation) ||
    operation === "stripe_api_execute";
  if (isWrite) {
    deny(
      `Blocked the Stripe write operation "${operation}". This workspace can't create or modify live Stripe data (customers, charges, refunds, products, subscriptions).`,
    );
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// File edits — protect the guardrails and CI from being edited away.
// ---------------------------------------------------------------------------
if (toolName === "Write" || toolName === "Edit" || toolName === "MultiEdit") {
  const filePath = String(toolInput.file_path || "").replace(/\\/g, "/");
  const relPath = filePath.startsWith(projectDir)
    ? filePath.slice(projectDir.length).replace(/^\//, "")
    : filePath;
  const protectedFragments = [
    ".claude/hooks/",
    ".claude/settings.json",
    ".claude/.developer-mode",
    ".github/workflows/",
  ];
  if (protectedFragments.some((fragment) => relPath.includes(fragment))) {
    deny(
      `"${relPath}" is part of the safety guardrails for this workspace and can't be edited here.`,
    );
  }

  // Foundational / backend / build-config files: the foundation is already built.
  // Editing these is the developer's job — client work is layout, styling, content.
  const foundationalFragments = [
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "next.config.js",
    "tsconfig.json",
    "middleware.ts",
    "lib/supabase/",
    "lib/auth/",
    "supabase/config.toml",
  ];
  if (foundationalFragments.some((fragment) => relPath.includes(fragment))) {
    deny(
      `"${relPath}" is part of the project's FOUNDATION — packages, build config, auth, or the Supabase/database setup. That is already built and deliberately fixed; changing it is your developer's responsibility. Your changes should be layout, styling, and content (under app/ and src/components/).`,
    );
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Bash — inspect the command string.
// ---------------------------------------------------------------------------
if (toolName === "Bash") {
  const command = String(toolInput.command || "");
  const lower = command.toLowerCase();

  // 1) Supabase CLI commands that reach a REMOTE project.
  const touchesRemoteSupabase =
    /\bsupabase\b/.test(lower) &&
    (/\bdb\s+push\b/.test(lower) ||
      /\blink\b/.test(lower) ||
      /--linked\b/.test(lower) ||
      /--db-url\b/.test(lower) ||
      /\bdb\s+remote\b/.test(lower) ||
      /\bbranches\b/.test(lower) ||
      /\bdb\s+dump\b/.test(lower) ||
      /\bsecrets\b/.test(lower) ||
      /\bprojects\b/.test(lower));
  if (touchesRemoteSupabase) {
    deny(
      `Blocked a Supabase command that targets a REMOTE project. Local commands (supabase start / stop / status, local "db reset", "migration new") are allowed; pushing to or linking a hosted database is not.`,
    );
  }

  // 1b) Adding / removing packages — the dependency set is fixed; that's a dev decision.
  let changesPackages = /\b(npm|yarn|pnpm|bun)\s+(add|remove|uninstall|rm|un)\b/.test(lower);
  const npmInstallMatch = lower.match(/\bnpm\s+(?:install|i)\b([^\n&|;]*)/);
  if (npmInstallMatch) {
    const namedArgs = npmInstallMatch[1]
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .filter((token) => !token.startsWith("-"));
    if (namedArgs.length > 0) changesPackages = true;
  }
  if (changesPackages) {
    deny(
      `Blocked changing the project's packages. The dependencies are already chosen and set up — adding or removing them is a developer decision (bundle size, security, build stability). A plain "npm install" with no package name (to restore what's already listed) is fine.`,
    );
  }

  // 2) Direct database connections to a non-local host.
  if (
    /\b(psql|pg_dump|pg_restore)\b/.test(lower) &&
    /(supabase\.co|supabase\.com|amazonaws|rds\.|@(?!localhost|127\.0\.0\.1))/.test(
      lower,
    )
  ) {
    deny(
      `Blocked a direct database connection to a remote host. Use the local Supabase stack only.`,
    );
  }

  // 3) Direct deploys.
  if (
    /\bvercel\b/.test(lower) &&
    /(deploy|--prod|\bprod\b|promote|\balias\b)/.test(lower)
  ) {
    deny(
      `Blocked a direct deploy. Deploys happen automatically from your pull request after your developer merges it — and a Vercel preview already builds for every branch you push.`,
    );
  }

  // 4) Committing secrets — refuse to stage .env files.
  if (/\bgit\s+add\b/.test(lower) && /\.env(\.|\b)/.test(lower)) {
    deny(
      `Blocked staging a .env file. Environment files hold secrets and must never be committed — they're already gitignored.`,
    );
  }

  // 5) Git footguns.
  if (/\bgit\b/.test(lower)) {
    if (
      /push\b[\s\S]*(--force|--force-with-lease|--mirror|--delete)/.test(lower) ||
      /push\b[\s\S]*\s-f(\s|$)/.test(lower)
    ) {
      deny(`Force-pushing / deleting remote branches is blocked — it can destroy history.`);
    }
    if (/\b(filter-branch|filter-repo)\b/.test(lower) || /reflog\s+expire/.test(lower)) {
      deny(`History-rewriting git commands are blocked.`);
    }
    if (/push\b[\s\S]*\b(main|master)(\s|$|:)/.test(lower) || /push\b[\s\S]*:(main|master)\b/.test(lower)) {
      deny(
        `Pushing directly to "main" is blocked. Your work lives on a feature branch and reaches main only through a reviewed pull request.`,
      );
    }
    if (/\bmerge\b/.test(lower) && /\b(main|master|origin\/main|origin\/master)\b/.test(lower)) {
      deny(`Merging into main locally is blocked. Open a pull request and your developer will merge it.`);
    }
  }

  // 6) Committing or pushing while ON main/master.
  if (/\bgit\b/.test(lower) && /\b(commit|push)\b/.test(lower)) {
    let currentBranch = "";
    try {
      currentBranch = execSync("git rev-parse --abbrev-ref HEAD", {
        cwd: projectDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      currentBranch = "";
    }
    if (currentBranch === "main" || currentBranch === "master") {
      deny(
        `You're on "${currentBranch}". Don't commit or push here — ask me to create a feature branch first (I'll branch off the latest origin/main) and we'll work there.`,
      );
    }
  }

  process.exit(0);
}

// Anything else: allow.
process.exit(0);
