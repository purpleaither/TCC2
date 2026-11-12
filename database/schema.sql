create schema if not exists private;
revoke all on schema private from public;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (char_length(display_name) between 2 and 120),
 role text not null check (role in ('fisioterapeuta','paciente'))
);

create table if not exists public.care_links (
 physiotherapist_id uuid not null references public.profiles(id),
 patient_id uuid not null references public.profiles(id),
 primary key (physiotherapist_id, patient_id),
 check (physiotherapist_id <> patient_id)
);

create table if not exists public.care_plans (
 id uuid primary key default gen_random_uuid(),
 physiotherapist_id uuid not null references public.profiles(id),
 patient_id uuid not null references public.profiles(id),
 title text not null check (char_length(title) between 2 and 120),
 notes text not null default '' check (char_length(notes) <= 1000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key (physiotherapist_id,patient_id) references public.care_links(physiotherapist_id,patient_id)
);

create table if not exists public.plan_exercises (
 id uuid primary key default gen_random_uuid(),
 plan_id uuid not null references public.care_plans(id) on delete cascade,
 exercise_name text not null check (char_length(exercise_name) between 2 and 160),
 exercise_source text not null default 'manual',
 external_id text,
 series smallint check (series between 1 and 20),
 repetitions text check (char_length(repetitions) <= 60),
 duration text check (char_length(duration) <= 60),
 frequency text not null check (char_length(frequency) between 1 and 80),
 instructions text not null default '' check (char_length(instructions) <= 500),
 position smallint not null default 0
);

create table if not exists public.symptom_records (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid not null references public.profiles(id),
 recorded_at timestamptz not null default now(),
 pain_rest smallint not null check (pain_rest between 0 and 10),
 pain_movement smallint not null check (pain_movement between 0 and 10),
 stiffness text not null check (stiffness in ('Nenhuma','Leve','Moderada','Intensa')),
 fatigue text not null check (fatigue in ('Nenhuma','Leve','Moderada','Intensa'))
);

create index if not exists idx_care_links_patient on public.care_links(patient_id);
create index if not exists idx_care_plans_patient on public.care_plans(patient_id);
create index if not exists idx_care_plans_prof on public.care_plans(physiotherapist_id);
create index if not exists idx_plan_exercises_plan on public.plan_exercises(plan_id);
create index if not exists idx_symptom_records_patient_date on public.symptom_records(patient_id,recorded_at desc);

create or replace function private.has_care_link(p_prof uuid,p_patient uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
 select exists(
  select 1 from public.care_links cl
  where cl.physiotherapist_id=p_prof and cl.patient_id=p_patient
 );
$$;

create or replace function private.is_professional(p_user uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
 select exists(
  select 1 from public.profiles
  where id=p_user and role='fisioterapeuta'
 );
$$;

create or replace function private.can_read_plan(p_plan uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
 select exists (
  select 1 from public.care_plans p
  where p.id=p_plan and (
   p.patient_id=(select auth.uid())
   or (p.physiotherapist_id=(select auth.uid()) and private.has_care_link(p.physiotherapist_id,p.patient_id))
  )
 );
$$;

create or replace function private.can_edit_plan(p_plan uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
 select exists (
  select 1 from public.care_plans p
  where p.id=p_plan and p.physiotherapist_id=(select auth.uid())
  and private.is_professional((select auth.uid()))
  and private.has_care_link(p.physiotherapist_id,p.patient_id)
 );
$$;

revoke all on function private.has_care_link(uuid,uuid) from public;
revoke all on function private.is_professional(uuid) from public;
revoke all on function private.can_read_plan(uuid) from public;
revoke all on function private.can_edit_plan(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.has_care_link(uuid,uuid) to authenticated;
grant execute on function private.is_professional(uuid) to authenticated;
grant execute on function private.can_read_plan(uuid) to authenticated;
grant execute on function private.can_edit_plan(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.care_links enable row level security;
alter table public.care_plans enable row level security;
alter table public.plan_exercises enable row level security;
alter table public.symptom_records enable row level security;

revoke all on public.profiles,public.care_links,public.care_plans,public.plan_exercises,public.symptom_records from anon,authenticated;
grant select on public.profiles,public.care_links,public.care_plans,public.plan_exercises,public.symptom_records to authenticated;
grant insert,update,delete on public.care_plans,public.plan_exercises to authenticated;
grant insert on public.symptom_records to authenticated;

create policy "profile read linked" on public.profiles for select to authenticated
using (
 id=(select auth.uid())
 or (role='paciente' and private.has_care_link((select auth.uid()),id))
 or (role='fisioterapeuta' and private.has_care_link(id,(select auth.uid())))
);
create policy "links read participants" on public.care_links for select to authenticated
using (physiotherapist_id=(select auth.uid()) or patient_id=(select auth.uid()));

create policy "plans read participants" on public.care_plans for select to authenticated
using (patient_id=(select auth.uid()) or (physiotherapist_id=(select auth.uid()) and private.has_care_link(physiotherapist_id,patient_id)));
create policy "plans insert by linked professional" on public.care_plans for insert to authenticated
with check (physiotherapist_id=(select auth.uid()) and private.is_professional((select auth.uid())) and private.has_care_link(physiotherapist_id,patient_id));
create policy "plans update by linked professional" on public.care_plans for update to authenticated
using (physiotherapist_id=(select auth.uid()) and private.is_professional((select auth.uid())) and private.has_care_link(physiotherapist_id,patient_id))
with check (physiotherapist_id=(select auth.uid()) and private.is_professional((select auth.uid())) and private.has_care_link(physiotherapist_id,patient_id));
create policy "plans delete by linked professional" on public.care_plans for delete to authenticated
using (physiotherapist_id=(select auth.uid()) and private.is_professional((select auth.uid())) and private.has_care_link(physiotherapist_id,patient_id));

create policy "exercises read plan participants" on public.plan_exercises for select to authenticated
using (private.can_read_plan(plan_id));
create policy "exercises insert by plan professional" on public.plan_exercises for insert to authenticated
with check (private.can_edit_plan(plan_id));
create policy "exercises update by plan professional" on public.plan_exercises for update to authenticated
using (private.can_edit_plan(plan_id)) with check (private.can_edit_plan(plan_id));
create policy "exercises delete by plan professional" on public.plan_exercises for delete to authenticated
using (private.can_edit_plan(plan_id));

create policy "symptoms read self or linked professional" on public.symptom_records for select to authenticated
using (patient_id=(select auth.uid()) or (private.is_professional((select auth.uid())) and private.has_care_link((select auth.uid()),patient_id)));
create policy "symptoms insert self" on public.symptom_records for insert to authenticated
with check (patient_id=(select auth.uid()) and not private.is_professional((select auth.uid())));
