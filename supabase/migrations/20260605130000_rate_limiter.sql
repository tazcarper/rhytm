-- ============================================================
-- Lightweight Postgres-backed rate limiter (serverless-safe)
-- ============================================================
-- Throttles the anonymous public write endpoints (public booking submit +
-- walk-in waiver kiosk) without new infrastructure. One row per request
-- "hit"; check_rate_limit counts hits for a key within a sliding window and
-- records the new hit atomically. Works across serverless instances because
-- the state lives in Postgres, not process memory.

create table if not exists public.rate_limit_hits (
  id         bigint generated always as identity primary key,
  key        text        not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_key_time_idx
  on public.rate_limit_hits (key, created_at);

alter table public.rate_limit_hits enable row level security;
-- No policies: only the SECURITY DEFINER function below + the service role
-- touch this table (deny-by-default for anon/authenticated).

-- Returns true if the caller is UNDER the limit (request allowed) and records
-- the hit; false if at/over the limit. SECURITY DEFINER + locked-down EXECUTE
-- (service_role only) so it can't be probed directly by clients.
create or replace function public.check_rate_limit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count  integer;
  v_cutoff timestamptz := now() - make_interval(secs => p_window_seconds);
begin
  -- Bound this key's history to the window — keeps the table small for active
  -- keys; idle keys age out the next time their key is touched.
  delete from rate_limit_hits where key = p_key and created_at < v_cutoff;

  select count(*) into v_count
  from rate_limit_hits
  where key = p_key and created_at >= v_cutoff;

  if v_count >= p_limit then
    return false;
  end if;

  insert into rate_limit_hits (key) values (p_key);
  return true;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
