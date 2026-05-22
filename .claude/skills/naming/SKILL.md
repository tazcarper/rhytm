---
name: naming
description: Intent-revealing naming rules for TypeScript / React / Next.js / Supabase code in this project. Use when writing, reviewing, or refactoring any .ts / .tsx file in app/ or src/. Trigger on tasks that introduce new variables, parameters, or helper functions.
---

# Naming — intent-revealing variables in TS/TSX

A reader of this codebase should not have to mentally decode short identifiers. Each variable name should answer "what is this?" without forcing the reader to look at the type or the surrounding lines.

## Rules

### 1. Banned names in new code (rename existing ones when you touch them)

These names erase intent. They tell the reader "some value of unspecified shape" — a tautology.

| Banned | Use instead |
|---|---|
| `raw` | A descriptive name for the source: `gearListJson`, `errorMessage`, `passwordField`, `params` (for awaited Next.js searchParams), `routeParams` (for awaited route params). Exception: `raw` is acceptable in a tight 2-3 line scope where there's also a `parsed` companion variable distinguishing the two. |
| `q` (as a variable) | `query` (Supabase query builder) or `searchTerm` (free-text search string). The URL/filter *key* `q` is fine — it's an API contract — but the variable holding the value should describe intent. |
| `qs` | `queryString` (serialized form of URLSearchParams) |
| `v` | `value`, or more specifically: `field`, `entry`, `option`, `cellValue` — whatever the value is |
| `obj` | A name describing what kind of object: `entry`, `candidate`, `gearItem`, `payload` |
| `fmt` | `formatTimestamp`, `formatMoney`, `formatRelative` — the format function should say what it formats |
| `tmp`, `arr`, `el`, `cb`, `fn`, `opts`, `cfg` | A name describing the actual contents |
| Single letters as row/iteration variables in `.map` / `.filter` / `.flatMap` (`r`, `m`, `g`, `f`, `p`, `j`, `h`) | `row`, `membership`, `gearItem`, `faqItem`, `property`, `junction`, `householdMember`. The exception is destructuring (`{ id, name }`) where no iteration name is needed. |

### 2. Names you keep — these are idioms in this codebase

Don't waste a refactor on these. They are conventional and clear in their tight scope.

- `i`, `j`, `idx` — for-loop counters, `.map((item, idx) => …)` index
- `_` — unused destructure positions (`.filter((_, idx) => …)`)
- `e` — event handler argument: `(e: FormEvent) => { e.preventDefault(); }`
- `err` or `error` — caught exceptions, including `.catch((err: Error) => …)`
- `ctx` — `useContext(...)` result on the line that calls it
- `s` — CSS module import alias (`import s from "./foo.module.css"`). Don't shadow it: never name a local variable `s` in a file that imports a CSS module.
- `prev`, `next` — React `setState` updater args
- `y`, `m`, `d` — only when destructuring an ISO date (`const [y, m, d] = iso.split("-")`) and the next line uses all three to construct a date

### 3. Helper-function parameters describe the input domain, not its type

```ts
// Bad — `n` and `raw` carry no information beyond what the type already says
function moneyToString(n: number | null): string { … }
function parseGearList(raw: unknown): GearItem[] { … }

// Good — the name says what the input *is*, not its TypeScript shape
function moneyToString(amount: number | null): string { … }
function parseGearList(gearListJson: unknown): GearItem[] { … }
```

### 4. "Raw" + "parsed" pairs

If you genuinely have an unprocessed value alongside its parsed form in the same scope, name them as a pair where the contrast is the meaningful part:

```ts
const statusValue = first(params.status);            // raw URL string
const status = isBidStatus(statusValue)              // narrowed/validated form
  ? statusValue
  : undefined;
```

Avoid `statusRaw` / `status` as a pair — `statusValue` (the unparsed input) reads more naturally and stays grammatical.

### 5. Awaited Next.js searchParams / params

The awaited form is a plain object — don't preserve "raw" in the name:

```ts
// Bad
const raw = await searchParams;
const filters = parseFilters(raw);

// Good
const params = await searchParams;
const filters = parseFilters(params);

// Or, for route params with a small fixed shape, destructure:
const { slug, code } = await params;
```

### 6. Supabase query builders are queries

```ts
// Bad
let q = supabase.from("bids").select("…");
if (filters.status) q = q.eq("status", filters.status);

// Good
let query = supabase.from("bids").select("…");
if (filters.status) query = query.eq("status", filters.status);
```

### 7. URLSearchParams and their serialized form

```ts
// Bad
const params = new URLSearchParams();
const qs = params.toString();

// Good
const queryParams = new URLSearchParams();
const queryString = queryParams.toString();
```

The variable holding a `URLSearchParams` instance is `queryParams`, not `params`, because `params` collides with Next.js route params in the same files.

### 8. Iteration variables in `.map` / `.filter` / `.flatMap`

PostgREST and React both produce a lot of `.map((r) => …)` patterns. Name the row:

```ts
// Bad
.map((r): AdminBidListRow => ({ id: r.id, status: r.status, … }))

// Good
.map((row): AdminBidListRow => ({ id: row.id, status: row.status, … }))
```

For collections with a domain name, use it: `memberships.map((membership) => …)`, `properties.map((property) => …)`, `gearList.map((gearItem) => …)`, `faq.map((faqItem) => …)`.

## Apply this on every code-writing task

When writing or editing a `.ts` / `.tsx` file in `app/` or `src/`:

1. Before finishing the edit, scan the new code for the banned names from section 1.
2. Replace each banned name with an intent-revealing one.
3. If a kept idiom from section 2 applies, leave it — explaining each kept idiom in the diff is not necessary, but DO leave a one-line comment if you're keeping `raw` in the rare "raw + parsed" pair case so the reader knows it's deliberate.
