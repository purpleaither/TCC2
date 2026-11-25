import { criarBiblioteca } from './src/components/biblioteca.js';
import { criarEditor } from './src/components/editor-planos.js';
import { readExercises } from './src/components/linha-exercicio.js';
import { exibirPlanoPaciente, exibirTreinosDoDia } from './src/components/plano-paciente.js';
import { exibirPlanosProfissionais } from './src/components/planos-profissionais.js';
import { exibirRegistrosProfissionais } from './src/components/acompanhamento.js';
import { criarExibicaoDeVideo } from './src/components/video-exercicio.js';
import { validarExercicio } from './src/utils/validacao.js';
import { $, el, text } from './src/utils/dom.js';
import { monitoringWeeks } from './src/utils/datas.js';
import { levels } from './src/types/sintomas.js';
import { criarControleDeSolicitacao } from './src/hooks/solicitacao.js';
import { conectarBanco, consultarPerfil, consultarPacientesVinculados, autenticar, encerrarSessao, consultarUsuario, consultarSessao, observarSessao } from './src/services/banco.js';
import { obterClimaBrasilia, mapWeather } from './src/services/clima.js';
import { consultarDadosPaciente, registrarSintomas, registrarTreino } from './src/services/paciente.js';
import { gravarPlano, excluirPlano } from './src/services/planos.js';
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
let busy = false;
let loginReady = false;
const configuracaoDados = { weatherColumnsAvailable: true };

function isAuthenticated() { return !!(user && profile); }
function isProfessional() { return isAuthenticated() && profile.role === "fisioterapeuta"; }
function homePage() { return isProfessional() ? "profissional" : "inicio"; }
function message(value,isError=false) {
  text("loginStatus",value);
  const flash = $("authFlash");
  if(flash) {
    flash.hidden = !isAuthenticated();
    flash.textContent = value;
    flash.style.background = isError ? "var(--fundo-alerta)" : "var(--superficie-verde)";
    flash.style.color = isError ? "var(--erro)" : "var(--titulo)";
  }
}
function menu() {
  document.querySelectorAll("[data-perfil]").forEach(item=>{
    item.style.display = isAuthenticated() && item.dataset.perfil === profile.role ? "" : "none";
  });
  text("headerPerfilBtn",isProfessional() ? "Profissional" : "Minha conta");
}
function navigate(page) {
  if(!isAuthenticated()) page="login";
  else {
    if (page === "conta") page = isProfessional() ? "profissional" : "contatos";
    const allowed = isProfessional()
      ? ["profissional","planos-prof","exercise-target-prof","exercise-source-prof","exercise-bank-prof","exercise-config-prof","editor-prof","registros-prof"]
      : ["inicio","sintomas","historico","orientacoes","exercicios","contatos"];
    if(!allowed.includes(page)) page=homePage();
  }
  document.querySelectorAll(".page").forEach(n=>n.classList.toggle("active",n.id==="page-"+page));
  mostrarCabecalho(page!=="login");
  document.querySelectorAll(".menu-item").forEach(item=>{
    const selected=item.getAttribute("onclick")==="navegarPara('"+(
      ["editor-prof","exercise-target-prof","exercise-source-prof","exercise-bank-prof","exercise-config-prof"].includes(page)?"planos-prof":page
    )+"')";
    item.classList.toggle("active",selected);
    if(selected)item.setAttribute("aria-current","page");
    else item.removeAttribute("aria-current");
  });
  fecharMenu();
  fecharClimaSheet();
  if(page==="planos-prof")renderProfessionalPlans();
  if(page==="editor-prof")updatePlanEditorSummary();
  if(page==="exercise-bank-prof"){
    $("exercisebankResults").replaceChildren();
    text("exercisebankStatus","Selecione os filtros e clique em Buscar.");
  }
  if(page==="registros-prof")renderProfessionalRecords();
  if(page==="exercicios")renderPatientPlans();
  if(page==="historico")gerarHeatmap();
  window.scrollTo(0,0);
}

async function login() {
  if(!loginReady || busy || !supabase) return;
  const email=$("loginEmail").value.trim();
  const password=$("loginSenha").value;
  busy=true;
  $("loginSubmit").disabled=true;
  text("loginStatus", "");
  try {
    await autenticar(supabase, email, password);
    $("loginSenha").value="";
    await openSession();
  } catch(err) {
    message("Não foi possível entrar. Verifique seu e-mail e sua senha.",true);
  } finally {
    busy=false;
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
function updatePatientSelectors() {
  for(const id of ["pacienteProf","pacientePlanoProf","pacienteRegistrosProf"]) {
    const select=$(id);
    if(!select)continue;
    select.replaceChildren();
    for(const patient of patients) {
      const option=el("option",patient.display_name);
      option.value=patient.id;
      select.append(option);
    }
    if(patientId)select.value=patientId;
    select.disabled=!patientId;
  }
  const submit=$("formPlanoProf")?.querySelector('button[type="submit"]');
  if(submit)submit.disabled=!patientId;
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
      registrosUsuario=records.slice().reverse().map(r=>({
        data:r.recorded_at,
        dorRepouso:r.pain_rest,
        dorMovimento:r.pain_movement,
        maiorDor:Math.max(r.pain_rest,r.pain_movement),
        rigidez:Math.max(0,levels.indexOf(r.stiffness)),
        fadiga:Math.max(0,levels.indexOf(r.fatigue)),
        humor:1,
        atividade:0,
        sinalAtipico:false,
        clima:mapWeather(r)
      }));
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
async function completePatientWorkout(){
  if(!isAuthenticated()||isProfessional()||busy||estadoTreino.concluido)return;
  const assigned=patientExerciseAssignments();
  if(!assigned.length||estadoTreino.indice!==assigned.length-1)return;
  busy=true;
  const button=$("finishPatientWorkout");
  if(button)button.disabled=true;
  try{
    const exercises=assigned.map(({plan,exercise})=>({
      plan_id:plan.id,plan_title:plan.title,
      exercise_name:exercise.exercise_name,exercise_source:exercise.exercise_source,
      external_id:exercise.external_id,series:exercise.series,repetitions:exercise.repetitions,
      duration:exercise.duration,frequency:exercise.frequency,position:exercise.position
    }));
    await registrarTreino(supabase, user.id, exercises);
    estadoTreino.concluido=true;
    await loadPatientData();
    message("Treino concluído e registrado no histórico.");
  }catch(err){
    message("Não foi possível registrar o treino. Execute a migração de histórico no Supabase e tente novamente.",true);
    if(button)button.disabled=false;
  }finally{busy=false;}
}
async function savePlan(event){
  if(event)event.preventDefault();
  if(!isProfessional()||!patientId||busy)return;
  const title=$("nomePlanoProf").value.trim();
  const items=readExercises();
  if(title.length<2||!items.length)return message("Informe um nome e pelo menos um exercício.",true);
  if(items.some(x => !validarExercicio(x)))
    return message("Verifique o exercício, as séries, as repetições ou duração e a frequência.",true);
  busy=true;
  try{
    const data={title,notes:$("orientacoesPlanoProf").value.trim(),patient_id:patientId,physiotherapist_id:user.id};
    await gravarPlano(supabase, planoEmEdicao(), data, items);
    clearPlanForm();
    await loadPatientData();
    navigate("planos-prof");
    message("Plano salvo para o paciente vinculado.");
  }catch(err){
    message("Não foi possível salvar o plano. Verifique os dados e tente novamente.",true);
  }finally{busy=false;}
}
async function deletePlan(id){
  if(!isProfessional()||busy||!confirm("Excluir este plano?"))return;
  busy=true;
  try{
    await excluirPlano(supabase, id);
    clearPlanForm();
    await loadPatientData();
    message("Plano excluído.");
  }catch(err){message("Não foi possível excluir o plano.",true);}
  finally{busy=false;}
}
async function saveSymptoms(){
  if(!isAuthenticated()||isProfessional()||busy)return;
  busy=true;
  const painRest=dorRepouso,painMove=dorMovimento;
  try{
    let clima=null;
    try {
      clima=await obterClimaBrasilia();
    } catch(err) {
      clima=null;
    }
    const registro={
      patient_id:user.id,pain_rest:painRest,pain_movement:painMove,
      stiffness:levels[rigidezAtual]||"Leve",
      fatigue:levels[fadigaAtual]||"Leve"
    };
    if(clima && configuracaoDados.weatherColumnsAvailable)Object.assign(registro,clima);
    await registrarSintomas(supabase, registro, clima, configuracaoDados);
    await loadPatientData();
    navigate("inicio");
    message(clima&&configuracaoDados.weatherColumnsAvailable
      ? "Sintomas e condições meteorológicas registrados. O plano permanece inalterado."
      : "Sintomas registrados. Clima indisponível ou atualização do banco pendente; nenhuma medição foi associada a este registro.", !(clima&&configuracaoDados.weatherColumnsAvailable));
    if(atipico===1||Math.max(painRest,painMove)>=8)
      alert("Se os sintomas forem intensos ou inesperados, procure orientação profissional. Este aplicativo não realiza triagem clínica.");
  }catch(err){message("Não foi possível salvar os sintomas. Confira a conexão.",true);}
  finally{busy=false;}
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
  ocupado: () => busy, navigate, message
});
const loadExerciseMedia = criarExibicaoDeVideo(ebCall);
const { loadSample, resetLibrary } = criarBiblioteca({
  isProfessional, ebCall, addExercise, openExerciseConfiguration, loadExerciseMedia
});

function renderWorkoutDay(year, month, day) {
  exibirTreinosDoDia(treinosConcluidos, year, month, day);
}

function renderPatientPlans() {
  if (!isAuthenticated() || isProfessional()) return;
  exibirPlanoPaciente({
    assigned: patientExerciseAssignments(), estado: estadoTreino, records, navigate, completePatientWorkout, loadExerciseMedia
  });
}

function renderProfessionalPlans() {
  if (!isProfessional()) return;
  updatePatientSelectors();
  exibirPlanosProfissionais({
    patients, patientId, plans, loadExerciseMedia, editPlan, deletePlan, createPlanFromScratch, addExercisesToExistingPlan
  });
}

function renderProfessionalRecords() {
  if (!isProfessional()) return;
  updatePatientSelectors();
  exibirRegistrosProfissionais({ patientId, professionalWorkouts, records, plans });
}

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
