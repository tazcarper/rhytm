-- =============================================================
-- Expose payment_mode + deposit_amount through the public adventures
-- selector so the reserve flow can branch (instant / deposit / inquire)
-- and show a deposit amount. Return-type change → DROP + CREATE.
-- =============================================================

DROP FUNCTION IF EXISTS public_member_adventures(uuid);

CREATE FUNCTION public_member_adventures(p_id uuid DEFAULT NULL)
RETURNS TABLE (
  id                   uuid,
  property_id          uuid,
  property_name        text,
  title                text,
  description          text,
  start_date           date,
  end_date             date,
  max_capacity         integer,
  max_guests_per_rsvp  integer,
  price                numeric,
  guest_price          numeric,
  deposit_amount       numeric,
  payment_mode         text,
  status               adventure_status_enum,
  is_manually_sold_out boolean,
  details              jsonb
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT a.id, a.property_id, p.name, a.title, a.description, a.start_date, a.end_date,
         a.max_capacity, a.max_guests_per_rsvp, a.price, a.guest_price,
         a.deposit_amount, a.payment_mode,
         a.status, a.is_manually_sold_out, a.details
  FROM member_adventures a
  JOIN properties p ON p.id = a.property_id
  WHERE a.status IN ('published', 'sold_out')
    AND (a.details->>'devTest') IS DISTINCT FROM 'true'
    AND (p_id IS NULL OR a.id = p_id)
  ORDER BY a.start_date;
$$;

COMMENT ON FUNCTION public_member_adventures(uuid) IS
  'Public selector: published/sold_out adventures for the homepage + /adventures/[id]. Bypasses member-only RLS to return the same cross-property set to anon and authenticated callers. No PII exposed.';

REVOKE ALL ON FUNCTION public_member_adventures(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_member_adventures(uuid) TO anon, authenticated;
