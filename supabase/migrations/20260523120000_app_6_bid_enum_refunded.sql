-- App 6: extend bid_status_enum with 'refunded'.
--
-- Lives in its own migration because Postgres forbids referencing a
-- newly-added enum value in the same transaction that adds it. The
-- companion migration `20260523120100_app_6_deposit_columns_and_trigger.sql`
-- references 'refunded' inside `sync_booking_from_bid` and must therefore
-- commit after this one.
--
-- Semantics: set by the admin manual-refund action in App 6.6. The
-- `sync_booking_from_bid` trigger maps it to `bookings.status='cancelled'`.
-- Reached only from a `paid` bid via the admin Refund path; not a state
-- a guest can enter on their own.

ALTER TYPE bid_status_enum ADD VALUE IF NOT EXISTS 'refunded';
