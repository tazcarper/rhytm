-- Pin search_path on the events capacity/sync trigger functions. The
-- Supabase security advisor flags any function without a fixed
-- search_path as mutable-search-path risk. These three aren't SECURITY
-- DEFINER (they only run as the invoking role via a trigger, same as
-- member_adventures' equivalents), but pinning search_path is still cheap
-- defense-in-depth and closes the advisory.

ALTER FUNCTION check_event_capacity() SET search_path = public;
ALTER FUNCTION sync_event_sold_out() SET search_path = public;
ALTER FUNCTION resync_event_sold_out_on_capacity_change() SET search_path = public;
