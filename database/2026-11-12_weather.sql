alter table public.symptom_records
  add column if not exists weather_city text,
  add column if not exists weather_temperature numeric(5,2),
  add column if not exists weather_humidity smallint,
  add column if not exists weather_pressure numeric(7,2),
  add column if not exists weather_observed_at timestamptz;

alter table public.symptom_records
  drop constraint if exists symptom_records_weather_humidity_check;

alter table public.symptom_records
  add constraint symptom_records_weather_humidity_check
  check (weather_humidity is null or weather_humidity between 0 and 100);

alter table public.symptom_records
  drop constraint if exists symptom_records_weather_pressure_check;

alter table public.symptom_records
  add constraint symptom_records_weather_pressure_check
  check (weather_pressure is null or weather_pressure between 800 and 1200);
