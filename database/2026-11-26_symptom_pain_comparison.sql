alter table public.symptom_records
  add column if not exists pain_rest_comparison text check (pain_rest_comparison in ('Menos dor', 'A mesma dor', 'Mais dor', 'Não sei comparar')),
  add column if not exists pain_movement_comparison text check (pain_movement_comparison in ('Menos dor', 'A mesma dor', 'Mais dor', 'Não sei comparar'));
