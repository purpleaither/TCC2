import { result } from './banco.js';
import { isMissingWeatherColumns } from './clima.js';

export async function consultarDadosPaciente(supabase, selectedPatient, inicioAcompanhamento, configuracao) {
  const loadedPlans=result(await supabase.from("care_plans")
    .select("id,title,notes,created_at,updated_at,plan_exercises(id,exercise_name,exercise_source,external_id,series,repetitions,duration,frequency,instructions,position)")
    .eq("patient_id",selectedPatient).order("created_at",{ascending:false}))||[];
  const baseFields="id,recorded_at,pain_rest,pain_movement,stiffness,fatigue";
  const weatherFields=",weather_city,weather_temperature,weather_humidity,weather_pressure,weather_observed_at";
  let symptomsResponse=await supabase.from("symptom_records")
    .select(baseFields+(configuracao.weatherColumnsAvailable?weatherFields:""))
    .eq("patient_id",selectedPatient).order("recorded_at",{ascending:false}).limit(500);
  if (symptomsResponse.error && configuracao.weatherColumnsAvailable && isMissingWeatherColumns(symptomsResponse.error)) {
    configuracao.weatherColumnsAvailable=false;
    symptomsResponse=await supabase.from("symptom_records").select(baseFields)
      .eq("patient_id",selectedPatient).order("recorded_at",{ascending:false}).limit(500);
  }
  const loadedRecords = result(symptomsResponse) || [];
  let workouts = supabase.from("workout_sessions")
    .select(inicioAcompanhamento ? "completed_at,exercises" : "id,patient_id,completed_at,exercises")
    .eq("patient_id", selectedPatient).order("completed_at", { ascending: false }).limit(500);
  if (inicioAcompanhamento) workouts = workouts.gte("completed_at", inicioAcompanhamento.toISOString());
  const workoutResponse = await workouts;
  return { loadedPlans, loadedRecords, workoutResponse };
}

export async function registrarSintomas(supabase, registro, clima, configuracao) {
  const response = await supabase.from("symptom_records").insert(registro);
  if (!response.error || !clima || !isMissingWeatherColumns(response.error)) {
    return result(response);
  }
  configuracao.weatherColumnsAvailable = false;
  const { patient_id, pain_rest, pain_movement, stiffness, fatigue } = registro;
  return result(await supabase.from("symptom_records").insert({
    patient_id, pain_rest, pain_movement, stiffness, fatigue
  }));
}

export async function registrarTreino(supabase, patient_id, exercises) {
  return result(await supabase.from("workout_sessions").insert({ patient_id, exercises }));
}
