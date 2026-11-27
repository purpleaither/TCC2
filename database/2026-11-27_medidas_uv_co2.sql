alter table public.symptom_records
  add column if not exists weather_uv_index numeric check (weather_uv_index >= 0 and weather_uv_index < 'Infinity'::numeric),
  add column if not exists carbon_dioxide numeric check (carbon_dioxide >= 0 and carbon_dioxide < 'Infinity'::numeric);
