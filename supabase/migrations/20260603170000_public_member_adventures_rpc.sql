-- =============================================================
-- Public read for member_adventures (homepage showcase + the public
-- /adventures/[id] detail page).
--
-- member_adventures is members-only at the RLS layer ("adventures:
-- member read published" requires auth_role()='member' + an active
-- membership at the property), so anon visitors see zero rows. This
-- SECURITY DEFINER selector exposes ONLY published/sold_out adventures
-- to the public — and returns the same full cross-property set to anon
-- AND authenticated callers, so a logged-in member sees the same
-- homepage showcase as an anonymous visitor (their normal RLS would
-- otherwise scope them to their own properties).
--
-- Safe to expose: adventures carry no PII; price/guest_price are
-- public-facing marketing info. The projection is column-explicit and
-- joins the property name. p_id => null returns all; a uuid returns the
-- single matching row (powers the detail page). SET search_path = public
-- per the SECURITY DEFINER convention (CLAUDE.md RLS rule 4).
-- =============================================================

-- DROP first: the return-type signature changed during development
-- (added property_id), and CREATE OR REPLACE can't alter an OUT-param
-- row type. IF EXISTS keeps it a no-op on a fresh database.
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
         a.status, a.is_manually_sold_out, a.details
  FROM member_adventures a
  JOIN properties p ON p.id = a.property_id
  WHERE a.status IN ('published', 'sold_out')
    -- Dev-only test adventures (created via /dev for capacity testing)
    -- stay visible in the member portal but never on the public site.
    AND (a.details->>'devTest') IS DISTINCT FROM 'true'
    AND (p_id IS NULL OR a.id = p_id)
  ORDER BY a.start_date;
$$;

COMMENT ON FUNCTION public_member_adventures(uuid) IS
  'Public selector: published/sold_out adventures for the homepage + /adventures/[id]. Bypasses member-only RLS to return the same cross-property set to anon and authenticated callers. No PII exposed.';

REVOKE ALL ON FUNCTION public_member_adventures(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_member_adventures(uuid) TO anon, authenticated;
