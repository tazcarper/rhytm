# Worked example — "Let me edit the homepage banner myself"

This is a **permanent reference feature** that lives on the branch
`feature/editable-homepage-hero`. It exists to answer one question for both
the **non-technical client** and the **developer**:

> *What does it look like when a client asks Claude for a real feature — one
> that needs a new admin screen AND a database change — and turns it into a
> pull request?*

It's a small full-stack feature: an **admin page where staff can edit the
homepage hero banner** (the big welcome block at the top of the public site) —
the eyebrow, headline, supporting text, both buttons, and an optional
background image — with the homepage reading those values live.

Keep this branch around. Don't merge it into `main` and delete it; it's a
teaching artifact, linked from the README.

---

## 1. For the client — how you'd actually ask for this

You don't need to know the words "migration", "RLS", or "service". You describe
**what you want to be able to do**, in plain language, and Claude figures out
the pieces. Here are real prompts you could paste, start to finish.

### The opening ask
> "On the homepage there's a big welcome banner at the top — the 'Your day in
> the Texas Hill Country starts here' part. Right now I have to ask a developer
> every time I want to change that wording. I'd like to be able to edit it
> myself. Can you add a page in the admin area where I can change the little
> label, the big headline, the paragraph under it, and the two buttons? And let
> me put a background image behind it too."

That single sentence is enough. Claude will:
- create a place in the database to store the banner,
- build the admin page with a form,
- make the homepage read from it,
- and tell you it needs a "database change" that your developer applies.

### Asking for an image upload (a follow-up feature)
At first the banner image was "paste a link only" — fine if your photo already
lives somewhere online, awkward if it's sitting on your laptop. So the natural
next ask:
> "On the homepage editor, I can only add a background image by pasting a link.
> Can you also let me upload an image straight from my computer — and keep the
> paste-a-link option too? It should make the picture the right size on its own
> so I don't have to worry about getting the dimensions exactly right."

Claude will:
- add an **Upload image** button next to the existing link field (both still
  feed the same picture),
- shrink/clean the photo in your browser before it's sent so it lands at a
  sensible size (you don't resize anything by hand),
- store the uploaded file and put its address into the image field for you,
- and note the new "database change" (a place to keep uploaded images) for your
  developer.

Everyday use afterward:
> "Replace the banner photo — here, let me upload this one."
> "Actually go back to pasting a link; here's the URL."

### Looking at it
> "Show me the homepage so I can see the banner."
> "Now open the admin homepage page so I can try editing it."

### Iterating on the look
> "The headline is too big — can you make it a bit smaller?"
> "Put more space between the two buttons."
> "When I add a background image the text is hard to read — can you darken the
> image a little so white text shows up?"

### Changing the actual content (this is the everyday use, after it ships)
> "Change the headline to 'Your Hill Country weekend starts here.'"
> "Make the first button say 'Book a visit' and point it at the booking page."
> "Hide the second button for now."

### When you're happy
> "This looks great. I'm done — open the pull request so my developer can
> review it."

Claude opens the pull request, and (once the preview finishes building) shares
a **Vercel preview link**. Note: because this feature adds a database change,
the preview may not show the banner correctly until your developer applies that
change — but your **local** site at `http://localhost:3000` always shows it.
Trust the local view.

### If you get stuck
> "Claude says something is blocked — what does that mean?"

That's the safety guardrail. It means the action belongs to your developer (for
example, anything that would touch the real live website or its database).
Claude has already captured it in your pull request. Just keep going.

---

## 2. What a non-engineer is really asking for (the translation)

The point of this example is that **plain-language requests map cleanly onto
real engineering pieces.** You (the client) only write the left column. Claude
produces the right column.

| What you say | What Claude builds |
|---|---|
| "store the banner so I can edit it" | a `homepage_hero` table in the database (a *migration*) |
| "only I / staff should be able to change it" | a security rule: public can read, only admins can write (*RLS policy*) |
| "a page in the admin area to edit it" | `/admin/homepage` + an edit form |
| "the homepage should show what I set" | the homepage reads the row and renders it |
| "let me put an image behind it" | an image-URL field + a darkening overlay so text stays readable |
| "let me upload an image too, not just paste a link" | a file **Upload** button + a public storage bucket to hold uploads (a second *migration*); the browser downscales the file first so it lands at a sensible size |

---

## 3. For the developer — what's in the PR and what you do

### Files (all on `feature/editable-homepage-hero`)

| File | Role |
|---|---|
| `supabase/migrations/20260615120000_homepage_hero.sql` | singleton `homepage_hero` table, RLS (public read / admin write), `updated_at` trigger, seed row with the current copy |
| `supabase/migrations/20260615130000_homepage_image_bucket.sql` | public `homepage-images` storage bucket for uploaded backgrounds (10 MB cap + image MIME allowlist), mirroring `adventure-images` |
| `lib/storage/homepage-image-storage.ts` | thin storage adapter pinned to the `homepage-images` bucket (reuses `createPublicImageStorage`) |
| `src/services/public/homepage-hero.ts` | `getHomepageHero()` read + domain type + safe fallback |
| `src/services/admin/homepage-hero.ts` | `updateHomepageHero()` write + Zod input schema |
| `app/admin/homepage/actions.ts` | thin server actions: save the hero (validate → service → revalidate `/` and `/admin/homepage`) **and** `uploadHomepageHeroImageAction` (admin-gate → service-role upload to `homepage-images` → return public URL) |
| `app/admin/homepage/page.tsx` | admin editor page (fetch → render form) |
| `src/components/admin/homepage-hero-form.tsx` (+ `.module.css`) | the edit form (client component); image field offers **Upload image** (browser downscale via `downscale-image.ts` → `uploadHomepageHeroImageAction`) alongside paste-a-URL — both fill the same field |
| `app/page.tsx` | homepage now reads the hero instead of hardcoding it |
| `src/components/admin/admin-nav.tsx` | adds the "Homepage" nav link |

### How it honors the project rules
- **SOLID / thin pages:** the page fetches via a service and renders; the
  action validates and delegates; the write service does one thing.
- **RLS first:** public `SELECT USING (true)`; admin `FOR ALL` gated on
  `app_metadata.role IN ('super_admin','admin')`, wrapped in `(SELECT …)` for
  the InitPlan. No cross-table references → no policy-cycle risk.
- **Config in DB:** same reasoning as the per-property `properties.tagline`
  added in App 3.9 — operational/marketing copy lives in editable rows, not TS
  constants.
- **No-deploy fallback:** `getHomepageHero()` returns a `FALLBACK_HOMEPAGE_HERO`
  if the row is missing, so the homepage never renders empty.
- **Reuse over new code (Open/Closed):** the image upload adds *no* bespoke
  upload logic — it reuses the existing public-image pipeline
  (`uploadPublicImage` + `createPublicImageStorage` + `downscale-image.ts`,
  already powering adventure/instructor photos), pinned to a new bucket. The
  uploaded URL flows into the same `image_url` field a pasted URL does, so the
  renderer and the read path are untouched.

### Your review + merge runbook (mirrors the standard client-change flow)
1. **Pull the branch**, read the diff.
2. **Apply the migrations locally** to verify them (`npx supabase db reset` —
   this runs both the `homepage_hero` table and the `homepage-images` bucket),
   then open `/admin/homepage`, **upload** a background image *and* paste a URL,
   and confirm both render on the homepage.
3. **Review the RLS by hand** — sign in as a member and confirm you *cannot*
   write the row; as an admin confirm you can. (Project rule: every new RLS
   policy gets an explicit manual test — never rubber-stamp this part.)
4. **Apply the migration to production**, then merge the code. Code + schema go
   live together.

> If you adapt this into a real merged feature later, copy the pattern but give
> it its own branch — leave `feature/editable-homepage-hero` intact as the
> example.
