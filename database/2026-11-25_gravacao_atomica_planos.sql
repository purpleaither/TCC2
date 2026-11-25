begin;

-- A função opera com as permissões de quem a chama e segue as políticas RLS existentes.
create or replace function public.gravar_plano(
  p_plano uuid,
  p_paciente uuid,
  p_titulo text,
  p_notas text,
  p_itens jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  plano_salvo uuid;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then
    raise exception 'Informe os exercícios do plano' using errcode = '22023';
  end if;
  if jsonb_array_length(p_itens) = 0 then
    raise exception 'Informe os exercícios do plano' using errcode = '22023';
  end if;

  if p_plano is null then
    insert into public.care_plans (patient_id, physiotherapist_id, title, notes)
    values (p_paciente, auth.uid(), p_titulo, p_notas)
    returning id into plano_salvo;
  else
    update public.care_plans
    set title = p_titulo, notes = p_notas, updated_at = now()
    where id = p_plano
      and patient_id = p_paciente
      and physiotherapist_id = (select auth.uid())
    returning id into plano_salvo;

    if not found then
      raise exception 'Plano indisponível para edição' using errcode = '42501';
    end if;

    delete from public.plan_exercises where plan_id = plano_salvo;
  end if;

  insert into public.plan_exercises (
    plan_id, exercise_name, exercise_source, external_id, series,
    repetitions, duration, frequency, instructions, position
  )
  select plano_salvo, i.exercise_name, i.exercise_source, i.external_id, i.series,
    i.repetitions, i.duration, i.frequency, i.instructions, i.position
  from jsonb_to_recordset(p_itens) as i(
    exercise_name text, exercise_source text, external_id text, series smallint,
    repetitions text, duration text, frequency text, instructions text, position smallint
  );

  return plano_salvo;
end;
$$;

revoke all on function public.gravar_plano(uuid, uuid, text, text, jsonb) from public, anon;
grant execute on function public.gravar_plano(uuid, uuid, text, text, jsonb) to authenticated;

commit;
