-- Chart of Accountability — the company org structure as editable data.
--
-- Replaces the standalone public/rhythm-accountability.html prototype (which was
-- world-readable and hand-edited) with a dashboard-editable, behind-the-wall
-- feature. Follows the same access model as staff_profiles: RLS enabled with NO
-- policies (deny-by-default), reached only through service-role server code that
-- is gated in app layer (hasAdminAccess for reads, canManageTeam for writes).

create table if not exists public.org_seats (
  id               uuid primary key default gen_random_uuid(),
  -- null / empty name => an unfilled "open seat"
  name             text,
  title            text not null,
  division         text not null check (division in (
                     'ownership','executive','central','media',
                     'hogheaven','horseshoebay','packsaddle')),
  accountabilities text[] not null default '{}',
  status           text not null default 'active' check (status in (
                     'active','open','hopeful')),
  email            text,
  phone            text,
  -- reporting line; null = apex (the founders). Deleting a manager re-parents
  -- their reports to null rather than cascading the whole branch away.
  parent_id        uuid references public.org_seats(id) on delete set null,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists org_seats_parent_id_idx on public.org_seats (parent_id);

comment on table public.org_seats is
  'Chart of Accountability — every seat in the org and its reporting line. Self-referential via parent_id. RLS on with no policies (deny-by-default); accessed only by service-role admin-gated server code, like staff_profiles.';

-- Deny-by-default. No policies are created on purpose: every read/write goes
-- through the service-role client in admin-gated server code.
alter table public.org_seats enable row level security;

-- ---------------------------------------------------------------------------
-- Seed: the current org chart, ported from public/rhythm-accountability.html.
-- Fixed UUIDs keep parent references stable and make the seed idempotent.
-- ---------------------------------------------------------------------------
insert into public.org_seats
  (id, name, title, division, accountabilities, status, email, parent_id, sort_order)
values
  -- Ownership (apex)
  ('a1000000-0000-4000-8000-000000000001','Nicholas Vedros','Founder / Owner','ownership',
    array['Business Vision','Legal & Financial Oversight','Strategic Relationships & Expansion'],'active','nicholas.vedros@rhythm.co',null,1),
  ('a1000000-0000-4000-8000-000000000002','Hannah Vedros','Founder / Owner','ownership',
    array['Experience Vision','Expense Recording & Payroll','Human Resources'],'active','hannah.vedros@rhythm.co',null,2),

  -- Executive
  ('a1000000-0000-4000-8000-000000000003','Savannah Ames','Chief Financial Officer','executive',
    array['Financial Planning','Financial Accounting','Taxes'],'active','savannah.ames@rhythm.co','a1000000-0000-4000-8000-000000000001',3),
  ('a1000000-0000-4000-8000-000000000004','PJ Ajibola','Bookkeeping & Office Admin','executive',
    array['Bookkeeping · AP / AR','Financial Reporting','Office Administration'],'active','pj.ajibola@rhythm.co','a1000000-0000-4000-8000-000000000003',4),
  ('a1000000-0000-4000-8000-000000000005','Jeff Blackburn','Chief Operating Officer','executive',
    array['Operations Oversight','Process Capture & Creation','Organizational Design'],'active','jeff.blackburn@rhythm.co','a1000000-0000-4000-8000-000000000001',5),

  -- Rhythm Central (reports to COO)
  ('a1000000-0000-4000-8000-000000000006','Ryan Schweke','Director of Marketing','central',
    array['Brand Management','Membership Growth & Retention','Digital Event Sales'],'active','ryan.schweke@rhythm.co','a1000000-0000-4000-8000-000000000005',6),
  ('a1000000-0000-4000-8000-000000000007','Laryd Dugat','Marketing Coordinator','central',
    array['Recurring Marketing · HH','Recurring Marketing · HSB SC','Project Support'],'active','laryd.dugat@rhythm.co','a1000000-0000-4000-8000-000000000006',7),
  -- Rhythm Media (under Marketing)
  ('a1000000-0000-4000-8000-000000000008','Christine Tolson','Executive Producer','media',
    array['Content Strategy & IP Development','Content Production','Production Management'],'active','christine.tolson@rhythm.co','a1000000-0000-4000-8000-000000000006',8),
  ('a1000000-0000-4000-8000-000000000009',null,'Editor / Story Director','media',
    array['Edit & Story Direction','Post-Production Pipeline','Narrative & IP Continuity'],'open',null,'a1000000-0000-4000-8000-000000000008',9),
  ('a1000000-0000-4000-8000-000000000010',null,'Camera Operator / 1st AC','media',
    array['Principal Photography','Camera & Lens Management','On-Set Production Support'],'open',null,'a1000000-0000-4000-8000-000000000008',10),

  ('a1000000-0000-4000-8000-000000000011','Jake Saenz','Education & Adventure Architect','central',
    array['Strategic E&A Programming','Curriculum Design & Approval','Instructor Standards & Cadre Development'],'active','jake.saenz@rhythm.co','a1000000-0000-4000-8000-000000000005',11),
  ('a1000000-0000-4000-8000-000000000012','John Johnson','Lead Pistol Instructor','central',
    array['Pistol Program Delivery','Curriculum Execution','Cadre Standards'],'active','john.johnson@rhythm.co','a1000000-0000-4000-8000-000000000011',12),
  ('a1000000-0000-4000-8000-000000000013','Cooper Weatherby','Lead Rifle Instructor','central',
    array['Rifle & Precision Instruction','Curriculum Execution','Cadre Standards'],'active','cooper.weatherby@rhythm.co','a1000000-0000-4000-8000-000000000011',13),
  ('a1000000-0000-4000-8000-000000000014','Madison Sharpe','Lead Shotgun Instructor','central',
    array['Shotgun Program Delivery','Curriculum Execution','Cadre Standards'],'active','madison.sharpe@rhythm.co','a1000000-0000-4000-8000-000000000011',14),
  ('a1000000-0000-4000-8000-000000000015',null,'Director of Programming & Events','central',
    array['Community & Culinary Programming','Event Systems & Logistics','Cross-Pillar CLEAR Integration'],'open',null,'a1000000-0000-4000-8000-000000000005',15),

  -- Hog Heaven Sporting Club
  ('a1000000-0000-4000-8000-000000000016','Brandon Evans','General Manager · Hog Heaven','hogheaven',
    array['HH Facility Operations Oversight','Admin Approvals & Payroll','Membership Experience'],'hopeful','brandon.evans@rhythm.co','a1000000-0000-4000-8000-000000000005',16),
  ('a1000000-0000-4000-8000-000000000017','Georgia Stone','Director of Event Sales & Relationships','hogheaven',
    array['Event Sales Outreach','Membership Sales Outreach','CRM Database Management'],'active','georgia.stone@rhythm.co','a1000000-0000-4000-8000-000000000016',17),
  ('a1000000-0000-4000-8000-000000000018','Courtney Ward','Assistant General Manager','hogheaven',
    array['GM Support','Club Admin & Office Processes','Member Support & Reporting'],'active','courtney.ward@rhythm.co','a1000000-0000-4000-8000-000000000016',18),
  ('a1000000-0000-4000-8000-000000000019','Zannah Ward','Events Coordinator','hogheaven',
    array['Event Sales / Planning / Coordination','Property Management Support','Office & Member Support'],'active','zannah.ward@rhythm.co','a1000000-0000-4000-8000-000000000016',19),
  ('a1000000-0000-4000-8000-000000000020','Luke Benton','Sr. Ranch Hand','hogheaven',
    array['Facility Presentation','Managing Ranch Hands','Machine / Clay Inventory & Maintenance'],'active','luke.benton@rhythm.co','a1000000-0000-4000-8000-000000000016',20),
  ('a1000000-0000-4000-8000-000000000021','Caleb Reese','Ranch Hand','hogheaven',
    array['Member Hospitality','Facility Upkeep','Event Preparation'],'active','caleb.reese@rhythm.co','a1000000-0000-4000-8000-000000000020',21),
  ('a1000000-0000-4000-8000-000000000022','Joshua Gray','Ranch Hand','hogheaven',
    array['Member Hospitality','Facility Upkeep','Event Preparation'],'active','joshua.gray@rhythm.co','a1000000-0000-4000-8000-000000000020',22),
  ('a1000000-0000-4000-8000-000000000023',null,'Ranch Hand','hogheaven',
    array['Member Hospitality','Facility Upkeep','Event Preparation'],'open',null,'a1000000-0000-4000-8000-000000000020',23),

  -- Horseshoe Bay Sporting Club
  ('a1000000-0000-4000-8000-000000000024','Adam McCaw','General Manager · Horseshoe Bay','horseshoebay',
    array['HSB Membership Experience','HSB Operations','HSB Facility Oversight'],'active','adam.mccaw@rhythm.co','a1000000-0000-4000-8000-000000000005',24),
  ('a1000000-0000-4000-8000-000000000025','Cuatro Smith','Sales & Partnerships','horseshoebay',
    array['Event Sales Outreach','Membership Sales Outreach','CRM Database Management'],'active','cuatro.smith@rhythm.co','a1000000-0000-4000-8000-000000000024',25),
  ('a1000000-0000-4000-8000-000000000026','Cassi Payne','Assistant General Manager','horseshoebay',
    array['Membership Hospitality','Front Desk Functions','Event Sales & Execution'],'active','cassi.payne@rhythm.co','a1000000-0000-4000-8000-000000000024',26),
  ('a1000000-0000-4000-8000-000000000027','Marlee','Assistant to the Assistant','horseshoebay',
    array['AGM Support','Front Desk & Member Support','Event & Office Coordination'],'active','marlee@rhythm.co','a1000000-0000-4000-8000-000000000026',27),
  ('a1000000-0000-4000-8000-000000000028',null,'Bartender','horseshoebay',
    array['Membership Hospitality','Bar & Beverage Service','Event Support'],'open',null,'a1000000-0000-4000-8000-000000000026',28),
  ('a1000000-0000-4000-8000-000000000029','Michael Gutierrez','Sr. Ranch Hand','horseshoebay',
    array['Facility Presentation','Managing Ranch Hands','Machine / Clay Inventory & Maintenance'],'active','michael.gutierrez@rhythm.co','a1000000-0000-4000-8000-000000000024',29),
  ('a1000000-0000-4000-8000-000000000030','Will De Dufour','Ranch Hand','horseshoebay',
    array['Member Hospitality','Facility Upkeep','Event Preparation'],'active','will.dufour@rhythm.co','a1000000-0000-4000-8000-000000000029',30),
  ('a1000000-0000-4000-8000-000000000031','Joe Portillo','Ranch Hand','horseshoebay',
    array['Member Hospitality','Facility Upkeep','Event Preparation'],'active','joe.portillo@rhythm.co','a1000000-0000-4000-8000-000000000029',31),
  ('a1000000-0000-4000-8000-000000000032','Chase Giddens','Ranch Hand','horseshoebay',
    array['Member Hospitality','Facility Upkeep','Event Preparation'],'active','chase.giddens@rhythm.co','a1000000-0000-4000-8000-000000000029',32),
  ('a1000000-0000-4000-8000-000000000033','Bill Hamilton','Ranch Hand','horseshoebay',
    array['Member Hospitality','Facility Upkeep','Event Preparation'],'active','bill.hamilton@rhythm.co','a1000000-0000-4000-8000-000000000029',33),

  -- Packsaddle Precision
  ('a1000000-0000-4000-8000-000000000034','Casey Duran','Senior Instructor · Packsaddle','packsaddle',
    array['Primary Instruction & Delivery','Training Module Curriculum','Brand Culture & Media Experience'],'active','casey.duran@rhythm.co','a1000000-0000-4000-8000-000000000005',34),
  ('a1000000-0000-4000-8000-000000000035',null,'Assistant General Manager','packsaddle',
    array['GM Support','Club Admin & Office Processes','Member Support & Reporting'],'open',null,'a1000000-0000-4000-8000-000000000034',35),
  ('a1000000-0000-4000-8000-000000000036',null,'Sr. Ranch Hand','packsaddle',
    array['Facility Presentation','Managing Ranch Hands','Machine / Clay Inventory & Maintenance'],'open',null,'a1000000-0000-4000-8000-000000000034',36),
  ('a1000000-0000-4000-8000-000000000037',null,'Ranch Hand','packsaddle',
    array['Member Hospitality','Facility Upkeep','Event Preparation'],'open',null,'a1000000-0000-4000-8000-000000000034',37)
on conflict (id) do nothing;
