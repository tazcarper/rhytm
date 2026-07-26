-- ============================================================
--  RHYTHM OUTDOORS - FORM BUILDER
--  Supabase setup. Run this ONCE, top to bottom.
--  Dashboard -> SQL Editor -> paste -> Run.
--
--  Everything here is idempotent. Running it twice is safe.
--
--  Two tables:
--    events   a dated thing you attend and register for
--    posts    a short piece of writing on the Club Life page
--
--  Plus one public storage bucket for images.
-- ============================================================


-- ------------------------------------------------------------
--  1. EVENTS
--
--  `date` is nullable, because a Standing programme (Hog Heaven PT, say)
--  runs indefinitely and has no single date. It carries a `schedule` string
--  instead, e.g. "Tuesday and Thursday 7:30 AM, Saturday 8:00 AM".
--
--  `published = false` is a draft. It never reaches the site.
-- ------------------------------------------------------------
create table if not exists public.events (
  id                        text primary key,
  club                      text not null,
  name                      text not null,
  type                      text not null,   -- Training | League | Tournament | Social | Adventure | Standing
  discipline                text,
  status                    text,            -- Members & Public | Members Only
  included_with_membership  boolean default false,
  featured                  boolean default false,
  published                 boolean not null default true,
  recurring                 boolean default false,
  additional_dates          jsonb   default '[]'::jsonb,
  date                      text,            -- null for Standing programmes
  schedule                  text,            -- Standing programmes only
  start_time                text,
  end_time                  text,
  location                  text,
  instructors               text,
  required_gear             jsonb   default '[]'::jsonb,
  capacity                  text,
  member_price              text,
  non_member_price          text,
  registration_url          text,
  image                     text,
  description               text,
  description_long          text,
  what_to_expect            jsonb   default '[]'::jsonb,
  created_at                timestamptz default now()
);

create index if not exists events_club_idx      on public.events (club);
create index if not exists events_published_idx on public.events (published, date);


-- ------------------------------------------------------------
--  2. POSTS
--
--  A post is not an event. Nothing to attend, nothing to register for.
--  It is short and complete: the card on the site IS the post, so `body`
--  holds the whole thing and there is no page to click through to.
--
--  `link_url` / `link_label` are an optional call to action. Some posts
--  want one ("Book a Lesson"), most do not.
-- ------------------------------------------------------------
create table if not exists public.posts (
  id            text primary key,
  club          text not null,
  category      text not null default 'Announcement',  -- Announcement | Recap | Spotlight | Story
  title         text not null,
  body          text not null default '',
  image         text,
  published_at  date not null default current_date,
  featured      boolean not null default false,        -- anchors the top of Club Life
  published     boolean not null default true,         -- false = draft
  link_url      text,
  link_label    text,
  created_at    timestamptz not null default now()
);

create index if not exists posts_club_idx      on public.posts (club);
create index if not exists posts_published_idx on public.posts (published, published_at desc);


-- ------------------------------------------------------------
--  3. ROW LEVEL SECURITY
--
--  Read is scoped to `published = true`. That is what makes the Draft toggle
--  real: an unpublished row is refused by the database, not merely hidden by
--  the site's code. Nobody can pull a draft out with the public key.
--
--  Writes are open because the Form Builder is not public. If the builder
--  ever gets a URL that anyone could find, tighten these first.
-- ------------------------------------------------------------
alter table public.events enable row level security;
alter table public.posts  enable row level security;

drop policy if exists "events public read" on public.events;
drop policy if exists "events write"       on public.events;
drop policy if exists "events update"      on public.events;
drop policy if exists "events delete"      on public.events;

create policy "events public read" on public.events for select using ( published = true );
create policy "events write"       on public.events for insert with check ( true );
create policy "events update"      on public.events for update using ( true ) with check ( true );
create policy "events delete"      on public.events for delete using ( true );

drop policy if exists "posts public read" on public.posts;
drop policy if exists "posts write"       on public.posts;
drop policy if exists "posts update"      on public.posts;
drop policy if exists "posts delete"      on public.posts;

create policy "posts public read" on public.posts for select using ( published = true );
create policy "posts write"       on public.posts for insert with check ( true );
create policy "posts update"      on public.posts for update using ( true ) with check ( true );
create policy "posts delete"      on public.posts for delete using ( true );


-- ------------------------------------------------------------
--  4. IMAGE STORAGE
--  One public bucket. The Form Builder crops and uploads to it.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

drop policy if exists "event-images read"   on storage.objects;
drop policy if exists "event-images upload" on storage.objects;
drop policy if exists "event-images update" on storage.objects;

create policy "event-images read"   on storage.objects for select using ( bucket_id = 'event-images' );
create policy "event-images upload" on storage.objects for insert with check ( bucket_id = 'event-images' );
create policy "event-images update" on storage.objects for update using ( bucket_id = 'event-images' ) with check ( bucket_id = 'event-images' );


-- ------------------------------------------------------------
--  5. UPGRADING AN OLDER PROJECT
--
--  `create table if not exists` will NOT add columns to a table that already
--  exists. If you are running this against a project that predates Standing
--  programmes or Drafts, run these too. They are safe to run any time.
-- ------------------------------------------------------------
alter table public.events add column if not exists published     boolean not null default true;
alter table public.events add column if not exists schedule      text;
alter table public.events add column if not exists required_gear jsonb default '[]'::jsonb;
alter table public.events add column if not exists description_long text;
alter table public.events alter column date drop not null;

alter table public.posts  add column if not exists link_url   text;
alter table public.posts  add column if not exists link_label text;
alter table public.posts  add column if not exists published  boolean not null default true;
alter table public.posts  add column if not exists featured   boolean not null default false;


-- ------------------------------------------------------------
--  6. CHECK IT WORKED
--
--  Run this AFTER the script above. It answers one question: does the live
--  database match this file? If it does, this file is the only thing you need
--  to keep, and any other saved SQL snippets can be thrown away.
--
--  Expect 25 columns on events and 11 on posts. If you see a column here that
--  is NOT declared in section 1 or 2, then something was run somewhere else
--  that this script does not know about. Find out what it was BEFORE deleting
--  any saved snippets, because that snippet is the only record of it.
-- ------------------------------------------------------------
select table_name,
       count(*) as columns,
       string_agg(column_name, ', ' order by ordinal_position) as the_columns
from   information_schema.columns
where  table_schema = 'public'
  and  table_name in ('events','posts')
group  by table_name;

-- RLS must be ON for both, or the draft toggle is decorative.
select relname as table_name, relrowsecurity as rls_on
from   pg_class
where  relname in ('events','posts');

-- Expect 4 policies per table: read, insert, update, delete.
select tablename, policyname, cmd
from   pg_policies
where  tablename in ('events','posts')
order  by tablename, cmd;

-- The image bucket must exist and be public.
select id, public from storage.buckets where id = 'event-images';
