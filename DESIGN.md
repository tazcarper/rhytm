---
name: Rhythm Outdoors
description: One booking platform for three outdoor sporting clubs — refined-heritage, olive-and-tan, every inquiry ends as a signed bid.
colors:
  olive: "#3f4a21"
  olive-deep: "#2a3216"
  olive-darker: "#1f2611"
  tan: "#b89c73"
  tan-deep: "#9a8159"
  cream: "#e8e4d5"
  paper: "#fbfaf3"
  paper-warm: "#f5f1e5"
  gray: "#6b6557"
  gray-light: "#d4cebe"
  border: "#3f4a2126"
  border-strong: "#3f4a2147"
  accent-error: "#8b3030"
  accent-warn: "#8c5e0f"
  accent-info: "#2f5482"
  accent-success: "#2d5520"
typography:
  display:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "clamp(52px, 7vw, 84px)"
    fontWeight: 600
    lineHeight: 0.95
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "clamp(48px, 6vw, 72px)"
    fontWeight: 600
    lineHeight: 0.95
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "3px"
rounded:
  sharp: "2px"
  card: "3px"
  pill: "100px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
  "16": "64px"
components:
  button-primary:
    backgroundColor: "{colors.olive}"
    textColor: "{colors.cream}"
    typography: "{typography.label}"
    rounded: "{rounded.sharp}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.olive-deep}"
    textColor: "{colors.cream}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.olive}"
    rounded: "{rounded.sharp}"
    padding: "12px 20px"
  button-secondary-hover:
    backgroundColor: "{colors.paper-warm}"
    textColor: "{colors.olive}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.tan-deep}"
    rounded: "{rounded.sharp}"
    padding: "12px 20px"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.olive}"
    rounded: "{rounded.card}"
    padding: "24px"
  input:
    backgroundColor: "{colors.paper-warm}"
    textColor: "{colors.olive}"
    rounded: "{rounded.sharp}"
    padding: "12px 14px"
  input-focus:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.olive}"
  badge:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.olive}"
    typography: "{typography.label}"
    rounded: "{rounded.sharp}"
    padding: "4px 9px"
---

# Design System: Rhythm Outdoors

## 1. Overview

**Creative North Star: "The Sporting Estate"**

Rhythm Outdoors looks like a well-kept private land-and-lodge tradition rendered for
the screen: olive fields, tan leather, cream correspondence. The surface is the warm
near-white of good paper; the ink is a deep field olive; the single ornament is a
worn-leather tan. Serif headings carry the cadence of an engraved nameplate, and the
sans body reads like a clean typed entry beneath it. Nothing shouts. The authority
comes from restraint and from the sense that every detail has been looked after — the
same calm confidence a guest needs before handing over a deposit, and the same quiet
order a staff member needs to run three clubs from one screen.

This is a **product-register** system at its core (the admin dashboard, booking
funnel, and member/partner portals are working surfaces where the tool disappears
into the task), but the guest-facing public site and the bid page are conversion
surfaces where the same materials are allowed to breathe more — bigger serif,
more air, the experience doing the persuading.

The system **explicitly rejects** four things, carried straight from PRODUCT.md:
the gray-card sameness of a **generic SaaS dashboard**; the urgency theater of a
**loud OTA booking site** (countdowns, "3 left!" badges, discount confetti); the
focus-grouped, stock-photo blandness of a **corporate hotel chain**; and the purple
gradients, glassmorphism, and hero-metric templates of a **trendy AI startup**.
Restraint reads as more premium than effects.

**Key Characteristics:**
- Warm-paper canvas (`#fbfaf3`), deep-olive ink (`#3f4a21`), tan (`#9a8159`) as the one accent.
- Cormorant Garamond serif for headings (with an italic tan emphasis); Inter for everything that does work.
- Near-square corners (2–3px) — engraved, not bubbly.
- Soft, olive-tinted elevation; flat by default, lift on intent.
- Uppercase, widely-tracked sans labels and eyebrows as the "engraved nameplate" voice.
- Quiet by default; the bid page and public hero are where the system is allowed to open up.

## 2. Colors

A warm, earthen palette: a single field-olive ink and a single leather-tan accent, both sitting on warm paper, with a tightly-scoped semantic set for state.

### Primary
- **Field Olive** (`#3f4a21`): The defining color and the default ink. Body text, headings, primary-button fill, the brand's whole sense of grounded authority. Its darker shades **Olive Deep** (`#2a3216`, primary-button hover) and **Olive Darker** (`#1f2611`, shadow tint, deepest surfaces) extend it without introducing a new hue.

### Secondary
- **Leather Tan** (`#9a8159`, `tan-deep`): The one accent. Links, eyebrows, the required-field marker, the focus-ring outline, the rule beneath section titles, italic heading emphasis. Its lighter sibling **Tan** (`#b89c73`) carries softer touches (the 36px underline, hover tints at low alpha).

### Neutral
- **Paper** (`#fbfaf3`): The default page surface. Warm near-white, never clinical white.
- **Paper Warm** (`#f5f1e5`): The second surface layer — input fills, secondary-button base, panels that need to sit *on* paper.
- **Cream** (`#e8e4d5`): On-olive text (primary-button label) and warm fills; the readable counter to deep olive.
- **Stone Gray** (`#6b6557`): Muted text — captions, helper text, labels, placeholders. **Use with care:** on Paper it sits near the 4.5:1 floor; for body copy prefer Olive.
- **Gray Light** (`#d4cebe`): Disabled text, faint dividers.
- **Olive Rule** (`#3f4a2126` / `#3f4a2147`): Borders and dividers are semi-transparent olive, never neutral gray — the line belongs to the brand's own hue.

### Tertiary (semantic state only — not decoration)
- **Claret Error** (`#8b3030`), **Ochre Warn** (`#8c5e0f`), **Slate Info** (`#2f5482`), **Moss Success** (`#2d5520`): status text and alert framing. Each is paired with text and an icon — never color alone.

### Named Rules
**The One Accent Rule.** Tan is the *only* accent. It earns attention by scarcity — links, focus, eyebrows, a single hairline rule. The moment a second decorative hue appears, the estate starts to look like a brochure.

**The Olive-Line Rule.** Every border and divider is semi-transparent olive (`rgba(63,74,33,…)`), not gray. Lines belong to the brand's hue; a neutral-gray border is a tell that a component skipped the system.

## 3. Typography

**Display / Heading Font:** Cormorant Garamond (with Georgia, serif fallback) — weights 500/600, italics available.
**Body / UI Font:** Inter (with -apple-system, BlinkMacSystemFont fallback) — weights 400/500/600.

**Character:** A high-contrast pairing on a deliberate axis — a humanist old-style serif against a neutral grotesque sans. The serif is the engraved nameplate (calm, traditional, a little literary in its italic); the sans is the typed record beneath it (precise, legible, quiet). They never compete because they never overlap in role.

### Hierarchy
- **Display** (Cormorant 600, `clamp(52px, 7vw, 84px)`, line-height 0.95, tracking −0.03em): The public hero and bid-page opener only. The one place the system raises its voice.
- **Headline / H1** (Cormorant 600, `clamp(48px, 6vw, 72px)`, line-height 0.95, tracking −0.02em): Page titles. Italic `<em>` renders in Leather Tan for editorial emphasis.
- **Title / H2–H4** (Cormorant 600, 36px / 24px / 19px, line-height ~1.15): Section and card titles. H2 may carry the 36px tan underline.
- **Body** (Inter 400, 15px, line-height 1.6): Default reading text in Olive. Cap prose at **65–75ch**.
- **Lead** (Cormorant *italic* 500, 18px, Stone Gray): Intro/standfirst paragraphs — the serif voice carrying a sentence of warmth before the sans takes over.
- **Label / Eyebrow** (Inter 600, 11px, tracking 3px, UPPERCASE, Leather Tan): Form labels, kickers, the "nameplate" microtype. Buttons use the same family at tracking 2.5px.

### Named Rules
**The Serif-Speaks Rule.** Serif is for headings, the lead paragraph, and italic emphasis — never for UI controls, labels, data, or buttons. A display face in a button label is forbidden.

**The Italic-Tan Rule.** Emphasis inside a heading is `<em>` rendered italic in Tan, not bold and not a color swap on the whole line. One word leans in; the rest holds the olive.

## 4. Elevation

Flat by default; depth is an intentional, soft response, never a decorative drop-shadow. Shadows are tinted with the deepest olive (`rgba(31,38,17,…)`) so even elevation belongs to the palette. Two ambient levels only — there is no busy z-stack of glows.

### Shadow Vocabulary
- **Soft** (`box-shadow: 0 1px 2px rgba(31,38,17,0.04), 0 8px 24px rgba(31,38,17,0.06)`): Resting elevation for cards and panels — a barely-there lift off the paper.
- **Lift** (`box-shadow: 0 1px 2px rgba(31,38,17,0.06), 0 16px 48px rgba(31,38,17,0.12)`): Hover/active and pulled-forward surfaces. Pairs with a `translateY(-2px)` on hoverable cards and a faint tan border.

### Named Rules
**The Flat-Paper Rule.** Surfaces rest flat on the paper. The Lift shadow appears only as a response to state (hover, focus, deliberate emphasis) — if everything is lifted, nothing is.

**The Olive-Shadow Rule.** Shadows are tinted olive-black, never neutral `rgba(0,0,0,…)`. A pure-black shadow on warm paper reads cold and off-system.

## 5. Components

The vocabulary is consistent edge to edge: near-square corners, sans uppercase microtype, olive ink, tan accent, one shadow language. Same button shape, same control feel, in the admin as on the bid page.

### Buttons
- **Shape:** Near-square (`2px` radius), uppercase Inter 600 with letter-spacing; sizes adjust padding (`sm` 8×14, `md` 12×20, `lg` 14×24).
- **Primary:** Olive fill, Cream label. Hover → Olive Deep.
- **Secondary:** Paper fill, Olive text, strong olive border; *sentence case* and lighter tracking (it intentionally reads quieter than primary). Hover → Paper Warm fill + Tan border.
- **Ghost:** Transparent, Tan text; hover tints a faint tan wash and shifts text to Olive.
- **Link:** Underlined Tan microtype (uppercase, 4px underline offset).
- **Focus:** `2px` solid Tan outline, `2px` offset — on every variant. **Disabled:** 0.5 opacity, `not-allowed`. **Loading:** trailing spinner (suppressed under reduced-motion).

### Cards / Containers
- **Corner Style:** `3px` radius (slightly softer than buttons/inputs, still squared).
- **Background:** Paper (or Paper Warm via `warm`). Olive hairline border.
- **Shadow Strategy:** Soft at rest (`flat` removes it; `lift` raises it); `hoverable` animates to Lift with a −2px translate.
- **Internal Padding:** 24px default (`padTight` 16px, `padLoose` 40×32). **Never nest a card inside a card.**

### Inputs / Fields
- **Style:** Paper Warm fill, strong-olive border, `2px` radius, 12×14 padding, Olive text.
- **Focus:** Border shifts to Tan and fill brightens to Paper — a calm two-property shift, no glow.
- **Invalid:** Claret border + faint claret wash; error text is Inter italic micro in Claret.
- **Field frame:** Uppercase Stone-Gray label (tan required-marker), micro helper text, italic error line.

### Badges / Status
- **Style:** Uppercase micro (9.5px), `2px` radius (or `pill`), tinted background at low alpha with a matching darker text — booking/adventure states (open/filling/waitlist/full/past/draft) and membership tiers (founder/charter/member/legacy) each get a named tint.
- **Rule:** State color is always backed by the state's *word*, never the swatch alone.

### Alerts
- Full bordered box, tinted by severity (error/warn/info/success), uppercase micro title in the severity color, olive body. Soft entrance animation (disabled under reduced-motion). One heavier edge is part of the existing pattern — but on cards and list items, see the Don'ts.

### Eyebrow (signature microtype)
- The "nameplate" kicker: uppercase Inter 600, 11px, 3px tracking, Tan. A `crest` variant uses serif with `·` flankers for formal headers. This is a **deliberate, named system element** — not a generic per-section eyebrow.

### Navigation
- Quiet sans, Olive ink, Tan for the active/hover state; olive hairline dividers. Sticky header composes per-page (no forced global `<main>`). Dropdowns must escape clipping (`<dialog>`/popover/fixed/portal), never `position:absolute` inside an `overflow` container.

## 6. Do's and Don'ts

### Do:
- **Do** keep Tan as the single accent (**The One Accent Rule**) — links, focus, eyebrows, one hairline. Scarcity is the point.
- **Do** draw every border and divider in semi-transparent **olive**, never neutral gray (**The Olive-Line Rule**).
- **Do** reserve Cormorant for headings, the lead paragraph, and italic emphasis; everything functional is Inter (**The Serif-Speaks Rule**).
- **Do** keep surfaces flat on the paper and raise the Lift shadow only on state (**The Flat-Paper Rule**); tint shadows olive-black.
- **Do** verify contrast: body text ≥ 4.5:1. Stone Gray (`#6b6557`) on Paper sits near the floor — use Olive for body and reserve Gray for genuinely secondary micro text; placeholders must still clear 4.5:1.
- **Do** pair every status color with its word and/or an icon (booking states, alerts) — never encode meaning in color alone.
- **Do** honor `prefers-reduced-motion`: the global baseline near-zeroes animation; opt a critical entrance back in only as a fade/crossfade.
- **Do** let the public hero and bid page open up (bigger serif, more air); keep admin and funnel dense and quiet.

### Don't:
- **Don't** build a **generic SaaS dashboard** — no gray-card sameness, no identical icon-heading-text grids repeated down a page. Even the admin keeps the estate's point of view.
- **Don't** ship a **loud OTA booking site** — no countdown timers, "only 3 left!" badges, discount confetti, manufactured scarcity, or hard-sell banners. Price is set deliberately and presented with confidence.
- **Don't** drift into **corporate hotel chain** blandness — no sterile, focus-grouped, stock-photo filler with no opinion.
- **Don't** reach for the **trendy AI-startup** kit — no purple gradients, no glassmorphism, no `background-clip:text` gradient text, no big-number hero-metric template.
- **Don't** use a colored `border-left`/`border-right` greater than 1px as a side-stripe accent on cards, list items, or callouts. (The alert's heavier edge is the one sanctioned exception, inside a fully-bordered box — do not propagate the pattern elsewhere.)
- **Don't** put a display/serif face on UI controls, labels, data, or buttons.
- **Don't** use pure-white surfaces or `rgba(0,0,0,…)` shadows — both read cold against warm paper.
- **Don't** nest cards, and don't render dropdowns with `position:absolute` inside an `overflow:hidden/auto` container (they clip).
