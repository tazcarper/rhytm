# Design System — Overview

> Goal: extract the editorial / private-club visual language already in
> `app/login/login.module.css` and the `docs/reference/` HTML mocks into
> a small set of named, reusable primitives. Every portal (member,
> partner, admin, public) draws from the same set.

## Why this approach

The reference mocks are bespoke — Cormorant Garamond + Inter, olive /
tan / paper palette, 2–3px corners, eyebrow labels, soft shadows,
italic serif emphasis. A general-purpose component library (MUI,
Chakra, Mantine) ships with the opposite of that and we'd spend more
time fighting defaults than writing components ourselves.

Two alternatives were considered:

- **shadcn/ui** — assumes Tailwind. We're on CSS Modules + CSS custom
  properties. Switching would mean rewriting the existing login surface
  and importing a styling system we don't otherwise need.
- **Radix Primitives** (this plan) — headless behavior only. Pairs
  with our existing CSS Modules + tokens. Gives us accessibility,
  keyboard nav, focus management, ARIA — nothing visual.

Radix Primitives wins. We own every line of visual code, the
abstraction surface is minimal, and the SOLID-D dependency-inversion
posture is intact: components depend on `:root` tokens, not on a
theme provider.

## Folder layout

```
lib/ui/
├── utils/
│   └── cn.ts                  # 6-line className joiner; no clsx dep
├── primitives/                # leaf components
│   ├── button/
│   │   ├── button.tsx
│   │   ├── button.module.css
│   │   └── index.ts
│   ├── input/
│   ├── textarea/
│   ├── form-field/
│   ├── eyebrow/
│   ├── heading/
│   ├── card/
│   ├── divider/
│   ├── alert/
│   ├── badge/
│   ├── page-shell/
│   └── ...
└── index.ts                   # barrel — only export from here
```

Callers import from `@/lib/ui` only. Sub-paths are an internal
implementation detail.

## Token contract

`app/globals.css` `:root` is the single source of truth for design
tokens. Components reference `var(--olive)` etc. directly via CSS
Modules — they do NOT accept color / spacing / radius as React props.
If a designer changes `--olive`, every component changes; if a caller
wants to override a token, they redefine it on a scoped wrapper.

Already in `globals.css`:

- color palette (olive, tan, cream, paper, gray, border)
- shadow tokens (soft, lift)
- font aliases (serif, sans — injected by `next/font`)

Added in Phase A:

- type scale: `--text-eyebrow`, `--text-body`, `--text-h*`,
  `--leading-tight`, `--leading-body`
- spacing scale: `--space-1` (4px) … `--space-12` (96px)
- radius scale: `--radius-sharp` (2px), `--radius-card` (3px),
  `--radius-pill` (100px)
- transition scale: `--transition-fast` (150ms), `--transition-base`
  (240ms)
- letter-spacing scale: `--track-eyebrow` (3px), `--track-button` (2.5px)

Property-themed variants (HBSC vs Hog Heaven vs Packsaddle) can later
override the palette block on a portal wrapper — the architecture
already supports it.

## Variant strategy

No `cva`, no `clsx` dep. A six-line `cn(...args)` helper joins truthy
strings. Components compose CSS Module classes by prop value:

```tsx
<button className={cn(s.button, s[variant], s[size], loading && s.loading)}>
```

CSS Modules expose one class per prop value (`.primary`, `.secondary`,
`.sm`, `.md`, `.loading`). No nested ternaries, no class-name
templating.

## Radix integration

Headless behavior packages, installed per-primitive as we build them:

- `@radix-ui/react-slot` — `asChild` pattern in Button. Phase A.
- `@radix-ui/react-dialog` — Phase C.
- `@radix-ui/react-dropdown-menu` — Phase C.
- `@radix-ui/react-radio-group` — Phase B (RadioCardGroup).
- `@radix-ui/react-tabs` — Phase C.
- `@radix-ui/react-toast` — Phase C.
- `@radix-ui/react-tooltip` — Phase C.
- `@radix-ui/react-select` — Phase C.
- `@radix-ui/react-checkbox` — Phase C.

Each Radix primitive gets a thin wrapper component that maps our CSS
Module styles to its `data-state="…"` and `data-disabled` attributes.
We re-export wrappers — not raw Radix — so the boundary is ours.

## Phase A — Foundation (covers login, 404, dev tools, simple landing)

1. **Button** — variants: `primary` (solid olive), `secondary`
   (outlined paper), `ghost` (text only), `link` (inline). Sizes:
   `sm`, `md`, `lg`. `loading`, `disabled`, `leadingIcon`.
   `asChild` slot for `<Link>`.
2. **Input** — text / email / tel / number. Error state.
3. **Textarea** — same visual language as Input, multi-line.
4. **FormField** — composition: Label + Input/Textarea + ErrorText +
   helper text.
5. **Eyebrow** — small uppercase letter-spaced text. Tan-deep by default.
6. **Heading** — `<h1>`–`<h4>`, serif, italic emphasis via `<em>`.
   Optional underline accent (the 36px tan rule).
7. **Card** — paper bg, soft shadow, 3px corners. `hoverable` variant
   that lifts on hover.
8. **Divider** — horizontal rule (full width) or accent line (50px
   centered tan, used under wordmark / over section title).
9. **Alert** — left-border banner. Variants: `error`, `warn`, `info`,
   `success`. Dismissible.
10. **Badge** — status pill. Variants: `open`, `filling`, `waitlist`,
    `full`, `past`, `draft`, `tier-founder`, `tier-charter`,
    `tier-member`, `tier-legacy`.
11. **PageShell** — layout primitive: max-width 1180px, side padding,
    optional `dark` background variant for full-bleed views like login.

## Phase B — Booking flow patterns

12. **Pill** — selectable (Radix RadioGroup-backed) and informational.
13. **RadioCardGroup** — large tile selector (the "Yes / No / Discuss"
    cards in step 4 of the booking mock).
14. **ProgressDots** — the "Step 3 of 5" indicator.
15. **StickyFooter** — bottom action bar with price + back/continue.

## Phase C — Overlays & admin chrome

16. **Topbar** — sticky header with brand mark + avatar + signout.
17. **Avatar** — initials circle (or image).
18. **Dialog** (Radix).
19. **DropdownMenu** (Radix).
20. **Tabs** (Radix).
21. **Toast** (Radix).
22. **Tooltip** (Radix).
23. **Select** (Radix).
24. **Checkbox** (Radix).

## Icons

`@phosphor-icons/react` with the `thin` weight pairs with Cormorant
better than Lucide. Deferred until a mock actually needs an icon
beyond the existing inline SVGs (Google G mark).

## Showcase page — `/dev/ui`

A single Next.js page renders every primitive in every variant. No
Storybook. Lets the designer / PM scroll the entire system in one
page, catches regressions when a token changes.

## Refactor target — `/app/login`

After Phase A lands, the login surface is refactored:

- `<input>` → `<Input>`
- `<button className={styles.loginSubmit}>` → `<Button variant="primary">`
- `<button className={styles.loginGoogle}>` → `<Button variant="secondary" leading={<GoogleMark />}>`
- `<div className={styles.loginField}>` → `<FormField label="Email">`
- Page-specific styles (full-bleed background, wordmark, cycling
  property, card chrome) stay in `login.module.css` — they're scene
  composition, not primitives.

## Out of scope

- Dark mode — no design exists.
- RTL — not needed.
- Per-property theme switching — token architecture supports it; not
  built until the design team commits to which tokens vary.
- A form library (react-hook-form / zod-resolver) — native form events
  + server actions handle current scope. Revisit at multi-step booking.
- Animation primitives beyond what already lives in component CSS
  modules.

## Open questions

None blocking. The plan is incremental — Phase A unblocks all
currently-shipping surfaces; B and C can wait until their consuming
features land.
