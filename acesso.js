import { exibirMensagem, exibirMenu, exibirSeletoresDePaciente } from './src/components/conta.js';
import { criarVisualizacoes } from './src/components/visualizacoes.js';
import { converterHistorico } from './src/utils/historico.js';
import { criarAcoesClinicas } from './src/hooks/acoes-clinicas.js';
import { navegarNaInterface } from './src/components/navegacao.js';
import { criarBiblioteca } from './src/components/biblioteca.js';
import { criarEditor } from './src/components/editor-planos.js';
import { exibirTreinosDoDia } from './src/components/plano-paciente.js';
import { criarExibicaoDeVideo } from './src/components/video-exercicio.js';
import { $, text } from './src/utils/dom.js';
import { monitoringWeeks } from './src/utils/datas.js';
import { levels } from './src/types/sintomas.js';
import { criarControleDeSolicitacao } from './src/hooks/solicitacao.js';
import { conectarBanco, consultarPerfil, consultarPacientesVinculados, autenticar, encerrarSessao, consultarUsuario, consultarSessao, observarSessao } from './src/services/banco.js';
import { consultarDadosPaciente } from './src/services/paciente.js';
import { consultarExerciseBank } from './src/services/biblioteca.js';

let supabase = null;
let user = null;
let profile = null;
let patients = [];
let patientId = null;
let plans = [];
let records = [];
let professionalWorkouts;
const cargaPaciente = criarControleDeSolicitacao();
const ocupacao = { ativa: false };
let loginReady = false;
const configuracaoDados = { weatherColumnsAvailable: true };

function isAuthenticated() { return !!(user && profile); }
function isProfessional() { return isAuthenticated() && profile.role === "fisioterapeuta"; }
const updatePatientSelectors = () => exibirSeletoresDePaciente(patients, patientId);
const menu = () => exibirMenu(profile, isProfessional());
const message = (valor, erro = false) => exibirMensagem(valor, erro, isAuthenticated());
function navigate(page) {
  navegarNaInterface(page, { isAuthenticated, isProfessional, atualizarTela });
}
function atualizarTela(page) {
  if(page==="planos-prof")renderProfessionalPlans();
  if(page==="editor-prof")updatePlanEditorSummary();
  if(page==="exercise-bank-prof"){
    $("exercisebankResults").replaceChildren();
    text("exercisebankStatus","Selecione os filtros e clique em Buscar.");
  }
  if(page==="registros-prof")renderProfessionalRecords();
  if(page==="exercicios")renderPatientPlans();
  if(page==="historico")gerarHeatmap();
}

async function login() {
  if(!loginReady || ocupacao.ativa || !supabase) return;
  const email=$("loginEmail").value.trim();
  const password=$("loginSenha").value;
  ocupacao.ativa=true;
  $("loginSubmit").disabled=true;
  text("loginStatus", "");
  try {
    await autenticar(supabase, email, password);
    $("loginSenha").value="";
    await openSession();
  } catch(err) {
    message("Não foi possível entrar. Verifique seu e-mail e sua senha.",true);
  } finally {
    ocupacao.ativa=false;
    $("loginSubmit").disabled=!loginReady;
  }
}

async function logout() {
  if(supabase) {
    try { await encerrarSessao(supabase); }
    catch(err) { message("Não foi possível encerrar a sessão. Tente novamente.",true); return; }
  }
  reset();
}
function reset() {
  cargaPaciente.invalidar();
  professionalWorkouts = undefined;
  user=null;
  profile=null;
  patients=[];
  patientId=null;
  plans=[];
  records=[];
  estadoTreino.indice=0;
  estadoTreino.concluido=false;
  treinosConcluidos=[];
  registrosUsuario=[];
  resetLibrary();
  clearPlanForm();
  aplicarUsuarioNaInterface("");
  for (const id of ["profGreeting", "profPlanosDescricao"]) text(id, "");
  for (const id of ["exNormalContainer", "listaPlanosProf", "graficosRegistrosProf",
    "exerciseTargetPlans", "sheetWorkoutHistory"]) $(id)?.replaceChildren();
  for (const id of ["sheetDorNivel", "sheetRigidez", "sheetFadiga", "sheetClimaDesc"]) text(id, "");
  updatePatientSelectors();
  gerarHeatmap();
  menu();
  $("loginSenha").value="";
  const flash=$("authFlash");
  if(flash)flash.hidden=true;
  navigate("login");
}
async function openSession() {
  const me = await consultarUsuario(supabase);
  if(!me) {reset();return;}
  const ownProfile=await consultarPerfil(supabase, me.id);
  if(!ownProfile || !["paciente","fisioterapeuta"].includes(ownProfile.role))throw Error("Perfil não cadastrado");
  user=me;
  profile=ownProfile;
  menu();
  if(isProfessional()) {
    patients = await consultarPacientesVinculados(supabase, user.id);
    patientId=patients[0]?.id||null;
    updatePatientSelectors();
    text("profGreeting","Olá, "+profile.display_name);
    await loadPatientData();
    navigate("profissional");
  } else {
    patients=[];
    patientId=user.id;
    aplicarUsuarioNaInterface(profile.display_name);
    await loadPatientData();
    navigate(location.hash === "#conta" ? "conta" : "inicio");
  }
  if (location.hash === "#conta") history.replaceState(history.state, "", location.pathname + location.search);
  text("loginStatus", "Entre com uma conta de teste cadastrada.");
}
async function selectPatient(id) {
  if(!isProfessional() || !patients.some(p=>p.id===id))return;
  patientId=id;
  clearPlanForm();
  updatePatientSelectors();
  await loadPatientData();
}
async function loadPatientData() {
  const aindaAtual = cargaPaciente.iniciar();
  const selectedPatient = patientId;
  const professional = isProfessional();
  plans=[];
  records=[];
  professionalWorkouts = undefined;
  if (professional && selectedPatient) renderProfessionalRecords();
  if(!selectedPatient){
    renderProfessionalPlans();
    renderProfessionalRecords();
    return;
  }
  try {
    const { loadedPlans, loadedRecords, workoutResponse } = await consultarDadosPaciente(
      supabase, selectedPatient, professional ? monitoringWeeks()[0] : null, configuracaoDados
    );
    if (!aindaAtual()) return;
    plans = loadedPlans;
    records = loadedRecords;
    if(professional){
      professionalWorkouts = workoutResponse.error ? null : (workoutResponse.data || []);
      renderProfessionalPlans();
      renderProfessionalRecords();
    } else {
      treinosConcluidos = workoutResponse.error ? [] : (workoutResponse.data || []);
      registrosUsuario = converterHistorico(records);
      gerarHeatmap();
      verificarRegistroHoje();
      renderPatientPlans();
    }
  } catch(err) {
    if (!aindaAtual()) return;
    if (professional) {
      professionalWorkouts = null;
      renderProfessionalRecords();
    }
    message("Não foi possível consultar os dados do paciente. Verifique a conexão e as permissões.",true);
  }
}
const estadoTreino = { indice: 0, concluido: false };
function patientExerciseAssignments(){
  return plans.flatMap(plan=>[...(plan.plan_exercises||[])]
    .sort((a,b)=>(a.position??0)-(b.position??0))
    .map(exercise=>({plan,exercise})));
}
function ebCall(opts) {
  if (!supabase || !isAuthenticated()) throw Error("Entre para consultar a biblioteca.");
  return consultarExerciseBank(supabase, opts);
}

async function init(){
  menu();navigate("login");
  $("exercisebankRefresh")?.addEventListener("click",()=>loadSample());
  try{
    supabase = await conectarBanco();
    loginReady=true;
    $("loginSubmit").disabled=false;
    message("Entre com uma conta de teste cadastrada.");
    if (await consultarSessao(supabase)) await openSession();
    observarSessao(supabase, (event) => {
      if(event==="SIGNED_OUT"&&isAuthenticated())reset();
    });
  }catch(err){
    loginReady=false;
    $("loginSubmit").disabled=true;
    message("Não foi possível conectar ao serviço. Tente novamente mais tarde.",true);
  }
}

const {
  addExercise, updatePlanEditorSummary, choosePlanForExerciseAddition, addExercisesToExistingPlan,
  openExerciseSourceOptions, backFromExerciseSource, addManualExerciseFromOptions, openExerciseBankFromOptions,
  openExerciseConfiguration, finishExerciseInsertion, backFromExerciseConfiguration, createPlanFromScratch,
  cancelPlanEditor, clearPlanForm, editPlan, planoEmEdicao
} = criarEditor({
  isProfessional, pacienteSelecionado: () => patientId, listarPlanos: () => plans,
  ocupado: () => ocupacao.ativa, navigate, message
});
const { completePatientWorkout, savePlan, deletePlan, saveSymptoms } = criarAcoesClinicas({
  user: () => user, banco: () => supabase, patientId: () => patientId,
  isProfessional, planoEmEdicao, clearPlanForm, ocupacao, estadoTreino, patientExerciseAssignments,
  loadPatientData, navigate, message, configuracaoDados,
  lerDiario: () => ({
    painRest: dorRepouso, painMove: dorMovimento, stiffness: levels[rigidezAtual] || "Leve",
    fatigue: levels[fadigaAtual] || "Leve", sinalAtipico: atipico === 1
  })
});
const loadExerciseMedia = criarExibicaoDeVideo(ebCall);
const { loadSample, resetLibrary } = criarBiblioteca({
  isProfessional, ebCall, addExercise, openExerciseConfiguration, loadExerciseMedia
});

const { renderPatientPlans, renderProfessionalPlans, renderProfessionalRecords } = criarVisualizacoes({
  dados: () => ({ patients, patientId, professionalWorkouts, records, plans }), isAuthenticated, isProfessional,
  updatePatientSelectors, patientExerciseAssignments, estadoTreino, navigate, completePatientWorkout,
  loadExerciseMedia, editPlan, deletePlan, createPlanFromScratch, addExercisesToExistingPlan
});
const renderWorkoutDay = (year, month, day) => exibirTreinosDoDia(treinosConcluidos, year, month, day);

window.AppAuth={login,logout,navigate,saveSymptoms,isProfessional,renderWorkoutDay};
window.atualizarPacienteProfissional=()=>selectPatient($("pacienteProf").value);
window.trocarPacientePlanoProf=()=>selectPatient($("pacientePlanoProf").value);
window.trocarPacienteRegistrosProf=()=>selectPatient($("pacienteRegistrosProf").value);
window.cancelarFormularioPlano=cancelPlanEditor;
window.criarPlanoProfissional=createPlanFromScratch;
window.abrirOpcoesExercicios=openExerciseSourceOptions;
window.escolherPlanoParaExercicios=choosePlanForExerciseAddition;
window.voltarDaEscolhaExercicios=backFromExerciseSource;
window.concluirInsercaoExercicio=finishExerciseInsertion;
window.voltarDaConfiguracaoExercicio=backFromExerciseConfiguration;
window.adicionarExercicioManual=addManualExerciseFromOptions;
window.abrirBibliotecaExerciseBank=openExerciseBankFromOptions;
window.salvarPlanoProf=savePlan;
document.addEventListener("DOMContentLoaded",init);
