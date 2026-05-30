# B2 — `no-reply@rhythm.local` placeholder sender confirmation

**Category:** Branding & customer-facing copy
**Status:** Open · surfaced 2026-05-24 · informational, very low priority
**Blocks:** Nothing — listed to avoid surprise
**Source:** `src/services/notifications/send-email.ts` — `DEFAULT_FROM_EMAIL` fallback

## The question

When `RESEND_FROM_EMAIL` is unset (e.g., a local development environment with no Resend configured), emails fall back to a placeholder sender `no-reply@rhythm.local`.

This is intentionally fake — the `.local` TLD doesn't resolve on the public internet, so a dev reviewer looking at the email body in `/dev/emails` knows immediately that this isn't a real send. Production reads from `RESEND_FROM_EMAIL`, so the placeholder never appears in real customer email.

We just want to confirm: you understand this is a developer-only sentinel, and you don't want us to use `no-reply@rhythm.local` for anything customer-facing.

## Why it matters

Only listed because someone scanning the codebase might see the string and ask "wait, is that the production sender?" — no, it's the unset-fallback. The production sender is whatever Q1 (Resend from address) resolves to.

## What it unblocks

Nothing. Pure FYI.

## Answer

_(pending — confirmation only)_
