-- =============================================================
-- Adventure waitlist queue ordering.
--
-- waitlisted_at is stamped when a member joins the waitlist, so the
-- "spot opened" notifier can order the queue fairly (created_at is stale
-- for a row re-used from a prior cancelled/confirmed RSVP). Waitlisted
-- RSVPs don't consume capacity (the capacity trigger counts only
-- confirmed + pending_payment), so no trigger change is needed.
-- =============================================================

ALTER TABLE member_adventure_rsvps
  ADD COLUMN IF NOT EXISTS waitlisted_at timestamptz;
