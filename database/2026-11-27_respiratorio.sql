begin;

alter table public.care_plans
  add column if not exists clinical_domain text default 'musculoesqueletico'
    check (clinical_domain in ('musculoesqueletico', 'respiratorio', 'misto'));

alter table public.symptom_records
  add column if not exists dyspnea_rest smallint check (dyspnea_rest between 0 and 10),
  add column if not exists dyspnea_exertion smallint check (dyspnea_exertion between 0 and 10),
  add column if not exists cough_level smallint check (cough_level between 0 and 3),
  add column if not exists secretion_level smallint check (secretion_level between 0 and 3),
  add column if not exists airway_dryness smallint check (airway_dryness between 0 and 3),
  add column if not exists pm2_5 numeric check (pm2_5 >= 0),
  add column if not exists pm10 numeric check (pm10 >= 0),
  add column if not exists ozone numeric check (ozone >= 0),
  alter column pain_rest drop not null,
  alter column pain_movement drop not null,
  alter column stiffness drop not null,
  alter column fatigue drop not null;

alter table public.plan_exercises
  add column if not exists domain text default 'musculoesqueletico'
    check (domain in ('musculoesqueletico', 'respiratorio')),
  add column if not exists rest_seconds integer check (rest_seconds >= 0),
  add column if not exists inspiratory_hold_seconds integer check (inspiratory_hold_seconds >= 0);

commit;
