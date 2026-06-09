-- Atomic instructor-profile save. Phase A hardening
-- (plans/instructor-scheduling-and-availability.md, review note #1).
--
-- The TS saveInstructorProfile did the catalog-row update + two junction
-- reconciliations (availability properties, teachable disciplines) as separate
-- round-trips with no transaction, so a mid-way failure left a partial save
-- ("Saved the profile, but updating X failed."). This function performs all of
-- it inside one implicit transaction — it either all lands or none does.
--
-- SECURITY INVOKER (the default): this is a staff-write helper, called by the
-- service-role admin client (which bypasses RLS) AFTER the Server Action
-- authorizes via requireInstructorManager. Execute is locked to service_role so
-- a normal authenticated session can't invoke it directly; even if it could,
-- INVOKER means the body's writes stay subject to the caller's RLS (the
-- instructors / instructor_properties / instructor_disciplines write policies).
--
-- Disciplines are pruned to services that belong to a selected property, so a
-- stale client can't persist a cross-property qualification — matching the old
-- TS behavior exactly.

create or replace function save_instructor_profile(
  p_instructor_id  uuid,
  p_name           text,
  p_bio            text,
  p_photo_url      text,
  p_is_active      boolean,
  p_display_order  integer,
  p_property_ids   uuid[],
  p_discipline_ids uuid[]
) returns void
language plpgsql
set search_path = public
as $$
declare
  v_current_primary uuid;
  v_primary         uuid;
  v_disciplines     uuid[];
begin
  -- instructors.property_id is NOT NULL, so a null result means "no such row".
  select property_id into v_current_primary
    from instructors where id = p_instructor_id;
  if v_current_primary is null then
    raise exception 'instructor not found' using errcode = 'P0002';
  end if;

  if p_property_ids is null or array_length(p_property_ids, 1) is null then
    raise exception 'at least one property is required' using errcode = '23514';
  end if;

  -- Keep the current primary if it's still selected, else re-anchor to the
  -- first selection (preserves the NOT NULL column + property_manager policy).
  v_primary := case
    when v_current_primary = any (p_property_ids) then v_current_primary
    else p_property_ids[1]
  end;

  update instructors set
    name          = p_name,
    bio           = p_bio,
    photo_url     = p_photo_url,
    is_active     = p_is_active,
    display_order = p_display_order,
    property_id   = v_primary,
    updated_at    = now()
  where id = p_instructor_id;

  -- Reconcile the availability set (instructor_properties).
  delete from instructor_properties
    where instructor_id = p_instructor_id
      and property_id <> all (p_property_ids);
  insert into instructor_properties (instructor_id, property_id)
    select p_instructor_id, unnest(p_property_ids)
    on conflict do nothing;

  -- Prune requested disciplines to services at a selected property.
  select coalesce(array_agg(s.id), '{}'::uuid[])
    into v_disciplines
    from services s
    where s.id = any (coalesce(p_discipline_ids, '{}'::uuid[]))
      and s.property_id = any (p_property_ids);

  -- Reconcile the qualification set (instructor_disciplines). `<> all('{}')` is
  -- vacuously true, so an empty desired set clears every discipline — intended.
  delete from instructor_disciplines
    where instructor_id = p_instructor_id
      and service_id <> all (v_disciplines);
  insert into instructor_disciplines (instructor_id, service_id)
    select p_instructor_id, unnest(v_disciplines)
    on conflict do nothing;
end;
$$;

revoke all on function save_instructor_profile(
  uuid, text, text, text, boolean, integer, uuid[], uuid[]
) from public;
grant execute on function save_instructor_profile(
  uuid, text, text, text, boolean, integer, uuid[], uuid[]
) to service_role;

comment on function save_instructor_profile(
  uuid, text, text, text, boolean, integer, uuid[], uuid[]
) is
  'Atomic instructor-profile save: updates the catalog row + reconciles instructor_properties and instructor_disciplines in one transaction. Disciplines pruned to services at the selected properties. SECURITY INVOKER; execute locked to service_role (called after app-level authorization).';
