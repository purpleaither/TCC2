export function validarExercicio({ exercise_name, series, repetitions, duration, frequency }) {
  return exercise_name?.length >= 2 && exercise_name.length <= 160 &&
    Number.isInteger(series) && series >= 1 && series <= 20 &&
    Boolean(repetitions || duration) && (repetitions?.length ?? 0) <= 60 &&
    (duration?.length ?? 0) <= 60 && frequency?.length >= 1 && frequency.length <= 80;
}

export function validarIntensidade(valor) {
  return Number.isInteger(valor) && valor >= 0 && valor <= 10;
}
