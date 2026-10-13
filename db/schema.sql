-- TriageLane database schema (PostgreSQL / Supabase)
-- Run in Supabase SQL editor, then run db/seed.ts (loads data/*.json).
-- Draft for a hackathon prototype: review RLS and retention before any real use.

create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type user_role   as enum ('receptionist','nurse','doctor','admin');
create type level_t     as enum ('IMMEDIATE','SOON','ROUTINE');
create type visit_status as enum (
  'registered',      -- receptionist submitted, awaiting nurse
  'with_nurse',      -- nurse is taking vitals / details
  'waiting',         -- triaged, waiting for doctor
  'called',          -- called to room
  'in_consult',
  'done',
  'skipped',         -- did not show when called
  'sent_emergency',  -- moved to casualty
  'left'             -- left without being seen
);
create type proposal_status as enum ('pending','accepted','modified','rejected');
create type notif_status as enum ('queued','sent','delivered','failed','skipped');

-- ---------- reference data ----------
create table departments (
  id text primary key,                 -- e.g. GEN_MED
  name_en text not null,
  name_hi text not null,
  avg_consult_minutes int not null default 6,
  is_emergency boolean not null default false,
  active boolean not null default true
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  department_id text references departments(id),
  label text not null,                 -- 'Room 4'
  doctor_id uuid,                      -- optional link to profiles.id
  active boolean not null default true
);

create table profiles (                -- 1:1 with auth.users
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null,
  department_id text references departments(id),   -- nurse/doctor home dept
  language text not null default 'hi',
  created_at timestamptz not null default now()
);

create table symptom_tags (
  id text primary key,
  en text not null,
  hi text not null,
  is_tile boolean not null default false,
  suggested_dept text references departments(id),
  red_flag_candidate boolean not null default false,
  synonyms text[] not null default '{}',
  status text not null default 'approved'       -- 'approved' | 'proposed'
);

create table rule_sets (
  version text primary key,
  definition jsonb not null,                    -- contents of data/rules.json
  status text not null default 'draft',         -- draft | approved | retired
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table app_settings (
  key text primary key,
  value jsonb not null
);
-- keys: escalation_minutes {IMMEDIATE:5,SOON:30,ROUTINE:120}, season, show_group_to_patient(false),
--       notify_max_per_hour, active_rule_version, hospital_name

-- ---------- patients (persistent) ----------
create table patients (
  id uuid primary key default gen_random_uuid(),
  uhid text unique,                              -- hospital OPD card no. (optional)
  full_name text not null,
  sex text not null check (sex in ('M','F','O')),
  birth_year int,                                -- or approximate age at registration
  age_years_at_registration int,
  phone text,                                    -- may be a family phone shared by several patients
  phone_is_shared boolean not null default false,
  consent_notify boolean not null default false,
  consent_at timestamptz,
  preferred_channel text default 'whatsapp',     -- whatsapp | sms | telegram | none
  language text default 'hi',
  locality text,                                 -- village / colony (optional)
  conditions text[] not null default '{}',       -- ids from conditions list; nurse-verified
  conditions_verified_at timestamptz,
  allergies text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on patients (phone);
create index on patients using gin (to_tsvector('simple', full_name));

-- ---------- visits ----------
create table token_counters (
  department_id text references departments(id),
  day date,
  last_no int not null default 0,
  primary key (department_id, day)
);

create or replace function next_token(dept text) returns int language plpgsql as $$
declare n int;
begin
  insert into token_counters(department_id, day, last_no) values (dept, current_date, 1)
  on conflict (department_id, day) do update set last_no = token_counters.last_no + 1
  returning last_no into n;
  return n;
end $$;

create table visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  department_id text not null references departments(id),
  token_no int not null,
  token_label text generated always as (department_id || '-' || lpad(token_no::text, 3, '0')) stored,
  visit_date date not null default current_date,
  status_code text not null default encode(gen_random_bytes(5),'hex'),  -- unguessable id for public status page
  is_revisit boolean not null default false,
  revisit_of uuid references visits(id),
  visit_type text not null default 'new',       -- new | follow_up | refill

  symptom_tags text[] not null default '{}',    -- tiles + follow-ups selected
  free_text text,
  unmatched_text boolean not null default false,
  vitals jsonb not null default '{}'::jsonb,    -- {rr,spo2,sbp,dbp,hr,temp_c,consciousness,glucose_mgdl,pain_0_10}
  vitals_taken_at timestamptz,

  -- triage result
  level level_t not null default 'SOON',
  level_source text not null default 'system',  -- system | nurse
  reason_en text,
  reason_hi text,
  fired_rules text[] not null default '{}',
  rule_version text,
  tasks text[] not null default '{}',
  needs_verification boolean not null default false,

  -- queue
  sort_key double precision not null default extract(epoch from now()),  -- nurse reorder via fractional index
  status visit_status not null default 'registered',
  room_id uuid references rooms(id),
  registered_at timestamptz not null default now(),
  triaged_at timestamptz,
  called_at timestamptz,
  consult_start timestamptz,
  consult_end timestamptz,
  registered_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique (department_id, visit_date, token_no)
);
create index on visits (department_id, status, level, sort_key);
create index on visits (patient_id, registered_at desc);

-- ---------- LLM proposals for unusual symptoms ----------
create table symptom_proposals (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  raw_text text not null,
  matched_tags text[] not null default '{}',
  new_phrases jsonb not null default '[]',      -- [{phrase, english, body_system, dept, possible_red_flag, confidence}]
  model text,
  status proposal_status not null default 'pending',
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  final_tags text[],
  final_level level_t,
  nurse_note text,
  add_to_catalog boolean not null default false,  -- nurse asks clinical admin to add as tag/synonym
  created_at timestamptz not null default now()
);

-- ---------- audit (append-only) ----------
create table triage_events (
  id bigserial primary key,
  visit_id uuid not null references visits(id),
  type text not null,   -- registered | suggested | vitals_added | llm_suggested | verified | overridden | reordered |
                        -- department_changed | escalated | called | seen | skipped | sent_emergency | notified
  from_level level_t,
  to_level level_t,
  reason_code text,
  note text,
  fired_rules text[],
  rule_version text,
  payload jsonb,
  actor uuid references profiles(id),           -- null = system
  created_at timestamptz not null default now()
);
create index on triage_events (visit_id, created_at);

create or replace function forbid_event_changes() returns trigger language plpgsql as $$
begin raise exception 'triage_events is append-only'; end $$;
create trigger triage_events_no_update before update or delete on triage_events
  for each row execute function forbid_event_changes();

-- ---------- notifications ----------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id),
  template text not null,                       -- N1_registered ... N8_delay
  channel text not null,                        -- whatsapp | sms | telegram | display
  dedupe_key text not null,                     -- visit_id|template|position_bucket
  payload jsonb,
  status notif_status not null default 'queued',
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (dedupe_key)
);

-- ---------- queue view ----------
create view v_queue as
select v.*,
  case v.level when 'IMMEDIATE' then 1 when 'SOON' then 2 else 3 end as level_rank,
  row_number() over (
    partition by v.department_id
    order by case v.level when 'IMMEDIATE' then 1 when 'SOON' then 2 else 3 end, v.sort_key
  ) as position,
  extract(epoch from (now() - v.registered_at))/60 as waited_minutes
from visits v
where v.status in ('registered','with_nurse','waiting','called')
  and v.visit_date = current_date;

-- ---------- row level security (sketch) ----------
alter table patients enable row level security;
alter table visits enable row level security;
alter table triage_events enable row level security;
alter table symptom_proposals enable row level security;
alter table notifications enable row level security;

create or replace function my_role() returns user_role language sql stable as
  $$ select role from profiles where id = auth.uid() $$;

-- staff of any role can read; writes limited by role (tighten per table in Phase 2)
create policy staff_read_patients on patients for select using (auth.uid() is not null);
create policy staff_write_patients on patients for all
  using (my_role() in ('receptionist','nurse','admin')) with check (my_role() in ('receptionist','nurse','admin'));
create policy staff_read_visits on visits for select using (auth.uid() is not null);
create policy reception_insert_visits on visits for insert with check (my_role() in ('receptionist','nurse','admin'));
create policy nurse_update_visits on visits for update using (my_role() in ('nurse','doctor','admin'));
create policy staff_read_events on triage_events for select using (auth.uid() is not null);
create policy staff_insert_events on triage_events for insert with check (auth.uid() is not null);
create policy nurse_proposals on symptom_proposals for all using (my_role() in ('nurse','admin','receptionist'));
-- Public status page and display board use a server route with the service key and return only
-- token label, department, position, ETA and generic wait reason (never names or symptoms).
