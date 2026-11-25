import { $ } from '../utils/dom.js';
import { validarExercicio, validarIntensidade } from '../utils/validacao.js';
import { readExercises } from '../components/linha-exercicio.js';
import { obterClimaBrasilia } from '../services/clima.js';
import { registrarSintomas, registrarTreino } from '../services/paciente.js';
import { gravarPlano, excluirPlano } from '../services/planos.js';

export function criarAcoesClinicas({
  user, banco, patientId, isProfessional, planoEmEdicao, clearPlanForm, ocupacao,
  estadoTreino, patientExerciseAssignments, loadPatientData, navigate, message, lerDiario, configuracaoDados
}) {
  async function completePatientWorkout(){
    if(!user()||isProfessional()||ocupacao.ativa||estadoTreino.concluido)return;
    const assigned=patientExerciseAssignments();
    if(!assigned.length||estadoTreino.indice!==assigned.length-1)return;
    ocupacao.ativa=true;
    const usuarioInicial = user();
    const button=$("finishPatientWorkout");
    if(button)button.disabled=true;
    try{
      const exercises=assigned.map(({plan,exercise})=>({
        plan_id:plan.id,plan_title:plan.title,
        exercise_name:exercise.exercise_name,exercise_source:exercise.exercise_source,
        external_id:exercise.external_id,series:exercise.series,repetitions:exercise.repetitions,
        duration:exercise.duration,frequency:exercise.frequency,position:exercise.position
      }));
      await registrarTreino(banco(), usuarioInicial.id, exercises);
      if (user() !== usuarioInicial) return;
      estadoTreino.concluido=true;
      await loadPatientData();
      if (user() !== usuarioInicial) return;
      message("Treino concluído e registrado no histórico.");
    }catch(err){
      if (user() !== usuarioInicial) return;
      message("Não foi possível registrar o treino. Execute a migração de histórico no Supabase e tente novamente.",true);
      if(button)button.disabled=false;
    }finally{ocupacao.ativa=false;}
  }
  async function savePlan(event){
    if(event)event.preventDefault();
    if(!isProfessional()||!patientId()||ocupacao.ativa)return;
    const title=$("nomePlanoProf").value.trim();
    const notes=$("orientacoesPlanoProf").value.trim();
    const items=readExercises();
    if(title.length<2||!items.length)return message("Informe um nome e pelo menos um exercício.",true);
    if(title.length>120||notes.length>1000)return message("O nome ou as orientações do plano excedem o limite de caracteres.",true);
    if(items.some(x => !validarExercicio(x)))
      return message("Verifique o exercício, as séries, as repetições ou duração e a frequência.",true);
    ocupacao.ativa=true;
    const usuarioInicial = user();
    try{
      const data={title,notes,patient_id:patientId(),physiotherapist_id:usuarioInicial.id};
      await gravarPlano(banco(), planoEmEdicao(), data, items);
      if (user() !== usuarioInicial) return;
      clearPlanForm();
      await loadPatientData();
      if (user() !== usuarioInicial) return;
      navigate("planos-prof");
      message("Plano salvo para o paciente vinculado.");
    }catch(err){
      if (user() !== usuarioInicial) return;
      message("Não foi possível salvar o plano. Verifique os dados e tente novamente.",true);
    }finally{ocupacao.ativa=false;}
  }
  async function deletePlan(id){
    if(!isProfessional()||ocupacao.ativa||!confirm("Excluir este plano?"))return;
    ocupacao.ativa=true;
    const usuarioInicial = user();
    try{
      await excluirPlano(banco(), id);
      if (user() !== usuarioInicial) return;
      clearPlanForm();
      await loadPatientData();
      if (user() !== usuarioInicial) return;
      message("Plano excluído.");
    }catch(err){if (user() === usuarioInicial) message("Não foi possível excluir o plano.",true);}
    finally{ocupacao.ativa=false;}
  }
  async function saveSymptoms(){
    if(!user()||isProfessional()||ocupacao.ativa)return;
    const { painRest, painMove, stiffness, fatigue, sinalAtipico } = lerDiario();
    if(!validarIntensidade(painRest)||!validarIntensidade(painMove)){
      message("Informe valores de dor de 0 a 10.",true);
      return;
    }
    ocupacao.ativa=true;
    const usuarioInicial = user();
    try{
      let clima=null;
      try {
        clima=await obterClimaBrasilia();
      } catch(err) {
        clima=null;
      }
      if (user() !== usuarioInicial) return;
      const registro={
        patient_id:usuarioInicial.id,pain_rest:painRest,pain_movement:painMove,
        stiffness,
        fatigue
      };
      if(clima && configuracaoDados.weatherColumnsAvailable)Object.assign(registro,clima);
      await registrarSintomas(banco(), registro, clima, configuracaoDados);
      if (user() !== usuarioInicial) return;
      await loadPatientData();
      if (user() !== usuarioInicial) return;
      navigate("inicio");
      message(clima&&configuracaoDados.weatherColumnsAvailable
        ? "Sintomas e condições meteorológicas registrados. O plano permanece inalterado."
        : "Sintomas registrados. Clima indisponível ou atualização do banco pendente; nenhuma medição foi associada a este registro.", !(clima&&configuracaoDados.weatherColumnsAvailable));
      if(sinalAtipico||Math.max(painRest,painMove)>=8)
        alert("Se os sintomas forem intensos ou inesperados, procure orientação profissional. Este aplicativo não realiza triagem clínica.");
    }catch(err){if (user() === usuarioInicial) message("Não foi possível salvar os sintomas. Confira a conexão.",true);}
    finally{ocupacao.ativa=false;}
  }

  return { completePatientWorkout, savePlan, deletePlan, saveSymptoms };
}
