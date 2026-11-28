alter table public.symptom_records add column if not exists corrected_at timestamptz;
create table public.symptom_record_versions (
 id bigint generated always as identity primary key,
 record_id uuid not null references public.symptom_records(id),
 patient_id uuid not null,
 corrected_at timestamptz not null default clock_timestamp(),
 previous_values jsonb not null
);
alter table public.symptom_record_versions enable row level security;
revoke all on public.symptom_record_versions from public, anon, authenticated;
grant select on public.symptom_record_versions to authenticated;
create index on public.symptom_record_versions(record_id,corrected_at);
create policy "versions read self or linked professional" on public.symptom_record_versions for select to authenticated using (patient_id=(select auth.uid()) or (private.is_professional((select auth.uid())) and private.has_care_link((select auth.uid()),patient_id)));
grant update (pain_rest,pain_movement,stiffness,fatigue,mood,activity_level,pain_rest_comparison,pain_movement_comparison,dyspnea_rest,dyspnea_exertion,cough_level,secretion_level,airway_dryness) on public.symptom_records to authenticated;
create policy "symptoms correct self" on public.symptom_records for update to authenticated using (patient_id=(select auth.uid()) and not private.is_professional((select auth.uid()))) with check (patient_id=(select auth.uid()) and not private.is_professional((select auth.uid())));
create function private.archive_symptom_correction() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is distinct from old.patient_id or private.is_professional(auth.uid()) then raise exception 'Correction not authorized' using errcode='42501'; end if;
 if (to_jsonb(new)-'corrected_at') is not distinct from (to_jsonb(old)-'corrected_at') then return old; end if;
 new.corrected_at=clock_timestamp();
 insert into public.symptom_record_versions(record_id,patient_id,corrected_at,previous_values) values(old.id,old.patient_id,new.corrected_at,to_jsonb(old));
 return new;
end; $$;
revoke all on function private.archive_symptom_correction() from public,anon,authenticated;
create trigger archive_symptom_correction before update on public.symptom_records for each row execute function private.archive_symptom_correction();
