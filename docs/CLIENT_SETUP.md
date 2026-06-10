# Rhythm Outdoors — Contributor Setup Guide

Welcome! This guide gets you set up to make changes to the Rhythm Outdoors website
on your own Mac, using Claude Code. You'll mostly be doing **layout, styling, and
content** work — and you'll drive everything by *talking to Claude*. You don't need
to be a programmer.

This workspace is **guard-railed**: it's set up so you literally *can't* break the
live website or its data. Every change you make goes onto its own "branch" and
becomes a **pull request** that your developer reviews before anything goes live.

---

## 1. How this works (the 60-second version)

1. You tell Claude what you want to change ("make the booking page hero bigger").
2. Claude puts your change on a **branch** (a safe, separate copy — never the live site).
3. You see it instantly on your own computer at `http://localhost:3000`.
4. When you're happy, Claude opens a **pull request** and shares a **preview link**.
5. Your **developer reviews and publishes** it. Done.

You never touch the live database, you never deploy, and you can't accidentally
push to the live site. If you ask for something that would, Claude will tell you
it's been handed to your developer instead — and keep going with the rest.

---

## 2. What you can and can't do

**You can freely:**
- Change layout, spacing, colors, fonts, and styling
- Edit text and content
- Move existing components and sections around
- Add new pages and UI built from what already exists

**Handled by your developer (Claude flags these for you automatically):**
- Adding new software libraries, or changing the app's **foundation** (build setup,
  login/security, how data is stored) — the foundation is already built; your work is
  the look and the content
- Anything that changes the **database** (Claude writes it down in your pull
  request as a "migration" — your developer applies it)
- Publishing/deploying to the live site
- Anything touching live payments or live customer data

You don't have to remember this list. The workspace enforces it for you.

---

## 3. One-time setup

Do this once. If you get stuck on any step, paste the error to Claude — it can help.

### ⚡ Fastest way — one command
First create a free GitHub account and accept your invite (3.1 below), and make sure
you have Claude Code. Then open the **Terminal** app (press ⌘ + Space, type
"Terminal", press Enter).

**Move into the folder where you want the project to live.** If you're not sure, your
Documents folder is fine — the project is created in a `rhythm-outdoors` subfolder
right where you are:

```bash
cd ~/Documents
```

Now paste this one line — it installs everything, signs you in, downloads the project,
and opens Claude:

```bash
curl -fsSL https://rhytm-one.vercel.app/setup.sh -o ~/rhythm-setup.sh && bash ~/rhythm-setup.sh
```

**⚠️ Run this inside Terminal.** Don't click the link or double-click a downloaded
`.sh` file — that only opens it in a text editor. The command above downloads *and*
runs it for you.

It pauses with clear instructions at the few steps only you can do (GitHub sign-in,
approving Docker the first time). Prefer to do it by hand? Follow 3.1–3.5 below instead.

### 3.1 Get a GitHub account and accept the invite
1. Go to **https://github.com** and sign up (free).
2. Send your GitHub username to your developer.
3. They'll invite you to the project repository. Check your email and **accept the
   invitation** (or visit https://github.com/notifications).

### 3.2 Install the tools (Mac)
Open the **Terminal** app (press `Cmd+Space`, type "Terminal", Enter), then:

1. **Homebrew** (a tool installer) — paste this and follow the prompts:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
2. **Node 24, Git, and the GitHub CLI**:
   ```bash
   brew install node@24 git gh
   ```
3. **Docker Desktop** — this runs the local database on your machine.
   Download from **https://www.docker.com/products/docker-desktop/**, install it
   like any Mac app, then **open it once** so it's running (you'll see a whale
   icon in your menu bar). *Leave it running whenever you work on the site.*
   > **What is Docker for?** It quietly runs a private copy of the website's
   > database on your own Mac, filled with sample data, so every page renders
   > realistically while you design. Because it's all local, you physically can't
   > touch the real customer data. You never interact with Docker directly —
   > Claude does.
4. **Claude Code** — you already have this. (If you ever need to reinstall:
   `npm install -g @anthropic-ai/claude-code`.) Make sure you're logged in.

### 3.3 Sign in to GitHub from the terminal
```bash
gh auth login
```
Choose **GitHub.com → HTTPS → Login with a web browser**, and follow the prompts.
This is what lets Claude push your work and open pull requests for you.

### 3.4 Get the project onto your computer
Move into the folder where you want the project to live, then clone the repo:
```bash
cd ~/Documents          # or wherever you want it
gh repo clone tazcarper/rhytm
cd rhytm
```

### 3.5 Let Claude finish the setup
Now start Claude Code inside that folder (`claude`) and say:

> **"Set me up to work on this project for the first time."**

Claude will:
- install the project's dependencies (`npm install`),
- start the local database (`npx supabase start` — Docker must be running),
- create your `.env.local` from the example and fill in the local database keys,
- create sample login accounts so you can view the member/partner/admin pages,
- start the site at **http://localhost:3000**.

That's it — you're ready.

> **About `.env.local` and keys:** this file holds local settings only. Claude
> generates them on your machine — **no production secrets are ever sent to you.**
> If your developer ever needs to give you a test key, they'll send it as a
> one-time secret link (never plain email/Slack). Never paste a key anyone calls
> "live" or "production."

---

## 4. Your day-to-day workflow

Just talk to Claude. For example:

> "On the homepage, make the hero image full-width and move the 'Book Now' button
> above the description."

Claude will:
1. Start a new **branch** for the change (tells you the name).
2. Make the edit.
3. Show it to you at `http://localhost:3000`.
4. Iterate with you until it looks right.
5. **Push** the branch and, when you say you're done, **open a pull request**.
6. Share the **Vercel preview link** so you and your developer can both see it.

Helpful things to say:
- *"Show me that page"* — Claude makes sure the local site is running.
- *"I'm done with this one"* — Claude opens the pull request.
- *"Start something new"* — Claude begins a fresh branch.

### Test logins (for designing the signed-in pages)
After setup, you can sign in locally to see the member/partner/admin areas:

| Page area | Email | Password |
|---|---|---|
| Member | `member@example.test` | `password123` |
| Partner | `partner@example.test` | `password123` |
| Admin | `admin@example.test` | `password123` |

(These exist only on your machine.)

---

## 5. Seeing your changes

- **On your computer:** `http://localhost:3000` — instant, this is your main view.
- **Preview link:** after you push, a **Vercel preview** of your branch builds
  automatically and Claude shares the URL. This is great for showing your developer.

> If a change involves the database, the *preview link* might not show it until
> your developer applies that change — but your **local** site (`localhost:3000`)
> always shows it. Trust the local view.

---

## 6. When you're done

Say *"I'm done"* and Claude opens a **pull request**. Your developer gets notified,
reviews it, and publishes it to the live site. You'll get the preview link to look
at together in the meantime. You don't merge or publish anything yourself — that's
the safety gate, on purpose.

---

## 7. Troubleshooting

- **"Cannot connect to the Docker daemon" / database won't start** → Open Docker
  Desktop and wait for the whale icon to settle, then ask Claude to try again.
- **A change "won't push" or Claude says something is blocked** → That's the
  guardrail. It means that action belongs to your developer. Claude has captured
  it in your pull request — just continue.
- **The site looks broken after pulling new changes** → Ask Claude to
  "reset the local database and restart" (it runs `npx supabase db reset`).
- **Anything else** → Paste the message to Claude and ask what it means.

---

## Appendix — Developer one-time setup (not for the client)

Do these once so the client's workspace is safe and previews work:

1. **Invite the client** as a collaborator on `tazcarper/rhytm` (Settings →
   Collaborators). Write access is fine — `main` is protected (next step).
2. **Protect `main`** (Settings → Branches → Add rule for `main`):
   - Require a pull request before merging
   - Require approvals (1) — *you* are the approver
   - Require status checks to pass → select the **Typecheck** check from
     `.github/workflows/ci.yml`
   - Do **not** allow the client to bypass these
3. **Vercel preview visibility** — if Deployment Protection is on, either disable
   it for **Preview** deployments or add the client to the Vercel project so they
   can open preview URLs. (Production stays protected.)
4. **Keep production secrets in Vercel only.** Never send the client a live key.
   For local third-party testing, send **test/restricted** keys via a one-time
   secret link (Bitwarden Send, 1Password share, or onetimesecret.com).
5. **Your own machine:** the guardrail hook is on by default for everyone. You've
   already got `.claude/.developer-mode` in this clone, which disables it for you.
   New developer clones need that file created once (it's gitignored).
6. **Applying a client's database change at merge:** check out their branch,
   apply the migration locally to verify (`npx supabase db reset`), confirm it's
   safe per the PR's "Database changes" runbook, then apply to production and merge.
7. **The one-command installer:** `public/setup.sh` is served at `/setup.sh` on the
   deployed site. Give the client this exact line:
   `curl -fsSL https://rhytm-one.vercel.app/setup.sh -o ~/rhythm-setup.sh && bash ~/rhythm-setup.sh`.
   It's Mac-only and idempotent — installs the tools, signs them in, clones the repo,
   and hands off to Claude. The web page at `/client-setup.html` shows the correct URL
   automatically. (Heads-up: a fresh deploy serves the latest `setup.sh`, so test the
   one-liner once after deploying.)
