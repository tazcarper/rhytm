# Email Template Preview (`/dev/email-templates`)

Status: 🔲 Planned (2026-06-08)

## Context — why

The app renders **16 email components** under `src/components/email/templates/`, but there's no way to *see* one without actually triggering its send. The only email view, `/dev/emails`, lists the **outbox of emails that were already sent** (`dev_email_outbox`) — and it's bypassed entirely when `EMAIL_TRANSPORT=resend` (current local default), so it often looks empty.

This builds a **template gallery** at `/dev/email-templates`: pick any template from a sidebar, see it rendered with realistic sample data in an iframe — no send required, independent of `EMAIL_TRANSPORT`. It's a developer/design-review tool, password-gated and dropped pre-launch alongside the rest of `/dev`.

## What already exists — reuse, don't rebuild

- **Renderer.** `@react-email/render`'s async `render(element)` → inbox-ready HTML string. Already used by `LoggingEmailService` / `ResendEmailService` in `src/services/notifications/send-email.ts`. The gallery calls it directly.
- **Iframe preview pattern.** `app/dev/emails/page.tsx` already renders an email's `body_html` via `<iframe srcDoc={html} sandbox="" />` inside a two-pane (list + detail) layout, styled by `app/dev/emails/emails.module.css`. The gallery mirrors this layout 1:1.
- **Dev auth gate.** `requireDevAuth()` (`lib/dev/auth.ts`) — same `DEV_DASHBOARD_PASSWORD` cookie gate as every `/dev` route. No Supabase/service-role needed (the gallery renders components directly — no DB read at all, unlike `/dev/emails`).
- **Selection-by-searchParam pattern.** `/dev/emails` selects a row via `?id=` + server-rendered `<Link>`s, staying a pure server component. The gallery copies this with `?t=<templateId>` (+ `?v=<variant>`).
- **Templates.** All 16 are named exports with a clean flat `XxxProps` interface (primitives + nullables; pre-formatted strings like `dateLong`, `timeLabel`, dollar amounts *without* `$`, absolute `bidUrl`s). No nested objects to fixture.

## Design / approach

A new sibling route `app/dev/email-templates/page.tsx` (server component), mirroring `/dev/emails`:

1. `await requireDevAuth()`.
2. Read `?t` / `?v` from `searchParams`; default to the first template.
3. Look the selection up in a **typed sample-data registry**, `await render(entry.element)`, pass the HTML to an iframe.
4. Sidebar = grouped `<Link>`s over the registry (one per template/variant), reusing the emails CSS module.

**Sample-data registry (`app/dev/email-templates/registry.tsx`)** — the heart of it. A typed array that imports each template component and constructs a sample element:

```ts
interface TemplatePreview {
  id: string;          // url key, e.g. "waiver-signed--finalized"
  label: string;       // sidebar label
  group: string;       // sidebar group
  element: ReactElement;
}
export const TEMPLATE_PREVIEWS: TemplatePreview[] = [
  { id: "guest-booking-confirmation", label: "Guest booking confirmation", group: "Guest booking",
    element: <GuestBookingConfirmation guestName="Jordan Avery" propertyName="Horseshoe Bay Sporting Club"
      dateLong="Saturday, May 23" timeLabel="9 AM CT" bidUrl="https://rhythm.co/bids/abc/1234" /> },
  // …one per template, multiple entries where a template has meaningful states
];
```

Because each entry is a real `<Component {...sample} />`, **TypeScript checks the sample against the live props interface** — a template prop change breaks `npm run typecheck`, so samples can't silently drift. Keeping the fixtures in the `/dev` tree (not as `PreviewProps` exports on the production template files) means none of this sample data ships to prod, and it's one clean delete pre-launch.

**Why a custom `/dev` page over React Email's `email dev` server:** our templates use **named** exports + `@/` path aliases + a shared layout (`bid-confirmed-layout`), none of which the standalone `react-email` preview server resolves cleanly. Rendering in-Next reuses our aliases, fonts, and `@react-email/render` exactly as production does.

## Implementation steps

1. **Route + layout** — `app/dev/email-templates/page.tsx` (server component): auth gate, `searchParams` selection, `render()` the selected element into an iframe, grouped sidebar of `<Link>`s. Reuse `app/dev/emails/emails.module.css` (or a thin `email-templates.module.css` clone) for the two-pane layout.
2. **Sample-data registry** — `app/dev/email-templates/registry.tsx`: import all 15 sendable templates, author representative sample props per interface, add variant entries where a template branches (see table). Group into: **Guest booking · Payments · Adventures · Staff/internal**.
3. **Detail pane** — show template name, the variant, the rendered iframe, and the sample props as JSON (mirror `/dev/emails`'s `EmailDetail`), so a reviewer sees both the output and the inputs.
4. **Cross-link** — add a header link between `/dev/emails` (“Outbox — sent”) and `/dev/email-templates` (“Templates — gallery”) so the two email tools sit together; optionally surface the gallery from the main `/dev` overview section.
5. **Typecheck** — `npm run typecheck` clean (the registry is the type-safety net).
6. **Doc** — add `/dev/email-templates` (route + registry) to the “Drop-pre-launch checklist” comment in `supabase/migrations/20260521080000_create_dev_email_outbox.sql` alongside `/dev/emails`.

## Templates to cover (15 sendable + 1 shared layout)

| Template (component) | Group | Variants to preview |
|---|---|---|
| `GuestBookingConfirmation` | Guest booking | single |
| `BidConfirmedWithDeposit` | Guest booking | single |
| `BidConfirmedNoDeposit` | Guest booking | single |
| `BidDenied` | Guest booking | single |
| `WaiverSigned` | Guest booking | **2** — `finalized` true / false (different fields render) |
| `PreVisit` | Guest booking | single (pre-event cadence) |
| `PostEventFollowup` | Guest booking | single |
| `DepositReceipt` | Payments | single |
| `RefundNotice` | Payments | single |
| `AdventureRsvpReceipt` | Adventures | single |
| `AdventureCancellation` | Adventures | single |
| `AdventureSpotOpened` | Adventures | single (waitlist promotion) |
| `AdventureRequestNotification` | Staff/internal | single |
| `NewBidStaffNotification` | Staff/internal | single |
| `UnsignedBidDigest` | Staff/internal | single (sample with several rows) |

`bid-confirmed-layout.tsx` (`BidConfirmedLayout`) is a **shared shell** consumed by the two `BidConfirmed*` variants, not a standalone email — exclude it from the gallery (or include once as a layout-only sanity check; not required).

## Out of scope / notes

- **No "send test" button in v1.** A "send this to <address>" action is a tempting add but, with `EMAIL_TRANSPORT=resend`, would fire a *real* email and count against the Resend quota. Defer; if added later, gate it behind an explicit recipient field + confirm.
- **Auth (Supabase) emails aren't in scope** — invites/magic-links are rendered by Supabase, not the app, so there's no React template to preview. (Their *trigger* is already visible via `recordDevAuthEmail` → console + `/dev/emails`.)
- **Dev-only.** Lives entirely under `/dev`; no production surface, no new migration, no env. Dropped pre-launch with the rest of `/dev`.
- **Independent of `EMAIL_TRANSPORT`** — renders templates directly, so it works whether local email is the logging shim or real Resend.

## Verification

- Visit `/dev/email-templates` → sidebar lists all 15 templates grouped; selecting each renders its HTML in the iframe with sample data; the props JSON shows the inputs.
- `WaiverSigned` shows two distinct entries (finalized vs deposit-owed) that render different body sections.
- Change a prop on any template interface → `npm run typecheck` fails at the registry until the sample is updated (drift guard works).
- Cross-links between `/dev/emails` and `/dev/email-templates` work both ways.
- `npm run typecheck` clean; no new migration; nothing rendered outside the `DEV_DASHBOARD_PASSWORD` gate.
