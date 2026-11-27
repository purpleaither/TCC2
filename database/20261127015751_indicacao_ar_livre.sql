alter table public.plan_exercises
  add column if not exists indicacao_ar_livre boolean not null default false;

-- Atualiza o plano autorizado para notificar seu paciente pelo Realtime.
-- A função executa com as permissões de quem alterou o exercício.
create or replace function private.notificar_indicacao_ar_livre()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  plano_anterior uuid;
  plano_atual uuid;
begin
  if tg_op <> 'INSERT' then
    if old.indicacao_ar_livre then plano_anterior := old.plan_id; end if;
  end if;
  if tg_op <> 'DELETE' then
    if new.indicacao_ar_livre then plano_atual := new.plan_id; end if;
  end if;

  if plano_anterior is not null or plano_atual is not null then
    update public.care_plans
    set updated_at = statement_timestamp()
    where id in (plano_anterior, plano_atual);
  end if;
  return null;
end;
$$;

revoke all on function private.notificar_indicacao_ar_livre() from public;

create or replace trigger notificar_indicacao_ar_livre
after insert or update or delete on public.plan_exercises
for each row execute function private.notificar_indicacao_ar_livre();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'care_plans'
  ) then
    alter publication supabase_realtime add table public.care_plans;
  end if;
end;
$$;
