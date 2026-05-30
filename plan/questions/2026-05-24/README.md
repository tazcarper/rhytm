# Client Questions — 2026-05-24 batch

Questions surfaced during App 6 → 7 → 8 development. Foundational Q1–Q16 live in `docs/need_answers.md` and `docs/5-14-26-client-questions.md` (May 14 batch) — not duplicated here.

## App 8 — Resend / outbound email

Production email setup is gated on these. Resend integration is wired and tested end-to-end (test mail delivered to `jtc006@gmail.com` on 2026-05-24); only the config knobs below remain.

- [Q1 — From address for booking emails](app-8-resend/q1-from-address.md)
- [Q2 — Display name in From header](app-8-resend/q2-display-name.md)
- [Q3 — Reply-to inbox](app-8-resend/q3-reply-to-inbox.md)
- [Q4 — Existing Resend usage on `send.rhythm.co`](app-8-resend/q4-existing-resend-usage.md)

## App 7 — Waiver / e-signature

Dropbox Sign integration is built and tested; activation needs a real waiver template.

- [W1 — Waiver document content](app-7-waiver/w1-waiver-document.md)
- [W2 — One template across properties, or one per property?](app-7-waiver/w2-template-per-property.md)

## Property configuration

Each property's settings record has placeholder values that need real client input before guests see them.

- [P1 — Booking horizon per property](property-configuration/p1-booking-horizon.md)
- [P2 — Max concurrent groups per property](property-configuration/p2-max-concurrent-groups.md)
- [P3 — Support email and phone per property](property-configuration/p3-support-email-phone.md)

## Branding & customer-facing copy

UI strings that look like placeholders.

- [B1 — "Est. 2026" on the home page](branding-and-copy/b1-est-2026.md)
- [B2 — `no-reply@rhythm.local` placeholder sender (confirmation only)](branding-and-copy/b2-placeholder-sender.md)

## Admin operations (App 3 prep)

Design decisions easier to make before App 3 (Admin Portal) lands than after.

- [A1 — Deny/refund reason visibility to guest](admin-operations/a1-deny-refund-reason-visibility.md)
- [A2 — Sidebar vs topbar navigation](admin-operations/a2-sidebar-vs-topbar.md)

## Domain & deployment strategy

- [D1 — Per-property branded subdomains (long-term)](domain-strategy/d1-per-property-subdomains.md)
