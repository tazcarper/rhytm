-- ============================================================
-- App 4.5 — shareable trip link
-- ============================================================
-- A finalized booking's booker can mint an opaque, read-only link to send
-- to others on the trip (even non-members). The link renders a trimmed
-- trip overview at /trip/<token> with NO pricing, payment, contact, or
-- bid-access detail.
--
--   share_token — 32 random bytes, base64url. Minted on demand (not at
--     booking time). NULL = no active share. Partial-UNIQUE so two
--     bookings can't collide on a minted token while NULLs are unbounded.
--   share_note  — optional personal note (<=500 chars) shown on the view.
--
-- No RLS change: the booker mints/revokes through Server Actions (RLS read
-- proves household ownership, service role writes); the public /trip route
-- reads via service role with an explicit column allowlist (it's anonymous,
-- so it can't ride member RLS). The finalized gate (bid signed + deposit
-- paid) is enforced in the read service, not here.

alter table public.bookings
  add column if not exists share_token text,
  add column if not exists share_note text;

create unique index if not exists bookings_share_token_key
  on public.bookings (share_token)
  where share_token is not null;

do $$ begin
  alter table public.bookings
    add constraint bookings_share_note_len
    check (share_note is null or char_length(share_note) <= 500);
exception when duplicate_object then null; end $$;

comment on column public.bookings.share_token is
  'Opaque bearer token (32 random bytes, base64url) for an anonymous, read-only shared trip view at /trip/<token>. Minted on demand by the booker; NULL = no active share. Resolves to a payload only when the booking is finalized (bid signed + deposit paid).';
comment on column public.bookings.share_note is
  'Optional personal note (<=500 chars) the booker attaches to the shared trip view.';
