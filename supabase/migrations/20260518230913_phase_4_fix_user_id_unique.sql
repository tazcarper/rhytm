-- Phase 4 fix: drop UNIQUE on members.user_id.
--
-- The original Phase 4 migration declared `user_id uuid UNIQUE REFERENCES
-- auth.users(id)`, which directly contradicts the Phase 4 design:
-- one Supabase Auth user is supposed to map to N members rows (one per
-- property — the cross-property membership model). With UNIQUE on
-- user_id, the /auth/callback handler hits "duplicate key value violates
-- unique constraint members_user_id_key" the moment it tries to link a
-- second members row for a multi-property invite.
--
-- The constraint was generated automatically as `members_user_id_key`
-- (Postgres default name for column-level UNIQUE). Dropping it removes
-- both the constraint and the underlying unique index. Performance is
-- preserved by the existing non-unique partial index
-- `idx_members_user_id` created in the original Phase 4 migration:
--   CREATE INDEX idx_members_user_id ON members (user_id)
--     WHERE user_id IS NOT NULL;

ALTER TABLE members DROP CONSTRAINT members_user_id_key;
