-- Per-ticket price change. The event's price_change_on date (added in
-- 20261105180000_event_price_change.sql) now also drives each ticket type:
-- price_after is what that ticket costs FROM that date on. NULL means the
-- ticket's price does not change. Additive only; no RLS change (a column on
-- an existing table, covered by its existing policies).

ALTER TABLE event_ticket_types
  ADD COLUMN price_after numeric(10, 2) CHECK (price_after IS NULL OR price_after >= 0);
