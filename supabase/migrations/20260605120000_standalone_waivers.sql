-- ============================================================
-- Walk-in / standalone waivers
-- ============================================================
-- A signed waiver can now be linked to a booking (bid_id) OR stand alone —
-- a walk-in signing at a property (just a name + email + the property). The
-- existing bid-signing path (record_bid_signature) is unchanged: those rows
-- still carry bid_id and leave the new columns null.

alter table public.waiver_documents
  alter column bid_id drop not null;

alter table public.waiver_documents
  add column if not exists property_id uuid references public.properties(id),
  add column if not exists signer_email text,
  add column if not exists collected_by_admin_id uuid references auth.users(id);

-- A row is either bid-linked, or standalone (property + signer email).
do $$ begin
  alter table public.waiver_documents
    add constraint waiver_documents_link_check
    check (bid_id is not null or (property_id is not null and signer_email is not null));
exception when duplicate_object then null; end $$;

-- Admins already read every waiver (role check, no bid traversal). Add a
-- standalone read for property managers — the existing property_manager
-- policy only matched bid-linked waivers via bids→bookings.
drop policy if exists "waiver_documents: property_manager read standalone" on public.waiver_documents;
create policy "waiver_documents: property_manager read standalone"
  on public.waiver_documents for select
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'property_manager'
    and bid_id is null
    and property_id = (select (auth.jwt() -> 'app_metadata' ->> 'property_id')::uuid)
  );

comment on column public.waiver_documents.property_id is
  'Property the waiver was signed at. Set for standalone (walk-in) waivers; null for bid-linked (derive from the booking).';
comment on column public.waiver_documents.signer_email is
  'Signer email — required for standalone waivers (no booking to derive it from).';
comment on column public.waiver_documents.collected_by_admin_id is
  'Staff member who ran an on-site signing surface, if any. Null for the self-serve public kiosk.';
