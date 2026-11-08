-- ============================================================
-- Member rewards (points) — proof of concept
-- ============================================================
--
-- Members earn points on what they pay and spend them as dollar credit.
-- Business rules (decided with the client 2026-11-08; numbers live in
-- src/constants/rewards/program.ts, not here):
--   - 1 point per $1 paid; 100 points = $5.
--   - Points belong to the MEMBERSHIP (the household), so everyone on a
--     membership shares one balance. A membership belongs to one property,
--     so balances are naturally separate per property.
--   - Soft expiry: each account carries an expires_at that resets on every
--     earn/spend. After it passes, points can't be REDEEMED, but nothing is
--     deleted — the balance stays on record and staff can extend the date.
--   - Members only.
--
-- Shape: an append-only LEDGER (reward_transactions) is the source of
-- truth. The balance is SUM(points) — never stored, so it can't drift. A
-- mistake is corrected by posting an opposite adjustment, never by editing
-- or deleting a row; a trigger enforces that.
--
-- Writes go only through SECURITY DEFINER functions:
--   post_reward_transaction        service_role only (Stripe webhook path)
--   staff_post_reward_transaction  staff, scoped like memberships reads
--   staff_set_reward_expiry        staff, same scope
-- There are no INSERT/UPDATE/DELETE policies on either table.
--
-- Policy dependency audit (CLAUDE.md RLS rule 5):
--   reward_accounts / reward_transactions SELECT policies call
--   current_member_membership_ids() and staff_reward_membership_ids(), both
--   SECURITY DEFINER selectors (opaque to the planner). Neither memberships,
--   membership_people nor people have policies that reference the reward
--   tables, so no cycle is possible. The reward_balances view is
--   security_invoker, so it inherits these policies plus memberships'.

-- ---- reward_accounts: one row per membership ----
CREATE TABLE reward_accounts (
  membership_id uuid PRIMARY KEY REFERENCES memberships(id),
  -- Soft expiry. NULL until the first transaction. Redemptions are refused
  -- after this moment; the balance itself is untouched.
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER reward_accounts_updated_at
  BEFORE UPDATE ON reward_accounts
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE reward_accounts ENABLE ROW LEVEL SECURITY;

-- ---- reward_transactions: the append-only ledger ----
CREATE TABLE reward_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES reward_accounts(membership_id),

  -- Signed: positive adds, negative subtracts.
  points integer NOT NULL CHECK (points <> 0),

  -- earn       = points for money paid (online or at the property)
  -- redeem     = points spent as dollar credit
  -- adjustment = staff correction / goodwill / reversal
  kind   text NOT NULL CHECK (kind IN ('earn', 'redeem', 'adjustment')),
  source text NOT NULL CHECK (source IN ('online_payment', 'staff')),
  CONSTRAINT earn_is_positive   CHECK (kind <> 'earn'   OR points > 0),
  CONSTRAINT redeem_is_negative CHECK (kind <> 'redeem' OR points < 0),

  reason      text NOT NULL CHECK (length(btrim(reason)) > 0),
  -- The business date of the purchase/redemption (staff may log yesterday's
  -- check-in today). created_at records when it was entered.
  occurred_on date NOT NULL DEFAULT current_date,
  -- The dollar amount behind the entry: purchase amount for an earn,
  -- discount given for a redeem. Informational.
  amount_usd  numeric(10,2),

  booking_id        uuid REFERENCES bookings(id) ON DELETE SET NULL,
  adventure_rsvp_id uuid REFERENCES member_adventure_rsvps(id) ON DELETE SET NULL,
  stripe_payment_intent_id text,

  -- auth user who entered it; NULL for automated (webhook) entries.
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotency for automated entries: one earn and one redeem per
-- PaymentIntent, however many times Stripe redelivers the webhook.
CREATE UNIQUE INDEX idx_reward_tx_payment_intent_kind
  ON reward_transactions (stripe_payment_intent_id, kind)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX idx_reward_tx_membership
  ON reward_transactions (membership_id, created_at DESC);

ALTER TABLE reward_transactions ENABLE ROW LEVEL SECURITY;

-- Append-only, even for service_role.
CREATE OR REPLACE FUNCTION reward_transactions_block_mutation()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'reward_transactions is append-only; post an adjustment instead';
END;
$$;

CREATE TRIGGER reward_transactions_append_only
  BEFORE UPDATE OR DELETE ON reward_transactions
  FOR EACH ROW EXECUTE FUNCTION reward_transactions_block_mutation();

-- ---- bookings: which membership the booking earns for / redeemed from ----
ALTER TABLE bookings
  ADD COLUMN reward_membership_id uuid REFERENCES memberships(id),
  ADD COLUMN reward_points_redeemed integer NOT NULL DEFAULT 0
    CHECK (reward_points_redeemed >= 0);

COMMENT ON COLUMN bookings.reward_membership_id IS
  'Membership that earns points for this booking. Set when the guest enters '
  'a member number on the bid page, or resolved automatically at payment '
  'time (booked while logged in, or the booking email matches a member).';
COMMENT ON COLUMN bookings.reward_points_redeemed IS
  'Points applied as a discount on the online payment. amount_paid includes '
  'their dollar value.';

-- ============================================================
-- Selector helpers (SECURITY DEFINER, per CLAUDE.md RLS rule 2)
-- ============================================================

-- Memberships the current STAFF user may see rewards for. Mirrors the
-- memberships read policies: admins see all; property managers and
-- membership coordinators see their own property. Bypasses RLS on
-- memberships to avoid a policy dependency arrow from the reward tables.
CREATE OR REPLACE FUNCTION staff_reward_membership_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT m.id
  FROM memberships m
  WHERE (SELECT is_admin())
     OR (
       (SELECT auth_role()) IN ('property_manager', 'membership_coordinator')
       AND m.property_id = (SELECT auth_property_id())
     );
$$;

-- ============================================================
-- Policies (read-only; writes go through the functions below)
-- ============================================================

CREATE POLICY "reward_accounts: member household read"
  ON reward_accounts FOR SELECT
  USING (
    (SELECT auth_role()) = 'member'
    AND membership_id IN (SELECT current_member_membership_ids())
  );

CREATE POLICY "reward_accounts: staff read"
  ON reward_accounts FOR SELECT
  USING (membership_id IN (SELECT staff_reward_membership_ids()));

CREATE POLICY "reward_transactions: member household read"
  ON reward_transactions FOR SELECT
  USING (
    (SELECT auth_role()) = 'member'
    AND membership_id IN (SELECT current_member_membership_ids())
  );

CREATE POLICY "reward_transactions: staff read"
  ON reward_transactions FOR SELECT
  USING (membership_id IN (SELECT staff_reward_membership_ids()));

-- ============================================================
-- Balance view
-- ============================================================

CREATE VIEW reward_balances
WITH (security_invoker = true) AS
SELECT
  a.membership_id,
  m.property_id,
  m.member_number,
  COALESCE(SUM(t.points), 0)::integer                              AS balance,
  COALESCE(SUM(t.points) FILTER (WHERE t.points > 0), 0)::integer AS lifetime_earned,
  a.expires_at,
  (a.expires_at IS NOT NULL AND a.expires_at < now())              AS is_expired,
  MAX(t.created_at)                                                AS last_activity_at
FROM reward_accounts a
JOIN memberships m ON m.id = a.membership_id
LEFT JOIN reward_transactions t ON t.membership_id = a.membership_id
GROUP BY a.membership_id, m.property_id, m.member_number, a.expires_at;

-- ============================================================
-- Write functions
-- ============================================================

-- The one place a ledger row is written. Locks the account row so two
-- concurrent redemptions can't both pass the balance check.
--
-- SECURITY DEFINER: bypasses RLS on reward_accounts/reward_transactions
-- (which have no write policies). EXECUTE is granted to service_role
-- only; staff go through staff_post_reward_transaction, which checks
-- scope first.
--
-- p_allow_negative / p_enforce_expiry exist for the webhook: when a
-- discount was already given at checkout, the redemption is recorded
-- even if the balance moved in between (staff can see and fix it).
CREATE OR REPLACE FUNCTION post_reward_transaction(
  p_membership_id     uuid,
  p_points            integer,
  p_kind              text,
  p_source            text,
  p_reason            text,
  p_occurred_on       date,
  p_expiry_months     integer,
  p_amount_usd        numeric DEFAULT NULL,
  p_booking_id        uuid    DEFAULT NULL,
  p_adventure_rsvp_id uuid    DEFAULT NULL,
  p_payment_intent_id text    DEFAULT NULL,
  p_created_by        uuid    DEFAULT NULL,
  p_allow_negative    boolean DEFAULT false,
  p_enforce_expiry    boolean DEFAULT true
)
RETURNS reward_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account reward_accounts;
  v_balance integer;
  v_row     reward_transactions;
BEGIN
  INSERT INTO reward_accounts (membership_id)
  VALUES (p_membership_id)
  ON CONFLICT (membership_id) DO NOTHING;

  SELECT * INTO v_account
  FROM reward_accounts
  WHERE membership_id = p_membership_id
  FOR UPDATE;

  -- Idempotent replay: same PaymentIntent + kind returns the first row.
  IF p_payment_intent_id IS NOT NULL THEN
    SELECT * INTO v_row
    FROM reward_transactions
    WHERE stripe_payment_intent_id = p_payment_intent_id AND kind = p_kind;
    IF FOUND THEN
      RETURN v_row;
    END IF;
  END IF;

  IF p_points < 0 THEN
    IF p_kind = 'redeem' AND p_enforce_expiry
       AND v_account.expires_at IS NOT NULL AND v_account.expires_at < now() THEN
      RAISE EXCEPTION 'reward_points_expired' USING ERRCODE = 'P0001';
    END IF;

    IF NOT p_allow_negative THEN
      SELECT COALESCE(SUM(points), 0) INTO v_balance
      FROM reward_transactions
      WHERE membership_id = p_membership_id;
      IF v_balance + p_points < 0 THEN
        RAISE EXCEPTION 'reward_insufficient_points' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  INSERT INTO reward_transactions (
    membership_id, points, kind, source, reason, occurred_on, amount_usd,
    booking_id, adventure_rsvp_id, stripe_payment_intent_id, created_by
  ) VALUES (
    p_membership_id, p_points, p_kind, p_source, btrim(p_reason),
    COALESCE(p_occurred_on, current_date), p_amount_usd,
    p_booking_id, p_adventure_rsvp_id, p_payment_intent_id, p_created_by
  )
  RETURNING * INTO v_row;

  -- Any earn or spend is activity: push the soft expiry out. Staff
  -- corrections don't count as member activity.
  IF p_kind IN ('earn', 'redeem') THEN
    UPDATE reward_accounts
    SET expires_at = now() + make_interval(months => p_expiry_months)
    WHERE membership_id = p_membership_id;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION post_reward_transaction(
  uuid, integer, text, text, text, date, integer, numeric, uuid, uuid, text, uuid, boolean, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION post_reward_transaction(
  uuid, integer, text, text, text, date, integer, numeric, uuid, uuid, text, uuid, boolean, boolean
) TO service_role;

-- Staff entry point for the admin "Adjust points" form. Checks the caller
-- may see this membership, stamps created_by from the JWT (the caller
-- can't spoof it), then posts. Expiry is enforced on redemptions; staff
-- extend the date first if they want to honour expired points.
CREATE OR REPLACE FUNCTION staff_post_reward_transaction(
  p_membership_id uuid,
  p_points        integer,
  p_kind          text,
  p_reason        text,
  p_occurred_on   date,
  p_expiry_months integer,
  p_amount_usd    numeric DEFAULT NULL
)
RETURNS reward_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_membership_id NOT IN (SELECT staff_reward_membership_ids()) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  RETURN post_reward_transaction(
    p_membership_id     => p_membership_id,
    p_points            => p_points,
    p_kind              => p_kind,
    p_source            => 'staff',
    p_reason            => p_reason,
    p_occurred_on       => p_occurred_on,
    p_expiry_months     => p_expiry_months,
    p_amount_usd        => p_amount_usd,
    p_created_by        => (SELECT auth.uid())
  );
END;
$$;

REVOKE ALL ON FUNCTION staff_post_reward_transaction(
  uuid, integer, text, text, date, integer, numeric
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION staff_post_reward_transaction(
  uuid, integer, text, text, date, integer, numeric
) TO authenticated;

-- Staff can move the soft expiry (policy change, goodwill). The balance
-- is never touched.
CREATE OR REPLACE FUNCTION staff_set_reward_expiry(
  p_membership_id uuid,
  p_expires_at    timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_membership_id NOT IN (SELECT staff_reward_membership_ids()) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  INSERT INTO reward_accounts (membership_id, expires_at)
  VALUES (p_membership_id, p_expires_at)
  ON CONFLICT (membership_id) DO UPDATE SET expires_at = EXCLUDED.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION staff_set_reward_expiry(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION staff_set_reward_expiry(uuid, timestamptz) TO authenticated;

GRANT SELECT ON reward_accounts, reward_transactions, reward_balances TO authenticated;

NOTIFY pgrst, 'reload schema';
