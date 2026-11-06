---
name: dashboard-forms
description: Use whenever you build or change a form in the admin dashboard (/admin, instructor portal) — new fields, a new settings page, an event option, an "add a row" list. Covers the shared form stylesheet, the type hierarchy, field widths, add-row buttons and optional-feature panels so every dashboard form looks the same.
---

# Dashboard forms

Every dashboard form shares one look, and it comes from **one file**:
`src/components/admin/form-styles.module.css`. Change a style there and it
reaches every form. Never restyle a label, input or add button locally.

## How a form gets the styles

- **Has its own CSS module** (event-flow, bid-editor-form, homepage-hero-form,
  properties-admin, catalog): the module's `.label`, `.input`, `.help`… classes
  `composes:` from form-styles. Add new classes the same way:
  ```css
  .label { composes: label from "./form-styles.module.css"; }
  ```
  Keep only layout (display/gap/grid) in the local rule, never type or colour.
- **Tailwind-only form**: import the module directly.
  ```tsx
  import formStyles from "@/src/components/admin/form-styles.module.css";
  <span className={`${formStyles.label} block mb-2`}>Name</span>
  <input className={formStyles.input} />
  <p className={formStyles.help}>Shown on the bid page.</p>
  ```
  CSS module rules set `margin: 0` on headings, so use `!mt-8` style
  Tailwind utilities (or a wrapper div) when a heading needs spacing.

## Type hierarchy (largest to smallest)

| Role | Class | Size / weight |
|---|---|---|
| Section heading | `subhead` | 24 / 700 |
| Group heading (a set of fields, "Card 1") | `groupTitle` | 20 / 700 |
| Section description | `sectionDesc` | 17 gray |
| Field label | `label` | 17 / 600 olive, **sentence case** |
| What staff type | `input` | 18 / 400, 54px tall |
| Helper text under a field | `help` | 15 gray |

Each level differs by size **and** weight or colour, so a heading never looks
like the labels under it. No uppercase tracked labels, no serif italic helper
text in forms.

## Field widths match the answer

A box should be about as wide as what goes in it (Baymard, GOV.UK).

- Text (names, descriptions, links): full width.
- Counts, prices, dates: short boxes side by side in a `row`. In the event
  builder use `CountField` / `MoneyField` / `DateField` from
  `src/components/admin/event-flow-fields.tsx`; elsewhere use
  `formStyles.row` + `formStyles.fit` on the field and
  `wCount` / `wMoney` / `wDate` on the box.
- Prices show `$` inside the box (`formStyles.money` wrapper), so labels don't
  say "($)". Put "leave blank if free" in `help` under the row, not in a
  placeholder that won't fit.
- Two or three choices: `SegmentedChoice` (all options visible), not a
  dropdown.

## Buttons that add a row

"Add a chapter", "Add hours", "Add a ticket option": use `AddRowButton`
(`src/components/admin/add-row-button.tsx`) or `FlowButton variant="add"` in
the event builder. Dashed tan outline + plus icon, so they never look like an
empty input or the form's main action. Label: "Add a …", no "+" in the text.

## Optional features

An optional extra on an event (early-bird pricing, a discount, a waitlist)
goes in an `EventOptionPanel` (`src/components/admin/event-option-panel.tsx`)
under the step's options section: off = one line with a tick box, on = its
fields open below, switching off clears them. Not an accordion: open always
means on. Once a section has 4–5 options, hide the off ones behind a
"Show more … options" link.

## Out of scope

- Public site, booking funnel and member portal forms use `lib/ui` (brand
  register) — don't apply this there.
- Compact filter bars (`queue-list.module.css`) and inline table controls stay
  compact.

## Check before you finish

Render the form (screenshot it) and check: labels sentence case and olive,
headings clearly bigger than labels, short answers in short boxes, add buttons
dashed. `npm run typecheck` passes.
