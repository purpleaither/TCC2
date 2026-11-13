-- Execute esta migração uma vez no SQL Editor do Supabase.
-- Histórico de sessões concluídas com cópia da ficha vigente no momento do registro.
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  exercises jsonb not null check (jsonb_typeof(exercises) = 'array' and jsonb_array_length(exercises) between 1 and 100)
);
create index if not exists idx_workout_sessions_patient_date
  on public.workout_sessions(patient_id, completed_at desc);

alter table public.workout_sessions enable row level security;
revoke all on public.workout_sessions from anon, authenticated;
grant select, insert on public.workout_sessions to authenticated;

drop policy if exists "workout sessions read self or linked professional" on public.workout_sessions;
create policy "workout sessions read self or linked professional"
on public.workout_sessions for select to authenticated
using (
  patient_id = (select auth.uid())
  or (
    private.is_professional((select auth.uid()))
    and private.has_care_link((select auth.uid()), patient_id)
  )
);

drop policy if exists "workout sessions insert by patient" on public.workout_sessions;
create policy "workout sessions insert by patient"
on public.workout_sessions for insert to authenticated
with check (
  patient_id = (select auth.uid())
  and not private.is_professional((select auth.uid()))
);
