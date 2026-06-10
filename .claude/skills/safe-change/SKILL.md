---
name: safe-change
description: The safe change workflow for client contributors — branch off origin/main, make the change, test locally, push, and open a pull request for developer review. Use for EVERY change request (layout, CSS, copy, component moves, new UI) when working in this repo as a client contributor. Also covers what to do when a change needs a database/schema modification (write a migration, never touch the live DB).
---

# Safe change workflow (client contributor mode)

You are helping a non-technical client change this app on their own machine. Every
change must end as a **pushed feature branch + a pull request** that a developer
reviews and merges. The client never edits `main` directly and never touches a
live database or live payment data. A PreToolUse hook
(`.claude/hooks/client-guardrails.mjs`) enforces this — but you should follow the
flow proactively so the client never hits a wall.

> If `.claude/.developer-mode` exists, you are on the developer's machine — this
> skill does not apply; work normally.

## Stay in the front-end lane (read this first)

The foundation of this app — its **packages, build config, authentication, data
layer, database schema, and backend services** — is already built and deliberately
fixed. The overwhelming majority of a client's work is **presentation**: layout,
spacing, styling, fonts, colors, copy, and rearranging existing components. Treat
foundational change as out of scope and steer toward a front-end solution.

**Heavily discourage — and do not do — the following. Route them to the developer:**

- **Adding or removing npm packages.** If a request seems to need a new library,
  stop and first try to do it with what's already installed — the project already has
  Tailwind, Radix, the design-system primitives in `lib/ui`, date pickers, markdown,
  and more. Only if it genuinely cannot be done without a new dependency, explain that
  this is a developer decision (bundle size, security, build stability) and don't
  install it. (The guardrail hook blocks `npm install <package>` / `add` / `remove`;
  a bare `npm install` to restore existing packages is fine.)
- **Changing backend / build / auth setup** — `package.json`, `next.config.*`,
  `tsconfig.json`, `middleware.ts`, `lib/supabase/*`, `lib/auth/*`,
  `supabase/config.toml`. These are the foundation; the hook blocks edits to them.
- **Restructuring data fetching, services, or RLS.** Move and restyle the components
  that *use* a service — don't rewrite the service or change how it queries.

When you must say no to one of these, say it kindly and offer the nearest
front-end-only alternative: *"That would need new backend plumbing, which is your
developer's area — but I can get the same look by restyling the existing component.
Want me to do that?"*

## The loop — run this for every change request

### 1. Start on a fresh feature branch
Before making any edit:
- Make sure the working tree is clean. If there are uncommitted changes from a
  previous task, ask the client whether to finish/push them first.
- If the current branch is `main`: pull the latest and create a new branch.
  ```bash
  git checkout main
  git pull origin main
  git checkout -b client/<short-kebab-description>
  ```
- If already on a `client/...` branch for *this same* piece of work, stay on it.
- Branch names: `client/<short-kebab-description>` (e.g. `client/booking-hero-layout`).

Tell the client in one plain sentence: *"I've started a new branch called X for this change."*

### 2. Make the change
Front-end / layout / CSS / copy / moving existing components — normal edits under
`app/` and `src/`. Keep to the project's conventions (see `CLAUDE.md`).

### 3. If the change needs the DATABASE to change — STOP and do this instead
Adding a column, table, enum value, policy, or any schema change. You must **never**
push to a live database. Instead:
1. Create a migration file: `npx supabase migration new <description>`
2. Write the SQL into the new file under `supabase/migrations/`.
3. Apply it **locally only** so the client can see it work:
   ```bash
   npx supabase db reset   # re-runs all migrations + seed against the LOCAL stack
   ```
4. Record it for the pull request: append a short entry to the PR body's
   **"Database changes"** section (see step 7) — what changed, why, and any risk
   (e.g. "adds nullable column, safe" vs. "backfills existing rows, review needed").
5. Tell the client plainly: *"This change needs a database update. I've written it
   as a migration in your branch and noted it in the pull request — your developer
   will apply it to production. You don't need to do anything."*

Never run `supabase db push`, `supabase link`, `--linked`, or the Supabase MCP
write tools. The hook blocks them; this is by design.

### 4. Typecheck
```bash
npm run typecheck
```
Fix any type errors before continuing.

### 5. Let the client see it
Start the local app so they can view the change:
```bash
npm run dev   # http://localhost:3000
```
Point them at the relevant page. Iterate with them until they're happy.

### 6. Commit and push the branch
```bash
git add -A
git commit -m "<clear, plain-language summary of the change>"
git push -u origin client/<short-kebab-description>
```
(Never `git add` a `.env` file — secrets must not be committed.)

### 7. When the client says they're done — open the pull request
```bash
gh pr create --base main --head client/<branch> \
  --title "<plain summary>" \
  --body "<see template below>"
```
PR body template:
```markdown
## What changed
<1–3 plain sentences a non-technical reader understands>

## How to see it
<which page(s) / what to look at>

## Database changes
<"None." — OR — the runbook entries from step 3: each migration file,
what it does, and the risk level. If present, the developer must apply
these to production before/at merge.>

## Notes for review
<anything the developer should know>
```
Then tell the client: *"Your pull request is open. Your developer will review and
merge it — I'll share the preview link so you can both look at it."*

### 8. Share the Vercel preview link
Every pushed branch auto-builds a Vercel preview. Retrieve and share its URL:
```bash
gh pr view <number> --json statusCheckRollup,comments
```
Look for the Vercel deployment status / bot comment and give the client the
preview URL. Note honestly: if the change includes a **migration**, the preview
may not fully reflect it until the developer applies that migration to the
preview/production database — the client's **local** `npm run dev` is the
source of truth for DB-backed changes.

## Communication rules
- Speak in plain language. No jargon unless you explain it in the same breath.
- Narrate what you're doing at each step ("Starting a branch…", "Pushing your
  change…", "Opening the pull request…") so the client always knows where they are.
- If the hook blocks something, don't fight it — explain what it means in friendly
  terms and that their developer will handle that part.
