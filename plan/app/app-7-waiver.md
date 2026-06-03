# App 7 — Homegrown Waiver (Implementation, as built)

> **Status:** Built + verified end-to-end on branch `feature/homegrown-waiver` (2026-05-31).
>
> **Both signing implementations ship in the codebase.** The app **defaults to the homegrown native waiver**; the original Dropbox Sign integration is retained as a deprecated-but-functional fallback, selected by the `WAIVER_PROVIDER` env var. The original vendor implementation plan is preserved in git history (this file previously lived at `app-7-dropbox-sign.md`).

## Summary

The waiver is a single-signer, few-field liability document. Instead of a third-party e-sign vendor (DocuSign / Dropbox Sign), it is signed in-house: a typed-name signature + consent, rendered to a PDF, stored privately, and recorded atomically. The flow is **synchronous — no webhook, no polling.**

**Why not a vendor?** The use case isn't complex enough to justify one, and a paid e-sign subscription would cost more money for no added benefit. A typed signature + consent disclosure + audit trail (name, timestamp, IP) + a retained, hashed PDF meets the ESIGN/UETA bar for a waiver. The things a vendor adds (PKI certificates, multi-party sequencing, identity proofing) are irrelevant for this document. The vendor path remains available behind a switch if that ever changes.

## Contract preserved

`bids.signed_at` remains the canonical "signed" signal. The guarded `confirmed → signed` status advance and the `bid/signed` + `booking/confirmed`(-if-finalized) Inngest events reproduce the old Dropbox Sign `onSigned` behavior verbatim, so the `sync_booking_from_bid` trigger sees an identical transition. A `paid` bid is never regressed (the guarded UPDATE matches 0 rows for it, so the status trigger never fires).

## Data model (migrations `20260531120000`–`20260531160000`)

- **`waiver_templates`** — config-in-DB waiver text, versioned, one active row per property (partial unique index on `is_active`). Columns: `title`, `body`, `consent_text`, `version`, `is_active`, `created_by`. Admin-editable.
- **`waiver_documents`** — the signed artifact + legal audit, one per bid (`UNIQUE bid_id`). Columns: `waiver_template_id` (exact version signed), `blob_pathname` / `blob_url` (private Storage object), `pdf_sha256` (tamper-evidence), `signed_name` (frozen snapshot), `signed_ip`, `signed_user_agent`, `signer_user_id`.
- **`record_bid_signature(...)` RPC** — `SECURITY DEFINER`, service-role only. Atomic: under a `FOR UPDATE` row lock it checks already-signed FIRST (idempotent → `first_stamp=false`), then the signable-status gate, then inserts the artifact, stamps `signed_at`, and guarded-advances status. Returns the finalization context (`booking_id`, `paid_at`, `deposit_amount`, `start_time`).
- **`save_waiver_template(...)` RPC** — `SECURITY INVOKER` (RLS gates it to admins). Atomic deactivate-prior + insert-new-version.
- **Storage:** a **private `waivers` bucket** (pdf-only, 10 MB cap). Access via short-lived service-role signed URLs.

### RLS

- `waiver_documents`: admin read (`super_admin`/`admin`); `property_manager` read scoped to their property (leaf table, one-directional `bids → bookings` EXISTS — no policy cycle). **No client write policy** — writes happen only through the `SECURITY DEFINER` RPC / service role.
- `waiver_templates`: staff read; admin insert/update.
- `record_bid_signature` EXECUTE revoked from `PUBLIC`/`anon`/`authenticated`, granted to `service_role` only — it is `SECURITY DEFINER`, so the execute grant is the security boundary (the bid access code is validated in the Server Action before the RPC is called).

## Flow

1. **Guest** opens the bid page → `SignatureSlot` mounts `WaiverSignModal` (native) — a mobile-first `<dialog>`: prefilled-but-editable legal name, consent checkbox, scrollable waiver body, sticky actions.
2. **Submit** → `submitWaiverSignatureAction` (captures IP / UA / signed-in member id) → `recordSignature` service: validate access code → load active template → render PDF (`pdf-lib`) → store (SHA-256 + private bucket) → `record_bid_signature` RPC → on a lost race, delete the orphan blob → emit `bid/signed` + `booking/confirmed`-if-finalized.
3. **Synchronous success** → modal closes, page refreshes to the signed state. No polling.
4. **Admin** views the signed PDF at `/admin/bids/[id]/waiver` (role-gated; looks up the artifact through the admin's RLS-scoped client, then redirects to a 60 s signed URL). The Lifecycle card shows **"View signed waiver →"** + a `sha256` caption.
5. **Admin** edits each property's waiver text at `/admin/settings/waivers` (versioned — saving creates a new active version; signed PDFs keep their frozen version).

## File layout

**New**
- `lib/waiver/provider.ts` — the `WAIVER_PROVIDER` switch (default native).
- `lib/storage/waiver-storage.ts` — private bucket adapter (upload / createSignedUrl / remove).
- `src/services/waiver/` — `render-waiver-pdf.ts` (pure), `store-waiver-pdf.ts`, `get-active-waiver-template.ts`, `save-waiver-template.ts`, `record-signature.ts` (coordinator), `emit-signed-side-effects.ts`.
- `src/components/public/waiver-sign-modal.tsx` (+ `.module.css`) — the signing modal.
- `src/components/admin/waiver-template-editor.tsx` (+ `.module.css`); `app/admin/settings/waivers/` (page + actions); `app/admin/bids/[id]/waiver/route.ts` (admin PDF proxy).
- `submitWaiverSignatureAction` in `app/(public)/bids/[slug]/[code]/signature-actions.ts`.

**Modified**
- Bid page `SignatureSlot` branches native vs vendor on the provider; loads the active template via service role.
- `confirmBid` (`transition-bid.ts`) only pre-creates a Dropbox Sign envelope when the provider is `dropbox_sign`.
- `getAdminBidDetail` joins `waiver_documents` (a one-to-one embed → object, not array); admin Lifecycle card links the PDF.

## Provider switch / deprecation

`WAIVER_PROVIDER` (env): unset / `native` → homegrown (default, **no extra config in Vercel**); `dropbox_sign` → the deprecated vendor path (also needs the `DROPBOX_SIGN_*` vars). The vendor code, deps (`@dropbox/sign`, `hellosign-embedded`), and `bids.dropbox_sign_envelope_id` are **retained but annotated `@deprecated`**. Revival steps: `src/services/dropbox-sign/DEPRECATED.md`. The native and vendor paths are mutually exclusive — selected by this one switch.

## SOLID notes

- `render-waiver-pdf` is pure (layout only — no I/O). `record-signature` coordinates and delegates; infrastructure clients are injected. All atomic DB mutation lives in the RPC. The provider is a thin strategy switch at the call sites — the two paths are genuinely different shapes (synchronous submit vs async envelope + webhook), so a forced unified interface would be a Liskov stretch.

## Deferred (out of v1)

- Waiver re-issue / reset admin action (manual today: clear `signed_at` + delete the `waiver_documents` row + storage object).
- Customer self-download route (admin-only for now).
- Member-read RLS on `waiver_documents`.

## Verification

- **Render** — verified offline: valid multi-page `%PDF-`, deterministic, stable hash.
- **Storage** — verified live: bucket create, service-role upload, 60 s signed-URL fetch (200 application/pdf), anon direct read denied (400).
- **RPC** — verified live on a throwaway bid (RLS rule #6): stamp + status + `sync_booking_from_bid` trigger + artifact; graceful idempotent re-sign (`first_stamp=false`); non-signable RAISE; anon execute denied (401).
- **Full flow** — verified through the real UI: guest sign (modal) → artifact + `signed_at` → admin "View signed waiver" opens the PDF.
