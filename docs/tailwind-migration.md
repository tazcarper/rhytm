# Tailwind Migration Map

The brand tokens live in `app/globals.css` under `:root` and are bridged
into Tailwind v4's theme via the `@theme inline { … }` block in the same
file. This document is the lookup table for converting existing
CSS-Module / inline-style code into Tailwind utilities.

> **Status:** Phase 1 + 2 complete — Tailwind is wired and the tokens are
> available as utilities. Existing CSS Modules and inline styles are
> still in use. Phases 3–5 will migrate them.

## How to read this table

- The **CSS** column is what you see in existing code (a CSS variable
  reference or a raw style).
- The **Tailwind** column is what to use going forward.
- For colors, the same token is available wherever a color is valid:
  `bg-olive`, `text-olive`, `border-olive`, `outline-olive`,
  `decoration-olive`, `from-olive`, etc.

## Colors — palette

| CSS                       | Tailwind                              |
| ------------------------- | ------------------------------------- |
| `var(--olive)`            | `olive` (e.g. `bg-olive`)             |
| `var(--olive-deep)`       | `olive-deep`                          |
| `var(--olive-darker)`     | `olive-darker`                        |
| `var(--tan)`              | `tan`                                 |
| `var(--tan-deep)`         | `tan-deep`                            |
| `var(--cream)`            | `cream`                               |
| `var(--paper)`            | `paper`                               |
| `var(--paper-warm)`       | `paper-warm`                          |
| `var(--gray)`             | `gray` (overrides Tailwind's default) |
| `var(--gray-light)`       | `gray-light`                          |

> ⚠ `gray` shadows Tailwind's default `gray-*` scale. Use brand `gray`
> for body copy. If you need a neutral ramp, reach for `zinc` /
> `neutral` instead — don't reintroduce `gray-500`.

## Colors — rules & dividers

The two semi-transparent olive shades used for borders and hairlines.

| CSS                        | Tailwind                                      |
| -------------------------- | --------------------------------------------- |
| `var(--border)`            | `rule` (e.g. `border-rule`, `divide-rule`)    |
| `var(--border-strong)`     | `rule-strong`                                 |

## Colors — semantic accents

| CSS                         | Tailwind          |
| --------------------------- | ----------------- |
| `var(--accent-error)`       | `accent-error`    |
| `var(--accent-warn)`        | `accent-warn`     |
| `var(--accent-info)`        | `accent-info`     |
| `var(--accent-success)`     | `accent-success`  |

## Typography — font families

| CSS                  | Tailwind     |
| -------------------- | ------------ |
| `var(--sans)`        | `font-sans`  |
| `var(--serif)`       | `font-serif` |

`font-mono` keeps Tailwind's default and is the right choice for
the existing `style={{ fontFamily: "ui-monospace, Menlo, monospace" }}`
inline cases (admin / member / partner / auth-error pages).

## Typography — type scale

Brand-named sizes override Tailwind's `text-xs … text-9xl` defaults
only where names overlap. They don't — brand names are `eyebrow`,
`micro`, `body`, `body-lg`, `h1`-`h4`, `display`.

| CSS                          | Tailwind         |
| ---------------------------- | ---------------- |
| `var(--text-eyebrow)` (11px) | `text-eyebrow`   |
| `var(--text-micro)`   (12px) | `text-micro`     |
| `var(--text-body)`    (15px) | `text-body`      |
| `var(--text-body-lg)` (17px) | `text-body-lg`   |
| `var(--text-h4)`      (19px) | `text-h4`        |
| `var(--text-h3)`      (24px) | `text-h3`        |
| `var(--text-h2)`      (36px) | `text-h2`        |
| `var(--text-h1)`      (52px) | `text-h1`        |
| `var(--text-display)`        | `text-display`   |

## Typography — line height

| CSS                       | Tailwind        |
| ------------------------- | --------------- |
| `var(--leading-tight)`    | `leading-tight` |
| `var(--leading-snug)`     | `leading-snug`  |
| `var(--leading-body)`     | `leading-body`  |

## Typography — letter spacing

Brand `tracking-*` is in **pixels**, not em — values come straight from
the design reference and shouldn't be reinterpreted.

| CSS                          | Tailwind          |
| ---------------------------- | ----------------- |
| `var(--track-eyebrow)` (3px) | `tracking-eyebrow` |
| `var(--track-button)`  (2.5) | `tracking-button`  |
| `var(--track-label)`   (1.5) | `tracking-label`   |
| `var(--track-display)` (-.5) | `tracking-display` |

## Spacing

**No bridge needed.** Brand `--space-1 … --space-24` match Tailwind's
default `0.25rem * N` scale exactly. Just use Tailwind's spacing utilities:

| CSS                      | Tailwind                           |
| ------------------------ | ---------------------------------- |
| `var(--space-1)` (4px)   | `p-1` / `m-1` / `gap-1`            |
| `var(--space-2)` (8px)   | `p-2` …                            |
| `var(--space-4)` (1rem)  | `p-4`                              |
| `var(--space-6)` (1.5)   | `p-6`                              |
| `var(--space-8)` (2rem)  | `p-8`                              |
| `var(--space-12)` (3rem) | `p-12`                             |
| `var(--space-24)` (6rem) | `p-24`                             |

## Radius

| CSS                       | Tailwind        |
| ------------------------- | --------------- |
| `var(--radius-sharp)`     | `rounded-sharp` |
| `var(--radius-card)`      | `rounded-card`  |
| `var(--radius-pill)`      | `rounded-pill`  |

## Shadow

| CSS                    | Tailwind       |
| ---------------------- | -------------- |
| `var(--shadow-soft)`   | `shadow-soft`  |
| `var(--shadow-lift)`   | `shadow-lift`  |

## Motion

| CSS                            | Tailwind         |
| ------------------------------ | ---------------- |
| `var(--transition-fast)` 150ms | `duration-fast`  |
| `var(--transition-base)` 240ms | `duration-base`  |
| `var(--transition-slow)` 360ms | `duration-slow`  |

Tailwind's default easing (`ease`) matches brand. Use `ease-out`,
`ease-in-out`, etc. as needed — no custom token.

## Layout maxes

| CSS                       | Tailwind         |
| ------------------------- | ---------------- |
| `var(--content-max)`      | `max-w-content`  |
| `var(--content-narrow)`   | `max-w-narrow`   |
| `var(--content-prose)`    | `max-w-prose` (overrides Tailwind default 65ch) |

## Patterns that don't get utilities yet

These show up in `app/home.module.css` and are decorative one-offs.
Phase 5 will extract them as Tailwind v4 `@utility` rules in
`globals.css` so the markup stays clean. Until then, leave them in the
CSS Module.

- The radial dot-pattern overlay (`.hero::before` and `.manifesto::before`).
- The eyebrow with tan bullets (`.heroEstablished::before/::after`).
- The cycling-property letter cascade animation (`login.module.css`).

## Conventions for new code

- Reach for brand utilities (`bg-olive`, `text-tan-deep`) — never
  arbitrary values like `bg-[#3f4a21]` when a token exists.
- For variant-driven primitives, use `tailwind-variants` (already
  installed). One variant table per primitive, co-located in the same
  file as the component.
- No `@apply` chains in standalone CSS files. If a pattern recurs,
  promote it to a `@utility` in `globals.css`.
- No new `*.module.css` in `app/` or `lib/ui/primitives/` — guardrail
  to be added in Phase 6.
