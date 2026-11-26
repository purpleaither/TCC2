alter table public.symptom_records
  alter column pain_rest drop not null,
  alter column pain_movement drop not null;
