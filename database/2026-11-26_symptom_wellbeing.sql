alter table public.symptom_records
  add column if not exists mood text check (mood in ('Bem', 'Regular', 'Desanimado')),
  add column if not exists activity_level text check (activity_level in ('Nenhuma', 'Leve', 'Moderada', 'Intensa'));
