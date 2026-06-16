# Worked example — "Let me edit the homepage banner myself"

This is a **permanent reference feature**. The finished code lives on the branch
`feature/editable-homepage-hero` (intentionally **not merged** — it's a teaching
artifact). This doc lives on `main` so it's always discoverable, and the
**`build-a-feature` skill** points here as its canonical pattern.

It answers one question for both the **non-technical client** and the **developer**:

> *What does it look like when a client asks Claude for a real feature — one that
> needs a new admin screen AND a database change — and turns it into a pull request?*

It's a small full-stack feature: an **admin page where staff can edit the homepage
hero banner** (the big welcome block at the top of the public site) — the eyebrow,
headline, supporting text, both buttons, and an optional background image — with the
homepage reading those values live.

To study the code: `git diff main..feature/editable-homepage-hero`.

---

## 1. For the client — how you'd actually ask for this

You don't need to know the words "migration", "RLS", or "service". You describe
**what you want to be able to do**, in plain language, and Claude figures out the
pieces. Here are real prompts you could paste, start to finish.

### The opening ask
> "On the homepage there's a big welcome banner at the top — the 'Your day in the
> Texas Hill Country starts here' part. Right now I have to ask a developer every
> time I want to change that wording. I'd like to be able to edit it myself. Can you
> add a page in the admin area where I can change the little label, the big headline,
> the paragraph under it, and the two buttons? And let me put a background image
> behind it too."

That single sentence is enough. Claude will create a place in the database to store
the banner, build the admin page with a form, make the homepage read from it, and
tell you it needs a "database change" that your developer applies.

### Looking at it
> "Show me the homepage so I can see the banner."
> "Now open the admin homepage page so I can try editing it."

### Iterating on the look
> "The headline is too big — can you make it a bit smaller?"
> "Put more space between the two buttons."
> "When I add a background image the text is hard to read — can you darken the image
> a little so white text shows up?"

### Changing the actual content (the everyday use, after it ships)
> "Change the headline to 'Your Hill Country weekend starts here.'"
> "Make the first button say 'Book a visit' and point it at the booking page."
> "Hide the second button for now."

### When you're happy
> "This looks great. I'm done — open the pull request so my developer can review it."

Claude opens the pull request and (once the preview finishes building) shares a
**Vercel preview link**. Because this feature adds a database change, the preview may
not show the banner correctly until your developer applies that change — but your
**local** site at `http://localhost:3000` always shows it. Trust the local view.

### If you get stuck
> "Claude says something is blocked — what does that mean?"

That's the safety guardrail: the action belongs to your developer (anything touching
the real live website or its database). Claude has already captured it in your pull
request. Just keep going.

---

## 2. What a non-engineer is really asking for (the translation)

The point of this example: **plain-language requests map cleanly onto real
engineering pieces.** You (the client) only write the left column. Claude produces
the right column.

| What you say | What Claude builds |
|---|---|
| "store the banner so I can edit it" | a `homepage_hero` table in the database (a *migration*) |
| "only I / staff should be able to change it" | a security rule: public can read, only admins can write (*RLS policy*) |
| "a page in the admin area to edit it" | `/admin/homepage` + an edit form |
| "the homepage should show what I set" | the homepage reads the row and renders it |
| "let me put an image behind it" | an image-URL field + a darkening overlay so text stays readable |

---

## 3. For the developer — what's in the PR and what you do

### Files (all on `feature/editable-homepage-hero`)

| File | Role |
|---|---|
| `supabase/migrations/20260615120000_homepage_hero.sql` | singleton `homepage_hero` table, RLS (public read / admin write), `updated_at` trigger, seed row with the current copy |
| `src/services/public/homepage-hero.ts` | `getHomepageHero()` read + domain type + safe fallback |
| `src/services/admin/homepage-hero.ts` | `updateHomepageHero()` write + Zod input schema |
| `app/admin/homepage/actions.ts` | thin server action (validate → service → revalidate `/` and `/admin/homepage`) |
| `app/admin/homepage/page.tsx` | admin editor page (fetch → render form) |
| `src/components/admin/homepage-hero-form.tsx` (+ `.module.css`) | the edit form (client component) |
| `app/page.tsx` | homepage now reads the hero instead of hardcoding it |
| `src/components/admin/admin-nav.tsx` | adds the "Homepage" nav link |

### How it honors the project rules
- **SOLID / thin pages:** the page fetches via a service and renders; the action
  validates and delegates; the write service does one thing.
- **RLS first:** public `SELECT USING (true)`; admin `FOR ALL` gated on
  `app_metadata.role IN ('super_admin','admin')`, wrapped in `(SELECT …)` for the
  InitPlan. No cross-table references → no policy-cycle risk.
- **Config in DB:** same reasoning as the per-property `properties.tagline` added in
  App 3.9 — operational/marketing copy lives in editable rows, not TS constants.
- **No-deploy fallback:** `getHomepageHero()` returns a `FALLBACK_HOMEPAGE_HERO` if
  the row is missing, so the homepage never renders empty.

### Your review + merge runbook (mirrors the standard client-change flow)
1. **Pull the branch**, read the diff.
2. **Apply the migration locally** to verify it (`npx supabase db reset`), then open
   `/admin/homepage`, edit, and confirm the homepage updates.
3. **Review the RLS by hand** — sign in as a member and confirm you *cannot* write the
   row; as an admin confirm you can. (Project rule: every new RLS policy gets an
   explicit manual test — never rubber-stamp this part.)
4. **Apply the migration to production**, then merge the code. Code + schema go live
   together.

> If you adapt this into a real merged feature later, copy the pattern but give it its
> own branch — leave `feature/editable-homepage-hero` intact as the example.
