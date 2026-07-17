# Headless CMS Evaluation — Should Rhythm Outdoors Adopt One?

**Date:** 2026-07-08 · **Trigger:** post-dashboard-redesign question — could parts of the site
(homepage copy, property/event descriptions, reusable promotions) benefit from a CMS?
**Verdict up front: No hosted/headless CMS now. Extend the existing admin instead — and
build a small, reusable Promotions content type, which is the one genuinely new need.**

Companion docs: [`dashboard-redesign-research.md`](./dashboard-redesign-research.md),
[`dashboard-redesign-plan.md`](./dashboard-redesign-plan.md).

---

## Part A — What we actually have (content inventory)

**Already database-managed and editable in `/admin` (a bespoke CMS in all but name):**

| Content | Where it's edited |
|---|---|
| Homepage hero (title, copy, CTAs, image) | `/admin/homepage` |
| Property tagline, directions, parking, arrival contact, support email/phone, hours, booking rules | `/admin/properties/[id]` (Basics) |
| Experiences, add-ons, catering — names, descriptions, pricing | `/admin/properties/[id]` (catalog tabs) |
| Adventures / events — rich-text description, chapters, galleries, highlights, pricing, visibility | `/admin/adventures` |
| FAQ & gear lists | `/admin/templates` |
| Waiver wording (per property, versioned) | `/admin/settings/waivers` |
| Instructor profiles & photos | `/admin/instructors` |

**Hardcoded today (the real gaps):**
- Homepage editorial sections beyond the hero — the "Why Rhythm" manifesto pullquote, the
  Member Adventures / How-It-Works section headers + decks, the 5 how-it-works steps, and
  the final CTA block (`app/page.tsx`).
- Long-form public **property descriptions** — properties have a 500-char tagline, but no
  rich "about this property" body.
- **Promotions / sales events** — no model at all. Nothing supports "run this seasonal
  promo again," scheduling a start/end window, or placing the same promo on multiple pages.
- Static HTML guides (`public/guide*.html`) and release notes (TS constants) — both
  developer-authored artifacts about the software; appropriate as code, not CMS material.

## Part B — Market research (full report)

The complete cited research is preserved below in §Research Report. Headlines:

1. **2025–26 consolidated the market via acquisitions**: Figma acquired Payload (June 2025);
   Salesforce signed to acquire Contentful (~$1B, June 2026). Roadmap risk now sits on two
   of the top five vendors.
2. **Payload** stays MIT/open-source and is the "Next.js-native" pick (installs into your
   own app, Postgres adapter, ~$0 cash cost self-hosted) — but it brings a **second
   migration system (Drizzle) alongside `supabase/migrations`**, its own auth/permissions
   layer outside RLS, and a dev-mode `push` that is dangerous against a linked cloud
   Supabase (our exact workflow).
3. **Sanity** free tier fits 2 editors (10k documents) with best-in-class visual editing;
   its documented failure mode is cost creep at scale we may never reach.
4. **The build-vs-buy literature converges**: buy when you have *no* admin; extend when you
   already have one. Our expensive parts — auth, roles, RLS, CRUD, guardrails, the client's
   editing workflow — are sunk cost, already built.
5. **The #1 documented failure mode** of bolting a CMS onto an app with an operational
   database is the dual source of truth: cross-system joins in app code, no foreign keys
   across the boundary, sync drift, duplicated auth, webhook→ISR rebuild plumbing. Our
   "content" is unusually operational (experience pricing → bid line-item snapshots, waiver
   text → signatures, instructors → booking constraints), which makes the split maximally
   painful here.

## Part C — Recommendation

### 1. Do not adopt a headless CMS for existing content

Everything the client edits today is coupled to bookings, bids, pricing, or signatures.
Moving any of it into a CMS re-creates it as a second source of truth and forfeits RLS
auditability, the `dashboard-content-guard` protections, and single-migration-history
simplicity — for a 2-editor team whose publishing cadence is low. Cash cost of a CMS is
near zero; the integration and dual-truth tax is the real price, and it buys features
(review workflows, multi-editor collaboration) we wouldn't exercise.

### 2. Close the three named gaps inside the existing admin (config-in-DB pattern)

1. **Homepage sections** — promote the hardcoded editorial blocks into the DB following
   the existing homepage-hero precedent: a `homepage_sections` (or extended
   `homepage_hero`) model with the manifesto quote, section eyebrows/headlines/decks, and
   how-it-works steps; edited on `/admin/homepage`. One migration + form extension.
2. **Property descriptions** — add a rich-text `description` column to `properties`,
   surface it in the Basics form and on the public property page. Smallest of the three.
3. **Promotions (the genuinely new capability)** — a `promotions` table + admin page:
   - Fields: title, body (rich text), image, CTA label + href, property scope
     (one/many/all), placement slots (homepage band, property page, adventures page),
     `starts_at` / `ends_at` scheduling, `status` (draft/published/archived).
   - **Reusable by design**: archived promos keep their content; "run it again" = duplicate
     or re-window, which is exactly the reuse behavior a CMS would provide.
   - RLS like every other admin-managed table; rendered by public pages that simply query
     "active promos for this placement + property + now".
   - Brand note: presentation must stay in the estate register — a promotion is a seasonal
     *feature*, not an OTA urgency banner (no countdowns/scarcity per PRODUCT/DESIGN).

Each item is the standard build-a-feature shape (migration + RLS + service + admin form +
public render). Rough order: property description < homepage sections < promotions.

### 3. The one future scenario where a CMS earns its place

If a genuinely decoupled marketing program emerges — a blog/journal, SEO landing pages,
email-content reuse — put *that isolated surface* (and only it) on Sanity's free tier or a
Payload instance confined to its own Postgres schema. Never migrate the operational
content. Revisit trigger: a real publishing cadence (weekly+) or a second dedicated
content editor.

---

## Research Report (agent output, 2026-07-08, sources inline)

### Executive summary
1. **The market consolidated hard in 2025–26 via acquisitions.** Figma acquired Payload (June 17, 2025 — [figma.com/blog/payload-joins-figma](https://www.figma.com/blog/payload-joins-figma/), [payloadcms.com/posts/blog/payload-is-joining-figma](https://payloadcms.com/posts/blog/payload-is-joining-figma)) and Salesforce signed a definitive agreement to acquire Contentful (~$1B, announced June 1, 2026, closing Q3 FY2027 — [salesforce.com/news](https://www.salesforce.com/news/stories/salesforce-signs-definitive-agreement-to-acquire-contentful/)). Both deals reorient the acquired products toward the acquirer's platform, adding roadmap uncertainty for independent users.
2. **Payload remains open source (MIT) post-acquisition and is the consensus "Next.js-native" pick**, but Payload Cloud paused new sign-ups, so self-hosting (Vercel works fine) is the only path for new projects ([techsy.io](https://techsy.io/en/blog/payload-cms-guide), [pemedia.de](https://pemedia.de/en/figma-acquires-payload-cms/)).
3. **Payload can share a Supabase Postgres database.** Its `@payloadcms/db-postgres` adapter (Drizzle + node-postgres) supports an experimental `schemaName` option and a documented pattern for coexisting with existing tables — but Payload owns and migrates its schema, a real hazard next to RLS-governed operational tables ([payloadcms.com/docs/database/postgres](https://payloadcms.com/docs/database/postgres)).
4. **For a 2-editor team, every major option is cheap or free at entry**: Sanity Free (2 non-admin users, 10k documents) or Growth ~$15/seat/mo ([sanity.io/pricing](https://www.sanity.io/pricing)); Storyblok free Starter (2 seats), paid from €99/mo ([storyblok.com/pricing](https://www.storyblok.com/pricing)); Strapi Cloud from $18/mo ([strapi.io/pricing-cloud](https://strapi.io/pricing-cloud)); Contentful free tier then a ~$300/mo cliff ([contentful.com/pricing](https://www.contentful.com/pricing/)); Payload/Keystatic $0 license. The real cost is integration and dual-system maintenance, not sticker price.
5. **Sanity's known failure mode is cost creep past the free tier**: hard 10k/25k document caps, +$299/mo quota add-ons, $999/mo per extra dataset, SSO pushing bills past $1,300/mo ([robotostudio.com](https://robotostudio.com/blog/sanity-cms-pricing-which-plan-is-right-for-you), [costbench.com](https://costbench.com/software/headless-cms/sanity/)).
6. **The strongest evidence-based argument against adopting a CMS here is the dual-source-of-truth tax.** Flashboard's "Don't use a Headless CMS; use your database instead" documents compounding costs: every feature forces a "CMS or DB?" decision, cross-system joins in app code, no foreign keys across the boundary, two query languages — and reports only 1 of ~12 headless-CMS projects succeeded long-term ([getflashboard.com](https://www.getflashboard.com/blog/dont-use-a-headless-cms-use-your-database-instead)).
7. **The strongest counterargument is editor-experience velocity**: real-time visual editing/live preview (Sanity Presentation + `next-sanity/live` — [sanity.io docs](https://www.sanity.io/docs/visual-editing/visual-editing-with-next-js-app-router)), image pipelines, and content references — capabilities a custom admin accretes slowly ("Give it six months. The bespoke tooling will grow." — vendor-authored: [sanity.io/blog/you-should-never-build-a-cms](https://www.sanity.io/blog/you-should-never-build-a-cms)).
8. **Bottom line:** the build-vs-buy literature converges on *buy when you have no admin; extend when you already have one*. Rhythm already has the expensive part built, and most of its "content" is operationally coupled. The defensible CMS-shaped gaps — rich-text ergonomics, image pipeline, preview — are addressable as targeted upgrades inside the existing admin.

### 1. The 2025–2026 landscape

By 2026 the category settled into niches: Contentful and Storyblok own the managed/marketer end, Sanity the structured-content middle, Payload/Strapi/Directus the self-hosted open-source corner ([pooya.blog comparison](https://pooya.blog/blog/contentful-vs-sanity-vs-strapi-comparison-2026/), [focusreactive.com](https://focusreactive.com/choosing-a-headless-cms/)). Dominant 2026 theme: AI/agent integration (Sanity "Content Operating System," Strapi/Payload MCP servers) ([dev.to 2026 comparison](https://dev.to/pooyagolchian/headless-cms-2026-contentful-vs-strapi-vs-sanity-vs-payload-compared-5bi3)).

| Vendor | Status mid-2026 | 2-editor price |
|---|---|---|
| **Payload** | Gaining with Next.js devs; MIT under Figma; Cloud closed to new sign-ups ([figma.com blog](https://www.figma.com/blog/payload-joins-figma/)) | $0 license; infra only |
| **Sanity** | Holding/gaining; strongest visual editing | Free (2 seats) or ~$15/seat/mo ([pricing](https://www.sanity.io/pricing)) |
| **Contentful** | Enterprise-consolidating; Salesforce acquisition pending | Free tier; ~$300/mo cliff ([costbench](https://costbench.com/software/headless-cms/contentful/)) |
| **Strapi 5** | Default self-host OSS; paid gating of History/Workflows/SSO ([pricing](https://strapi.io/pricing-cms)) | Self-host free; Cloud $18/mo |
| **Directus** | Data-first, sits on existing SQL; BSL (free < $5M revenue) ([elmapicms survey](https://elmapicms.com/mp/headless-cms-pricing)) | $0 self-host |
| **Storyblok** | Gaining with marketers; fastest CDN API | Free Starter (2 seats); €99/mo Growth ([pricing](https://www.storyblok.com/pricing)) |
| **TinaCMS** | Maintenance-momentum questions ([GH discussion](https://github.com/tinacms/tinacms/discussions/4417)); git-based | Free / $29/mo |
| **Keystatic** | Thinkmill, MIT, git/file-based, no visual editing ([github](https://github.com/Thinkmill/keystatic)) | $0 |

Git-based options (Keystatic/Tina) fit poorly here: the content is relational, operationally coupled, and edited by a non-technical client.

### 2. Payload deep dive
- Acquired by Figma June 17, 2025; OSS continues; Cloud paused; team building "Figma CMS" ([cmswire analysis](https://www.cmswire.com/digital-experience/when-cms-meets-ux-design-what-figmas-payload-deal-really-means/)).
- Payload 3 installs into your existing Next.js app (admin UI at a configurable route — the default collides with our `/admin`); APIs are route handlers; runs on Vercel ([deployment docs](https://payloadcms.com/docs/production/deployment)).
- Postgres adapter on Drizzle; dev-mode **`push: true` auto-syncs schema — Supabase guides explicitly warn it can drop tables on a linked cloud DB** ([Payload+Supabase guide](https://payloadcms.com/posts/guides/setting-up-payload-with-supabase-for-your-nextjs-app-a-step-by-step-guide)); production = Drizzle migrations, a second migration system alongside `supabase/migrations`; `schemaName` (experimental) isolates it in its own schema; no RLS — Payload connects privileged and enforces its own access layer ([postgres docs](https://payloadcms.com/docs/database/postgres)).
- TCO self-hosted: ≈$0–20/mo cash on existing Vercel/Supabase/Blob/Resend; real cost is version upkeep + dual migrations + a second admin UI.

### 3. Sanity deep dive
- Free tier 2026: 2 non-admin users, 2 datasets, 10k documents, 500k CDN requests/mo, 10 GB bandwidth, 20 GB assets; no scheduled publishing/custom roles ([pricing](https://www.sanity.io/pricing), [robotostudio breakdown](https://robotostudio.com/blog/sanity-cms-pricing-which-plan-is-right-for-you)). Growth ~$15/seat/mo ($12 annual), hard 25k-document cap ([costbench](https://costbench.com/software/headless-cms/sanity/)).
- Visual editing is best-in-class and App Router-native (Presentation tool, `next-sanity/live`, stega click-to-edit) ([docs](https://www.sanity.io/docs/visual-editing/visual-editing-with-next-js-app-router), [focusreactive review](https://focusreactive.com/sanity-visual-editing-review/)). Portable Text maps cleanly to React renderers.
- Cost-creep complaints are extensively documented (200+ community reports aggregated — [checkthat.ai](https://checkthat.ai/brands/sanity/pricing); mechanics at [costbench](https://costbench.com/software/headless-cms/sanity/), [toolradar](https://toolradar.com/tools/sanity/pricing); Sanity's own billing-surprises thread: [sanity.io/answers](https://www.sanity.io/answers/discussion-about-estimating-billing-and-preventing-surprise-charges-with-vercel-and-sanity-hosting-services)). At our scale the risk stays theoretical for years.

### 4. When a CMS is worth it vs. not
**Against (given an existing custom admin):** Flashboard's database-instead argument (dual truth compounds; joins in app code; no cross-system FKs; 1-of-12 success anecdote) ([getflashboard.com](https://www.getflashboard.com/blog/dont-use-a-headless-cms-use-your-database-instead)); Viget's build-vs-buy for small sites ([viget.com](https://www.viget.com/articles/cms-solutions-custom-built-on-a-framework-versus-off-the-shelf/)); integration-architecture guidance that the CMS is "a content source, not the system of truth" ([conceptrecall.com](https://conceptrecall.com/headless-cms-integration/)). The classic pro-CMS "months to build" argument ([hygraph.com](https://hygraph.com/blog/why-to-not-build-your-own-cms)) targets teams without an admin — sunk cost here.
**For (honest counterarguments):** preview/scheduled-publish workflows; asset pipelines (crops/focal points/CDN); content-modeling velocity (config vs. migration+RLS+form); studio-grade editor UX, collaboration, revision history ([sanity.io/blog/you-should-never-build-a-cms](https://www.sanity.io/blog/you-should-never-build-a-cms) — vendor-authored but fair on maintenance growth).

### 5. Failure modes of CMS + operational database
1. **Dual source of truth / boundary erosion** — pricing feeds bid snapshots, waiver text feeds signatures, instructors feed booking constraints; sync jobs or HTTP joins are the documented core failure ([getflashboard](https://www.getflashboard.com/blog/dont-use-a-headless-cms-use-your-database-instead)).
2. **Referential-integrity gap** — CMS-side slug renames/deletes break DB references at render time.
3. **Auth duplication** — Supabase Auth + RLS for the app plus the CMS's separate identity/role model; our 5-role middleware allowlists would need mirroring.
4. **Webhook → ISR plumbing on Vercel** — HMAC verification, content-type→route mapping, exact-path revalidation, Router-Cache staleness bugs ([nextjs ISR guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration), [next.js discussion #81243](https://github.com/vercel/next.js/discussions/81243), [HMAC wiring writeup](https://dev.to/nayankyada/how-i-wire-sanity-webhooks-to-nextjs-isr-revalidation-with-hmac-verification-1m3a)). DB-backed reads need none of this.
5. **Migration bifurcation (Payload)** — Drizzle migrations beside `supabase/migrations`; dev `push` against a linked cloud DB is a live foot-gun given our `db push` workflow; `dashboard-content-guard` and RLS-audit discipline don't extend into Payload-owned tables.
6. **Vendor/roadmap risk absorbed twice** — 2025–26 proved category leaders get acquired and re-pointed.

### Decision framework
**Adopt a CMS when:** content volume/velocity outgrows the team (multiple editors, weekly+ publishing, drafts/scheduling/review); content is presentational and decoupled from operations; multi-channel API distribution; no existing admin.
**Extend your admin when (matches this project):** admin/auth/RLS/guardrails already exist; content is operationally coupled; 1–2 editors with an alternative editing path; database-as-source-of-truth is an architectural rule; publishing cadence is low.
**Middle path:** add CMS-grade capabilities as targeted upgrades in the admin — structured rich text (Tiptap/ProseMirror JSON), draft/published + preview on the few tables needing staging, focal-point/crop metadata on Blob images. If a decoupled marketing/blog surface emerges later, put only that on Sanity free tier or Payload in its own schema.
