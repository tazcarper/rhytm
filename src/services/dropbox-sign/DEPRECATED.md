# ⚠️ Dropbox Sign — DEPRECATED (App 7)

This Dropbox Sign / HelloSign e-signature integration is **deprecated**, superseded by the in-house typed-signature waiver flow in `src/services/waiver/*`.

It is **kept intact as a revivable fallback — not deleted.** Nothing here is wired into the default code paths: the bid page mounts the native modal, `confirmBid` skips envelope creation, and this webhook receives no events unless the provider switch is flipped.

## Why it was replaced

A single-signer, few-field liability waiver didn't justify a vendor dependency. The native path renders the PDF with `pdf-lib`, stores it in a private Supabase Storage bucket, and records the signature atomically in one RPC — synchronously, with no webhook and no polling. See [[homegrown-waiver-plan]] in project memory for the full rationale.

## What still belongs to this path (do not remove)

- **Code:** `src/services/dropbox-sign/*`, `lib/dropbox-sign/server.ts`, `app/api/webhooks/dropbox-sign/route.ts`, `src/components/public/signature-form.tsx`, and `getSignUrlAction` in `app/(public)/bids/[slug]/[code]/signature-actions.ts`.
- **Dependencies:** `@dropbox/sign`, `hellosign-embedded`, `@types/hellosign-embedded`.
- **DB column:** `bids.dropbox_sign_envelope_id` (also still shown in the admin Lifecycle card for any bid signed via the vendor before cutover).
- **Shared, NOT vendor-specific (keep regardless):** the `bid/signed` and `booking/confirmed` Inngest events — the native path fires these too.

## How to revive

1. Set `WAIVER_PROVIDER=dropbox_sign` (see `lib/waiver/provider.ts`). This makes the bid page mount `SignatureForm` instead of the native modal, and makes `confirmBid` pre-create an envelope on confirmation.
2. Configure the Dropbox Sign env vars:
   - `DROPBOX_SIGN_API_KEY`
   - `DROPBOX_SIGN_TEMPLATE_ID`
   - `NEXT_PUBLIC_DROPBOX_SIGN_CLIENT_ID`
   - `DROPBOX_SIGN_TEST_MODE` (`0` for live; defaults to test mode otherwise)
3. Re-register the webhook endpoint (`/api/webhooks/dropbox-sign`) in the Dropbox Sign app settings.

The native and vendor paths are independent strategies selected by the switch — they are not meant to run simultaneously.
