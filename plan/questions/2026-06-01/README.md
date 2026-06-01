# Client Questions — 2026-06-01 batch

Questions surfaced while reviewing the bid lifecycle and admin status semantics.
Foundational Q1–Q16 (May 14) and the 2026-05-24 per-app batch are not duplicated here.

## Bid lifecycle — deposit & expiry

Reviewing how "Confirmed" behaves surfaced that nothing auto-expires a confirmed-but-unpaid
bid today, so held slots never auto-release. We decided **not** to auto-cancel for unsigned
waivers or unpaid balances (guests can finish on-property) — but the deposit case is open.

- [L1 — Deposit expiry: do unpaid deposits auto-expire a confirmed bid?](bid-lifecycle/l1-deposit-expiry-policy.md)
