-- =============================================================
-- Phase 1 follow-up — add the 'auto_reversal' pricing-event source.
--
-- A comp does not survive a change to the add-on it sits on: when an add-on is
-- re-materialized the line returns to its base amount and any in-force comp is
-- removed, restoring confirmed_price. That restore is a confirmed_price change
-- like any other, so it must be audited — but it is neither a manual edit nor a
-- staff-applied override, it is system-initiated. A third source tag keeps the
-- pricing-history timeline honest about which mechanism made the change.
--
-- This lives in its own migration, applied (committed) BEFORE the functions
-- that insert the value: Postgres forbids using a newly-added enum value in the
-- same transaction that adds it.
-- =============================================================

ALTER TYPE pricing_event_source ADD VALUE IF NOT EXISTS 'auto_reversal';
