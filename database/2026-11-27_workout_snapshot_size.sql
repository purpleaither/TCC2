begin;

alter table public.workout_sessions
  drop constraint if exists workout_sessions_exercises_check,
  add constraint workout_sessions_exercises_check check (
    case when jsonb_typeof(exercises) = 'array'
      then jsonb_array_length(exercises) >= 1 and octet_length(exercises::text) <= 1048576
      else false
    end
  );

commit;
