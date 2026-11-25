import { exibirPlanoPaciente } from './plano-paciente.js';
import { exibirPlanosProfissionais } from './planos-profissionais.js';
import { exibirRegistrosProfissionais } from './acompanhamento.js';

export function criarVisualizacoes({
  dados, isAuthenticated, isProfessional, updatePatientSelectors, patientExerciseAssignments,
  estadoTreino, navigate, completePatientWorkout, loadExerciseMedia, editPlan, deletePlan,
  createPlanFromScratch, addExercisesToExistingPlan
}) {
  function renderPatientPlans() {
    if (!isAuthenticated() || isProfessional()) return;
    const { records } = dados();
    exibirPlanoPaciente({
      assigned: patientExerciseAssignments(), estado: estadoTreino, records, navigate, completePatientWorkout, loadExerciseMedia
    });
  }

  function renderProfessionalPlans() {
    if (!isProfessional()) return;
    updatePatientSelectors();
    const { patients, patientId, plans } = dados();
    exibirPlanosProfissionais({
      patients, patientId, plans, loadExerciseMedia, editPlan, deletePlan, createPlanFromScratch, addExercisesToExistingPlan
    });
  }

  function renderProfessionalRecords() {
    if (!isProfessional()) return;
    updatePatientSelectors();
    exibirRegistrosProfissionais(dados());
  }

  return { renderPatientPlans, renderProfessionalPlans, renderProfessionalRecords };
}
