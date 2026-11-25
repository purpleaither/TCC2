export function validarExercicio({ exercise_name, series, repetitions, duration, frequency }) {
  return exercise_name?.length >= 2 && Number.isInteger(series) && series >= 1 && series <= 20 &&
    Boolean(repetitions || duration) && Boolean(frequency);
}
