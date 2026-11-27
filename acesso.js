"use strict";

import {criarGuiaAoArLivre} from "./services/outdoorGuide.js";

const $ = id => document.getElementById(id);
const levels = ["Nenhuma", "Leve", "Moderada", "Intensa"];
const WALK_SOURCE = "caminhada_manual";
const moods = ["Bem", "Regular", "Desanimado"];
let supabase = null;
let user = null;
let profile = null;
let patients = [];
let patientId = null;
let plans = [];
let records = [];
let professionalWorkouts;
let patientLoadVersion = 0;
let editingPlan = null;
let busy = false;
let loginReady = false;
let bankItems=[];
let bankOffset=0;
let bankQuery="";
let bankBusy=false;
let weatherColumnsAvailable = true;

function el(tag, content, cls) {
  const n = document.createElement(tag);
  if (content !== undefined) n.textContent = String(content);
  if (cls) n.className = cls;
  return n;
}
function text(id,value) {
  const n = $(id);
  if(n) n.textContent = String(value);
}
function result(reply) {
  if(reply.error) throw reply.error;
  return reply.data;
}
function date(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "Data indisponível" : d.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
}
function isAuthenticated() { return !!(user && profile); }
function isProfessional() { return isAuthenticated() && profile.role === "fisioterapeuta"; }
function homePage() { return isProfessional() ? "profissional" : "inicio"; }
function message(value,isError=false) {
  if(!isAuthenticated()){text("loginStatus",value);return;}
  const flash = $("authFlash");
  if(flash) {
    flash.hidden = false;
    flash.textContent = value;
    flash.style.background = isError ? "var(--fundo-alerta)" : "var(--superficie-verde)";
    flash.style.color = isError ? "var(--erro)" : "var(--titulo)";
  }
}
function menu() {
  document.querySelectorAll("[data-perfil]").forEach(item=>{
    item.style.display = isAuthenticated() && item.dataset.perfil === profile.role ? "" : "none";
  });
}
function navigate(page) {
  if(!isAuthenticated()) page="login";
  else {
    if (page === "conta") page = isProfessional() ? "profissional" : "contatos";
    const allowed = isProfessional()
      ? ["profissional","planos-prof","exercise-source-prof","exercise-bank-prof","editor-prof","registros-prof"]
      : ["inicio","sintomas","historico","orientacoes","exercicios","contatos"];
    if(!allowed.includes(page)) page=homePage();
  }
  if(!$("page-"+page).classList.contains("active")) {
    const flash=$("authFlash");
    flash.hidden=true;
    flash.textContent="";
  }
  if(page!=="exercicios" && outdoorSelectedId)closeOutdoorGuide();
  document.querySelectorAll(".page").forEach(n=>n.classList.toggle("active",n.id==="page-"+page));
  mostrarCabecalho(page!=="login");
  document.querySelectorAll(".menu-item").forEach(item=>{
    const selected=item.getAttribute("onclick")==="navegarPara('"+(
      ["editor-prof","exercise-source-prof","exercise-bank-prof"].includes(page)?"planos-prof":page
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
  if(page==="exercicios")void refreshOutdoorGuide();
  if(page==="inicio"){
    const advice=patientTpeAdviceForToday();
    text("conselhoDiaTitulo",advice.title);
    text("conselhoDiaTexto",advice.body);
  }
  if(page==="sintomas"){limparRegistroDiario();definirEtapaDiario(0, true);}
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
  $("authFlash").hidden=true;
  let signedIn=false;
  try {
    result(await supabase.auth.signInWithPassword({email,password}));
    signedIn=true;
    $("loginSenha").value="";
    $("loginContent").hidden=true;
    $("loginLoading").hidden=false;
    $("loginLoadingTitle").focus();
    await openSession();
  } catch(err) {
    if(signedIn){
      reset();
      await supabase.auth.signOut({scope:"local"}).catch(()=>{});
    }
    text("loginStatus", signedIn
      ? "Não foi possível carregar sua conta. Tente novamente."
      : "Não foi possível entrar. Verifique seu e-mail e sua senha.");
  } finally {
    busy=false;
    $("loginSubmit").disabled=!loginReady;
    $("loginLoading").hidden=true;
    $("loginContent").hidden=false;
    if($("page-login").classList.contains("active"))$("loginSubmit").focus();
  }
}

async function logout() {
  if(supabase) {
    try { await supabase.auth.signOut(); }
    catch(err) { message("Não foi possível encerrar a sessão. Tente novamente.",true); return; }
  }
  reset();
}
function reset() {
  stopOutdoorUpdates();
  patientLoadVersion += 1;
  professionalWorkouts = undefined;
  user=null;
  profile=null;
  patients=[];
  patientId=null;
  plans=[];
  records=[];
  clearPlanForm();
  currentPatientExercise=0;
  workoutCompletedInView=false;
  treinosConcluidos=[];
  registrosUsuario=[];
  limparRegistroDiario();
  menu();
  $("loginSenha").value="";
  const flash=$("authFlash");
  if(flash)flash.hidden=true;
  navigate("login");
}
async function openSession() {
  const me = result(await supabase.auth.getUser()).user;
  if(!me) {reset();return;}
  const ownProfile=result(await supabase.from("profiles").select("id,display_name,role").eq("id",me.id).single());
  if(!ownProfile || !["paciente","fisioterapeuta"].includes(ownProfile.role))throw Error("Perfil não cadastrado");
  user=me;
  profile=ownProfile;
  menu();
  if(isProfessional()) {
    const links=result(await supabase.from("care_links").select("patient_id").eq("physiotherapist_id",user.id));
    const ids=(links||[]).map(x=>x.patient_id);
    patients=ids.length ? result(await supabase.from("profiles").select("id,display_name").in("id",ids)) : [];
    patientId=null;
    text("profGreeting","Olá, "+profile.display_name);
    await loadPatientData();
    navigate("profissional");
  } else {
    patients=[];
    patientId=user.id;
    aplicarUsuarioNaInterface(profile.display_name);
    await loadPatientData();
    startOutdoorUpdates();
    navigate(location.hash === "#conta" ? "conta" : "inicio");
  }
  if (location.hash === "#conta") history.replaceState(history.state, "", location.pathname + location.search);
  text("loginStatus", "Entre com uma conta de teste cadastrada.");
}
function updatePatientSelectors() {
  $("acoesPacienteProf").hidden=!patientId;
  for(const id of ["pacienteProf","pacientePlanoProf","pacienteRegistrosProf"]) {
    const select=$(id);
    if(!select)continue;
    const placeholder=el("option",patients.length?"Selecione um paciente":"Nenhum paciente vinculado");
    placeholder.value="";
    placeholder.disabled=true;
    select.replaceChildren(placeholder);
    for(const patient of patients) {
      const option=el("option",patient.display_name);
      option.value=patient.id;
      select.append(option);
    }
    select.value=patientId||"";
    select.disabled=!patients.length;
  }
  const submit=$("formPlanoProf")?.querySelector('button[type="submit"]');
  if(submit)submit.disabled=!patientId;
}
async function selectPatient(id) {
  if(!isProfessional() || !patients.some(p=>p.id===id))return;
  patientId=id;
  editingPlan=null;
  clearPlanForm();
  updatePatientSelectors();
  await loadPatientData();
}
const outdoorGuide = criarGuiaAoArLivre($("guiaArLivre"), refreshOutdoorGuide);
let outdoorChannel;
let outdoorTimer;
let outdoorRefresh = 0;
let outdoorExerciseIds;
let outdoorSelectedId = null;

async function refreshOutdoorGuide() {
  if(!isAuthenticated() || isProfessional()) return false;
  const current = user.id;
  const version = ++outdoorRefresh;
  let flagged = [];
  try {
    const response = await supabase.from("care_plans")
      .select("plan_exercises!inner(id,exercise_name,exercise_source,indicacao_ar_livre)")
      .eq("patient_id",current).eq("plan_exercises.indicacao_ar_livre",true);
    flagged = (result(response) || []).flatMap(plan => plan.plan_exercises
      .filter(exercise => exercise.indicacao_ar_livre === true));
  } catch {
    // Sem confirmação do plano, o guia permanece fechado.
  }
  if(user?.id !== current || isProfessional()) return false;
  if(version !== outdoorRefresh) return false;
  outdoorExerciseIds = new Set(flagged.map(exercise => exercise.id));
  const knownIds = new Set(patientExerciseAssignments().map(({exercise}) => exercise.id));
  if(flagged.some(exercise => !knownIds.has(exercise.id)))await loadPatientData();
  if(version !== outdoorRefresh)return false;
  const button = $("verParquesProximos");
  if(button)button.hidden=!outdoorExerciseIds.has(button.dataset.exerciseId);
  if(!outdoorSelectedId)return false;
  if(!outdoorExerciseIds.has(outdoorSelectedId)){
    closeOutdoorGuide();
    return false;
  }
  outdoorGuide.update(true);
  return true;
}

function refreshOutdoorExercises() {
  if(!document.hidden && $("page-exercicios").classList.contains("active")) void refreshOutdoorGuide();
}
function startOutdoorUpdates() {
  stopOutdoorUpdates();
  if(supabase.channel) {
    outdoorChannel = supabase.channel("indicacoes-ar-livre")
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "care_plans", filter: "patient_id=eq." + user.id
      }, () => void refreshOutdoorGuide()).subscribe();
  }
  document.addEventListener("visibilitychange", refreshOutdoorExercises);
  outdoorTimer = setInterval(refreshOutdoorExercises, 15000);
}
function closeOutdoorGuide() {
  outdoorSelectedId=null;
  outdoorGuide.update(false);
  $("parquesDialog").close();
}

function stopOutdoorUpdates() {
  outdoorRefresh += 1;
  outdoorExerciseIds=undefined;
  closeOutdoorGuide();
  clearInterval(outdoorTimer);
  document.removeEventListener("visibilitychange", refreshOutdoorExercises);
  if(outdoorChannel) void supabase.removeChannel(outdoorChannel);
  outdoorChannel = null;
}

async function consultarClimaBrasilia() {
  const response = await fetch("/api/weather", {
    signal: AbortSignal.timeout(12000),
    cache: "no-store"
  });
  if (!response.ok) throw Error("Serviço meteorológico indisponível");
  const clima = await response.json();
  if (!clima || ![clima.weather_temperature, clima.weather_humidity, clima.weather_pressure].every(Number.isFinite) ||
      clima.weather_city !== "Brasília" || !Number.isFinite(Date.parse(clima.weather_observed_at))) {
    throw Error("Dados meteorológicos inválidos");
  }
  return clima;
}

// Tenta novamente se o serviço meteorológico estiver temporariamente indisponível.
async function obterClimaBrasilia() {
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      return await consultarClimaBrasilia();
    } catch (erro) {
      if (tentativa === 2) throw erro;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

function isMissingWeatherColumns(error) {
  const code = error && error.code;
  return code === "42703" || code === "PGRST204";
}

function mapWeather(registro) {
  if (registro.weather_temperature == null || registro.weather_humidity == null || registro.weather_pressure == null) return null;
  return {
    cidade:registro.weather_city || "Brasília",
    temperatura:registro.weather_temperature,
    umidade:registro.weather_humidity,
    pressao:registro.weather_pressure,
    observadoEm:registro.weather_observed_at || registro.recorded_at
  };
}

async function loadPatientData() {
  const version = ++patientLoadVersion;
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
    const loadedPlans=result(await supabase.from("care_plans")
      .select("id,title,notes,created_at,updated_at,plan_exercises(id,exercise_name,exercise_source,external_id,series,repetitions,duration,frequency,instructions,position,indicacao_ar_livre)")
      .eq("patient_id",selectedPatient).order("created_at",{ascending:false}))||[];
    const baseFields="id,recorded_at,pain_rest,pain_movement,stiffness,fatigue,mood,activity_level,pain_rest_comparison,pain_movement_comparison";
    const weatherFields=",weather_city,weather_temperature,weather_humidity,weather_pressure,weather_observed_at";
    let symptomsResponse=await supabase.from("symptom_records")
      .select(baseFields+(weatherColumnsAvailable?weatherFields:""))
      .eq("patient_id",selectedPatient).order("recorded_at",{ascending:false}).limit(500);
    if (symptomsResponse.error && weatherColumnsAvailable && isMissingWeatherColumns(symptomsResponse.error)) {
      weatherColumnsAvailable=false;
      symptomsResponse=await supabase.from("symptom_records").select(baseFields)
        .eq("patient_id",selectedPatient).order("recorded_at",{ascending:false}).limit(500);
    }
    const loadedRecords = result(symptomsResponse) || [];
    let workouts = supabase.from("workout_sessions")
      .select(professional ? "completed_at,exercises" : "id,patient_id,completed_at,exercises")
      .eq("patient_id", selectedPatient).order("completed_at", { ascending: false }).limit(500);
    if (professional) workouts = workouts.gte("completed_at", monitoringWeeks(90)[0].toISOString());
    const workoutResponse = await workouts;
    if (version !== patientLoadVersion) return;
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
        comparacaoParado:r.pain_rest_comparison,
        comparacaoMovimento:r.pain_movement_comparison,
        rigidez:Math.max(0,levels.indexOf(r.stiffness)),
        fadiga:Math.max(0,levels.indexOf(r.fatigue)),
        humor:r.mood,
        atividade:r.activity_level,
        sinalAtipico:false,
        clima:mapWeather(r)
      }));
      gerarHeatmap();
      verificarRegistroHoje();
      renderPatientPlans();
    }
  } catch(err) {
    if (version !== patientLoadVersion) return;
    if (professional) {
      professionalWorkouts = null;
      renderProfessionalRecords();
    }
    message("Não foi possível consultar os dados do paciente. Verifique a conexão e as permissões.",true);
  }
}
// Conselho educativo por sintomas do dia, sem diagnóstico nem mudança da prescrição.
function localDateKey(value){
  const day=new Date(value);
  if(Number.isNaN(day.getTime()))return "";
  return [day.getFullYear(),String(day.getMonth()+1).padStart(2,"0"),String(day.getDate()).padStart(2,"0")].join("-");
}
function todaysPatientSymptoms(){
  if(isProfessional()||!records.length)return null;
  const today=localDateKey(new Date());
  return records.filter(r=>localDateKey(r.recorded_at)===today)
    .sort((a,b)=>new Date(b.recorded_at)-new Date(a.recorded_at))[0]||null;
}
function patientTpeAdviceForToday(){
  const record=todaysPatientSymptoms();
  if(!record)return {
    title:"Conselho geral",
    body:"O registro de sintomas de hoje ainda não foi realizado. Observe como você se sente e siga o plano combinado com seu fisioterapeuta; o conselho será ajustado após o registro."
  };
  const intensity=Math.max(...[record.pain_rest, record.pain_movement].filter(Number.isFinite));
  const stiffness=String(record.stiffness||"").toLowerCase();
  const fatigue=String(record.fatigue||"").toLowerCase();
  if(intensity>=8)return {
    title:"Atenção aos sintomas de hoje",
    body:"Você registrou dor intensa hoje. Não force os movimentos nem aumente a intensidade por conta própria. Entre em contato com o fisioterapeuta para orientar a continuidade do plano. Se a dor for súbita, muito diferente da habitual ou acompanhada de sinais preocupantes, procure atendimento de saúde."
  };
  if(intensity>=5)return {
    title:"Dor e movimento",
    body:"Hoje você registrou dor moderada ou elevada. A intensidade da dor pode variar de um dia para outro e não indica, sozinha, dano aos tecidos. Respeite os limites orientados pelo fisioterapeuta e converse com ele caso os exercícios piorem os sintomas."
  };
  if(fatigue==="intensa"||fatigue==="moderada")return {
    title:"Fadiga e organização das atividades",
    body:"Você relatou fadiga hoje. Planejar pausas e distribuir as atividades ao longo do dia pode ajudar no autocuidado. Mantenha as orientações do fisioterapeuta e informe caso a fadiga limite a execução do plano."
  };
  if(stiffness==="intensa"||stiffness==="moderada")return {
    title:"Rigidez e movimento",
    body:"Você relatou rigidez hoje. Movimentos confortáveis, realizados conforme o plano prescrito, podem ajudar a explorar a mobilidade sem forçar amplitudes. Se a rigidez for incomum ou piorar, converse com o fisioterapeuta."
  };
  return {
    title:"Autonomia no dia a dia",
    body:"Continue observando como se sente e siga o ritmo e os exercícios indicados pelo fisioterapeuta, sem aumentar a carga por conta própria."
  };
}
let currentPatientExercise=0;
let workoutCompletedInView=false;
function patientExerciseAssignments(){
  return plans.flatMap(plan=>[...(plan.plan_exercises||[])]
    .sort((a,b)=>(a.position??0)-(b.position??0))
    .map(exercise=>({plan,exercise})));
}
async function completePatientWorkout(){
  if(!isAuthenticated()||isProfessional()||busy||workoutCompletedInView)return;
  const assigned=patientExerciseAssignments();
  if(!assigned.length||currentPatientExercise!==assigned.length-1)return;
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
    result(await supabase.from("workout_sessions").insert({patient_id:user.id,exercises}));
    workoutCompletedInView=true;
    await loadPatientData();
    message("Treino concluído e registrado no histórico.");
  }catch(err){
    message("Não foi possível registrar o treino. Execute a migração de histórico no Supabase e tente novamente.",true);
    if(button)button.disabled=false;
  }finally{busy=false;}
}
function renderWorkoutDay(year,month,day){
  const root=$("sheetWorkoutHistory");
  if(!root)return;
  root.replaceChildren();
  const sessions=treinosConcluidos.filter(item=>{
    const d=new Date(item.completed_at);
    return d.getFullYear()===year&&d.getMonth()===month&&d.getDate()===day;
  });
  root.append(el("h3","Ficha de treino do dia","card-title"));
  if(!sessions.length){
    root.append(el("p","Nenhum treino concluído neste dia.","card-text-small"));
    return;
  }
  for(const session of sessions){
    const card=el("div",undefined,"workout-history-session");
    const time=new Date(session.completed_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
    card.append(el("p","Treino concluído às "+time,"workout-history-time"));
    const items=Array.isArray(session.exercises)?session.exercises:[];
    for(const item of items){
      const row=el("div",undefined,"workout-history-exercise");
      const name=item.exercise_source==="ExerciseBank"
        ?translateExerciseName(item.exercise_name):item.exercise_name;
      row.append(el("strong",name||"Exercício","workout-history-name"));
      row.append(el("span",String(item.plan_title||"Plano"),"workout-history-plan"));
      row.append(el("p",[
        ...(item.exercise_source===WALK_SOURCE?[]:["Séries: "+(item.series||"–"),"Repetições: "+(item.repetitions||"–")]),
        "Duração: "+(item.duration||"–"),"Frequência: "+(item.frequency||"–")
      ].join(" · "),"card-text-small"));
      card.append(row);
    }
    root.append(card);
  }
}
function renderPatientPlans(animar=false){
  if(!isAuthenticated()||isProfessional())return;
  const root=$("exNormalContainer");
  if(!root)return;
  root.replaceChildren();
  const assigned=patientExerciseAssignments();
  if(!assigned.length){
    root.append(el("h2","Nenhum exercício atribuído","card-title"),
      el("p","Os exercícios aparecerão aqui após a prescrição profissional.","card-text"));
    return;
  }
  currentPatientExercise=Math.max(0,Math.min(currentPatientExercise,assigned.length-1));
  const {plan,exercise}=assigned[currentPatientExercise];
  const card=el("div",undefined,"patient-exercise-card");
  if(animar)card.classList.add("patient-exercise-transition");
  const progress=el("p","Exercício "+(currentPatientExercise+1)+" de "+assigned.length,"patient-exercise-progress");
  progress.setAttribute("role","status");
  progress.setAttribute("aria-live","polite");
  card.append(progress,el("p",plan.title,"patient-plan-title"));
  const name=exercise.exercise_source==="ExerciseBank"
    ?translateExerciseName(exercise.exercise_name)
    :exercise.exercise_name;
  card.append(el("h2",name,"patient-exercise-title"));
  const parksButton=el("button","Ver parques próximos","btn btn-outline");
  parksButton.type="button";
  parksButton.id="verParquesProximos";
  parksButton.setAttribute("aria-haspopup","dialog");
  parksButton.dataset.exerciseId=exercise.id;
  parksButton.hidden=!(outdoorExerciseIds?.has(exercise.id) ?? exercise.indicacao_ar_livre===true);
  parksButton.addEventListener("click",()=>{
    outdoorSelectedId=exercise.id;
    text("nomeExercicioParques",name);
    $("parquesDialog").showModal();
    void refreshOutdoorGuide();
  });
  card.append(parksButton);

  const videoArea=el("div",undefined,"patient-exercise-video bank-media");
  if(["ExerciseBank","wger"].includes(exercise.exercise_source)&&exercise.external_id){
    card.append(videoArea);
  }

  const metrics=el("div",undefined,"patient-exercise-metrics");
  for(const [label,value] of [
    ["Séries",exercise.series],
    ["Repetições",exercise.repetitions],
    ["Duração",exercise.duration],
    ["Frequência",exercise.frequency]
  ]){
    if(value===null||value===undefined||String(value).trim()==="")continue;
    const tile=el("div",undefined,"patient-exercise-metric");
    tile.append(el("span",label,"patient-exercise-metric-label"),
      el("strong",String(value),"patient-exercise-metric-value"));
    metrics.append(tile);
  }
  card.append(metrics);
  // Instruções clínicas individuais continuam disponíveis; descrições automáticas
  // em inglês do banco de vídeos não são apresentadas como orientação ao paciente.
  if(exercise.instructions && exercise.exercise_source!=="ExerciseBank")
    card.append(el("p",exercise.instructions,"patient-exercise-instructions"));

  if(assigned.length>1){
    const actions=el("div",undefined,"demo-acoes");
    const previous=el("button","Anterior","btn btn-outline");
    previous.type="button";
    previous.disabled=currentPatientExercise===0;
    previous.addEventListener("click",()=>{
      if(currentPatientExercise>0){currentPatientExercise--;renderPatientPlans(true);}
    });
    const next=el("button","Próximo","btn");
    next.type="button";
    next.disabled=currentPatientExercise===assigned.length-1;
    next.addEventListener("click",()=>{
      if(currentPatientExercise<assigned.length-1){currentPatientExercise++;renderPatientPlans(true);}
    });
    actions.append(previous,next);
    card.append(actions);
  }
  if(currentPatientExercise===assigned.length-1){
    const finish=el("button",workoutCompletedInView?"Treino concluído ✓":"Treino concluído","btn patient-workout-finish");
    finish.id="finishPatientWorkout";
    finish.type="button";
    finish.disabled=workoutCompletedInView;
    finish.addEventListener("click",completePatientWorkout);
    card.append(finish);
  }
  root.append(card);
  if(videoArea.isConnected){
    loadExerciseMedia(exercise.external_id,videoArea,null,exercise.exercise_source,true);
  }
}
function renderProfessionalPlans(){
  if(!isProfessional())return;
  updatePatientSelectors();
  const patient=patients.find(p=>p.id===patientId);
  text("profPlanosDescricao",patient?"Planos de "+patient.display_name:"Nenhum paciente vinculado");
  const root=$("listaPlanosProf");
  root.replaceChildren();
  if(!plans.length)root.append(el("p","Nenhum plano disponível.","demo-vazio"));
  const createEntry=$("createPlanEntry");
  createEntry.disabled=!patientId;
  createEntry.textContent=plans.length?"Criar outro plano terapêutico":"Criar plano terapêutico";
  for(const p of plans){
    const card=el("div",undefined,"card");
    card.append(el("h2",p.title,"card-title"));
    if(p.notes)card.append(el("p",p.notes,"card-text"));
    for(const x of [...(p.plan_exercises||[])].sort((a,b)=>a.position-b.position)){
      const line=el("div",undefined,"demo-detalhe");
      line.append(el("strong",x.exercise_name,"plan-exercise-name"));
      if(x.indicacao_ar_livre)line.append(el("p","Indicação ao ar livre","card-text-small guia-tag"));
      const quantidade=x.exercise_source===WALK_SOURCE?"":(x.series||"–")+" série(s) · "+(x.repetitions||"–")+" repetições · ";
      line.append(el("p",quantidade+(x.duration||"–")+" duração · "+x.frequency,"plan-exercise-prescription"));
      if(["ExerciseBank","wger"].includes(x.exercise_source) && x.external_id){
        const view=el("button","Ver demonstração","btn btn-outline");
        view.type="button";
        const media=el("div",undefined,"bank-media");
        view.setAttribute("aria-expanded","false");
        view.addEventListener("click",()=>{
          const abrir=view.getAttribute("aria-expanded")==="false";
          view.setAttribute("aria-expanded",String(abrir));
          view.textContent=abrir?"Ocultar demonstração":"Ver demonstração";
          if(abrir)loadExerciseMedia(x.external_id,media,view,x.exercise_source,true);
          else{
            media.querySelector("video")?.pause();
            media.replaceChildren();
          }
        });
        line.append(view,media);
      }
      card.append(line);
    }
    const actions=el("div",undefined,"demo-acoes");
    const edit=el("button","Editar","btn");
    const remove=el("button","Excluir","btn btn-outline");
    edit.type="button";
    remove.type="button";
    edit.addEventListener("click",()=>editPlan(p.id));
    remove.addEventListener("click",()=>deletePlan(p.id));
    actions.append(edit,remove);
    card.append(actions);
    root.append(card);
  }
}
function monitoringWeeks(days){
  const today = new Date();
  const weeks = Math.ceil(days / 7);
  return Array.from({length: weeks + 1}, (_, index) => {
    const offset = Math.min(days, (weeks - index) * 7);
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1 - offset);
  });
}

function monitoringBars(rows, maximum, title){
  const list = el("ul", undefined, "monitoring-bars");
  list.setAttribute("role", "list");
  list.setAttribute("aria-label", title);
  list.tabIndex = 0;
  for (const row of rows) {
    const item = el("li", undefined, "monitoring-bar");
    item.append(el("span", row.label), el("strong", row.text));
    const track = el("span", undefined, "monitoring-track");
    track.setAttribute("aria-hidden", "true");
    const fill = el("span", undefined, "monitoring-fill");
    fill.style.blockSize = (row.value / maximum * 100) + "%";
    track.append(fill);
    item.append(track);
    list.append(item);
  }
  return list;
}

function monitoringTopic(label, panel){
  const details = el("details", undefined, "monitoring-topic");
  const summary = el("summary", label);
  details.append(summary, panel);
  details.addEventListener("toggle", () => {
    summary.textContent = details.open ? label.replace(/^Ver /, "Ocultar ") : label;
  });
  return details;
}

function renderProfessionalMonitoring(windows, periodRecords){
  const root = $("graficosRegistrosProf");
  root.replaceChildren();
  if (!patientId) return;
  if (professionalWorkouts === undefined) {
    root.append(el("p", "Carregando acompanhamento…", "card-text"));
    return;
  }

  root.append(el("h2", "Acompanhamento do paciente", "card-title"));
  const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
  const latestByDay = new Map();
  for (const record of periodRecords) {
    const day = localDateKey(record.recorded_at);
    if (day && !latestByDay.has(day)) latestByDay.set(day, record);
  }
  const recent = [...latestByDay.values()].reverse();
  const workoutCard = el("section", undefined, "card");
  workoutCard.append(el("h3", "Treinos concluídos por semana", "card-title"),
    el("p", "Cada treino conta uma vez no gráfico.", "card-text"));
  if (professionalWorkouts === null) {
    workoutCard.append(el("p", "Não foi possível carregar os treinos.", "card-text-small"));
  } else {
    const planOptions = new Map(plans.map(plan => [plan.id, plan.title]));
    for (const session of professionalWorkouts) {
      for (const exercise of session.exercises || []) {
        if (exercise.plan_id && !planOptions.has(exercise.plan_id)) {
          planOptions.set(exercise.plan_id, exercise.plan_title || "Plano anterior");
        }
      }
    }
    const select = el("select", undefined, "form-input");
    select.id = "monitoramentoPlano";
    const all = el("option", "Todos os planos");
    all.value = "";
    select.append(all);
    for (const [id, title] of planOptions) {
      const option = el("option", title);
      option.value = id;
      select.append(option);
    }
    const filter = el("div", undefined, "form-group");
    const label = el("label", "Escolha o plano", "form-label");
    label.htmlFor = select.id;
    filter.append(label, select);
    const output = el("div");
    output.setAttribute("aria-live", "polite");
    const showSessions = () => {
      const counts = Array(windows.length - 1).fill(0);
      for (const session of professionalWorkouts) {
        if (select.value && !session.exercises?.some(exercise => exercise.plan_id === select.value)) continue;
        const time = new Date(session.completed_at);
        const week = counts.findIndex((_, index) => time >= windows[index] && time < windows[index + 1]);
        if (week >= 0) counts[week] += 1;
      }
      const rows = counts.map((count, index) => {
        const lastDay = new Date(windows[index + 1]);
        lastDay.setDate(lastDay.getDate() - 1);
        return { label: shortDate.format(windows[index]) + " a " + shortDate.format(lastDay),
          text: count + (count === 1 ? " treino" : " treinos"), value: count };
      });
      const chart = monitoringBars(rows, Math.max(1, ...counts), "Treinos concluídos por período");
      chart.classList.add("monitoring-bars-weekly");
      chart.removeAttribute("tabindex");
      output.replaceChildren(chart);
    };
    select.addEventListener("change", showSessions);
    workoutCard.append(filter, output);
    if (professionalWorkouts.length === 500) {
      workoutCard.append(el("p", "O gráfico usa até os 500 treinos mais recentes dos últimos 90 dias.", "card-text-small"));
    }
    showSessions();
  }
  root.append(monitoringTopic("Ver treinos concluídos", workoutCard));
  for (const [key, title, buttonLabel] of [
    ["stiffness", "Rigidez", "Ver nível de rigidez"],
    ["fatigue", "Cansaço (fadiga)", "Ver nível de cansaço"],
    ["activity_level", "Nível de atividade física", "Ver nível de atividade física"]
  ]) {
    const card = el("section", undefined, "card");
    card.append(el("h3", title, "card-title"),
      el("p", "O gráfico mostra o último relato de cada dia com registro.", "card-text"));
    const rows = recent.filter(record => levels.includes(record[key])).map(record => ({
      label: shortDate.format(new Date(record.recorded_at)),
      text: record[key], value: levels.indexOf(record[key])
    }));
    card.append(rows.length ? monitoringBars(rows, levels.length - 1, title + " por dia")
      : el("p", "Nenhum relato disponível.", "card-text-small"));
    root.append(monitoringTopic(buttonLabel, card));
  }
}

function renderProfessionalRecords(){
  if(!isProfessional())return;
  updatePatientSelectors();
  const ready=!!patientId && professionalWorkouts !== undefined;
  $("periodoAcompanhamento").disabled=!ready;
  const windows=monitoringWeeks(Number($("periodoAcompanhamento").value));
  const periodRecords=records.filter(record=>{
    const time=new Date(record.recorded_at);
    return time>=windows[0] && time<windows.at(-1);
  });
  renderProfessionalMonitoring(windows, periodRecords);
  if (!patientId || professionalWorkouts === undefined) return;
  const root = el("div");
  root.id = "listaRegistrosProf";
  $("graficosRegistrosProf").append(monitoringTopic("Ver registros individuais", root));
  if(!periodRecords.length)root.append(el("p","Nenhum registro no período selecionado.","demo-vazio"));
  for(const r of periodRecords) {
    const card=el("div",undefined,"card");
    card.append(el("h3",date(r.recorded_at),"card-title"));
    card.append(el("p","Quando ficou parado: "+resumirDor(r.pain_rest,r.pain_rest_comparison)+" | Ao se mexer: "+resumirDor(r.pain_movement,r.pain_movement_comparison),"card-text"));
    card.append(el("p","Rigidez: "+r.stiffness+" · Fadiga: "+r.fatigue,"card-text-small"));
    card.append(el("p","Humor: "+(r.mood ?? "Não registrado")+
      " · Nível de atividade física: "+(r.activity_level ?? "Não registrado"),"card-text-small"));
    const clima=mapWeather(r);
    if(clima)card.append(el("p","Clima registrado em "+date(clima.observadoEm)+": "+clima.temperatura+" °C · "+clima.umidade+"% · "+clima.pressao+" hPa ("+clima.cidade+")","card-text-small"));
    root.append(card);
  }
}
function addExercise(entry){
  if(!isProfessional())return;
  const row=el("div",undefined,"demo-exercicio-item");
  const label=el("label","Nome do exercício","form-label");
  const name=el("input",undefined,"form-input");
  name.name="customName";
  name.maxLength=160;
  name.required=true;
  name.value=entry?.exercise_name??"";
  name.readOnly=!!entry?.external_id;
  label.append(name);
  row.append(label);
  row.dataset.externalId=entry?.external_id??"";
  row.dataset.exerciseSource=entry?.exercise_source??"manual";
  row.dataset.instructions=entry?.instructions??"";
  const walking=row.dataset.exerciseSource===WALK_SOURCE;
  const params=el("div",undefined,"demo-grid-parametros");
  for(const [key,title,type,value] of [
    ["series","Séries","number",2],
    ["repetitions","Repetições","text","10"],
    ["duration","Duração","text",""],
    ["frequency","Frequência","text","3 vezes por semana"]
  ]){
    if(walking && (key==="series" || key==="repetitions"))continue;
    const wrap=el("div",undefined,"form-group");
    const lbl=el("label",title,"form-label");
    const input=el("input",undefined,"form-input");
    input.name=key;input.type=type;input.value=value;
    if(type==="number"){input.min="1";input.max="20";}
    else input.maxLength=80;
    lbl.append(input);wrap.append(lbl);params.append(wrap);
  }
  row.append(params);
  const outdoorLabel=el("label",undefined,"form-label guia-indicacao");
  const outdoor=el("input");
  outdoor.type="checkbox";
  outdoor.name="indicacao_ar_livre";
  outdoor.checked=entry?.indicacao_ar_livre===true;
  const help=el("p","Habilita para o paciente a busca de parques próximos e orientações climáticas de autocuidado.","card-text-small");
  help.id="guia-indicacao-" + crypto.randomUUID();
  outdoor.setAttribute("aria-describedby",help.id);
  outdoorLabel.append(outdoor, "Recomendar realização em parques ou áreas verdes ao ar livre");
  row.append(outdoorLabel,help);
  const remove=el("button","Remover exercício","btn btn-outline");
  remove.type="button";
  remove.addEventListener("click",()=>{row.remove();updatePlanEditorSummary();});
  row.append(remove);
  $("itensPlanoProf").append(row);
  if(entry){
    if(name.readOnly){
      const sourceLabel=el("p",entry.exercise_source==="ExerciseBank"?"ExerciseBank · catálogo de demonstração":"wger · vídeo sujeito à disponibilidade e licença","card-text-small");
      row.prepend(sourceLabel);
    }
    for(const field of params.querySelectorAll("input"))field.value=entry[field.name]??"";
  }
}
let exerciseReturnPage="planos-prof";
let pendingExerciseRow=null;
let pendingExercisePlaceholder=null;
let camposExercicioAntes=[];
function exerciseNameFromRow(row){
  return row.querySelector('[name="customName"]').value.trim();
}
function updatePlanEditorSummary(){
  const stored=$("itensPlanoProf");
  const rows=Array.from(stored?.children||[]).filter(row=>row.classList.contains("demo-exercicio-item"));
  $("salvarPlanoBtn").hidden=!rows.length;
  for(const painel of document.querySelectorAll("[data-exercicios-selecionados]")){
    painel.hidden=!rows.length;
    painel.querySelector("summary").textContent="Exercícios adicionados ("+rows.length+")";
    painel.querySelector("ul").replaceChildren(...rows.map(row=>el("li",exerciseNameFromRow(row))));
  }
  const list=$("resumoExerciciosPlano");
  list.replaceChildren();
  rows.forEach((row,index)=>{
    const item=el("div",undefined,"exercise-summary-item");
    const heading=el("strong",(index+1)+". "+(exerciseNameFromRow(row)||"Exercício sem nome"),"exercise-summary-name");
    const detail=el("p",[
      ...(row.dataset.exerciseSource===WALK_SOURCE?[]:[
        "Séries: "+(row.querySelector('[name="series"]').value||"–"),
        "Repetições: "+(row.querySelector('[name="repetitions"]').value||"–")
      ]),
      "Duração: "+(row.querySelector('[name="duration"]')?.value||"–"),
      "Frequência: "+(row.querySelector('[name="frequency"]')?.value||"–")
    ].join(" · "),"card-text-small");
    const actions=el("div",undefined,"demo-acoes");
    const edit=el("button","Editar exercício","btn btn-outline");
    edit.type="button";
    edit.addEventListener("click",()=>openExerciseConfiguration(row,true));
    const remove=el("button","Remover","btn btn-outline");
    remove.type="button";
    remove.addEventListener("click",()=>{row.remove();updatePlanEditorSummary();});
    actions.append(edit,remove);
    item.append(heading,detail,actions);
    list.append(item);
  });
}
function openExerciseSourceOptions(){
  if(!isProfessional())return;
  exerciseReturnPage=$("page-editor-prof").classList.contains("active")?"editor-prof":"planos-prof";
  navigate("exercise-source-prof");
}
function backFromExerciseSource(){
  navigate(exerciseReturnPage);
  if(exerciseReturnPage==="editor-prof"&&!editingPlan&&!$("itensPlanoProf").children.length){
    mostrarEtapaPlano(false);
    $("nomePlanoProf").focus();
  }
}
function addManualExerciseFromOptions(outdoor=false){
  if(!isProfessional())return;
  addExercise(outdoor ? {exercise_name:"Caminhada ao ar livre", exercise_source:WALK_SOURCE, indicacao_ar_livre:true} : undefined);
  openExerciseConfiguration($("itensPlanoProf").lastElementChild);
}
function openExerciseBankFromOptions(){
  if(!isProfessional())return;
  navigate("exercise-bank-prof");
}
function openExerciseConfiguration(row,existing=false){
  if(!isProfessional()||!row)return;
  if(pendingExerciseRow)return;
  pendingExerciseRow=row;
  pendingExercisePlaceholder=existing?document.createElement("span"):null;
  if(existing)row.before(pendingExercisePlaceholder);
  camposExercicioAntes=existing ? [...row.querySelectorAll("input")].map(campo=>[campo,campo.value,campo.checked]) : [];
  $("exerciseConfigRow").append(row);
  const remove=row.querySelector("button.btn-outline");
  if(remove)remove.hidden=true;
  text("erroConfigExercicio","");
  $("exerciseConfigDialog").showModal();
}
function finishExerciseInsertion(){
  if(!pendingExerciseRow)return;
  const row=pendingExerciseRow;
  const exercise=readExercise(row);
  if(!validExercise(exercise)){
    text("erroConfigExercicio",exercise.exercise_source===WALK_SOURCE
      ?"Informe o nome da caminhada, a duração e a frequência."
      :"Informe o exercício, as séries, as repetições ou duração e a frequência.");
    return;
  }
  const remove=row.querySelector("button.btn-outline");
  if(remove)remove.hidden=false;
  if(pendingExercisePlaceholder){
    pendingExercisePlaceholder.replaceWith(row);
  }else{
    $("itensPlanoProf").append(row);
  }
  pendingExerciseRow=null;
  pendingExercisePlaceholder=null;
  camposExercicioAntes=[];
  $("exerciseConfigDialog").close();
  updatePlanEditorSummary();
  message("Exercício inserido. Revise a quantidade e salve o plano quando terminar.");
}
function backFromExerciseConfiguration(){
  if(!pendingExerciseRow)return;
  const remove=pendingExerciseRow.querySelector("button.btn-outline");
  if(remove)remove.hidden=false;
  for(const [campo,value,checked] of camposExercicioAntes){
    campo.value=value;
    campo.checked=checked;
  }
  if(pendingExercisePlaceholder)pendingExercisePlaceholder.replaceWith(pendingExerciseRow);
  else pendingExerciseRow.remove();
  pendingExerciseRow=null;
  pendingExercisePlaceholder=null;
  camposExercicioAntes=[];
  $("exerciseConfigDialog").close();
}
function mostrarEtapaPlano(exercicios){
  $("dadosPlanoProf").hidden=exercicios&&!editingPlan;
  $("etapaExerciciosPlano").hidden=!exercicios;
  $("avancarPlanoProf").hidden=exercicios;
  $("voltarDadosPlano").hidden=!!editingPlan;
  $("cancelarPlanoBtn").hidden=exercicios&&!editingPlan;
  text("tituloFormularioPlano",editingPlan?"Editar plano terapêutico":exercicios?"Adicionar exercícios":"Criar plano terapêutico");
}
function avancarPlano(){
  if(!isProfessional()||!patientId)return;
  const nome=$("nomePlanoProf");
  if(!nome.reportValidity())return;
  if(nome.value.trim().length<2){nome.focus();return message("Informe o nome do plano.",true);}
  mostrarEtapaPlano(true);
  openExerciseSourceOptions();
  $("tituloOrigemExercicios").focus();
}
function createPlanFromScratch(){
  if(!isProfessional())return;
  clearPlanForm();
  navigate("editor-prof");
}
function cancelPlanEditor(){
  if(!isProfessional()||busy)return;
  const form=$("formPlanoProf");
  const hasDraft=!!editingPlan||!!$("itensPlanoProf")?.children.length||
    !!$("nomePlanoProf")?.value.trim()||!!$("orientacoesPlanoProf")?.value.trim();
  if(hasDraft&&!confirm("Descartar as alterações não salvas e cancelar a edição?"))return;
  clearPlanForm();
  if(form)form.reset();
  navigate("planos-prof");
  message("Edição cancelada. Nenhuma alteração foi salva.");
}
function clearPlanForm(){
  editingPlan=null;
  if(pendingExerciseRow)pendingExerciseRow.remove();
  if(pendingExercisePlaceholder)pendingExercisePlaceholder.remove();
  pendingExerciseRow=null;
  pendingExercisePlaceholder=null;
  $("formPlanoProf").reset();
  $("itensPlanoProf").replaceChildren();
  updatePlanEditorSummary();
  camposExercicioAntes=[];
  $("exerciseConfigDialog").close();
  mostrarEtapaPlano(false);
}
function editPlan(id){
  const plan=plans.find(p=>p.id===id);
  if(!plan||!isProfessional())return;
  clearPlanForm();
  editingPlan=id;
  $("nomePlanoProf").value=plan.title;
  $("orientacoesPlanoProf").value=plan.notes||"";
  for(const x of [...(plan.plan_exercises||[])].sort((a,b)=>a.position-b.position))addExercise(x);
  mostrarEtapaPlano(true);
  navigate("editor-prof");
}
function readExercise(row,position){
  const v=key=>row.querySelector('[name="'+key+'"]')?.value.trim()??"";
  const walking=row.dataset.exerciseSource===WALK_SOURCE;
  return {
    exercise_name:exerciseNameFromRow(row),
    exercise_source:row.dataset.exerciseSource,
    external_id:row.dataset.externalId||null,
    series:walking?null:Number(v("series")),
    repetitions:walking?null:v("repetitions"),
    duration:v("duration"),
    frequency:v("frequency"),
    instructions:row.dataset.instructions,
    indicacao_ar_livre:row.querySelector('[name="indicacao_ar_livre"]').checked,
    position
  };
}
function validExercise(exercise){
  if(exercise.exercise_name.length<2||!exercise.frequency)return false;
  if(exercise.exercise_source===WALK_SOURCE)return !!exercise.duration;
  return Number.isInteger(exercise.series)&&exercise.series>=1&&exercise.series<=20&&
    !!(exercise.repetitions||exercise.duration);
}
async function savePlan(event){
  if(event)event.preventDefault();
  if(!isProfessional()||!patientId||busy)return;
  if($("etapaExerciciosPlano").hidden)return avancarPlano();
  const title=$("nomePlanoProf").value.trim();
  const items=Array.from($("itensPlanoProf").children,readExercise);
  if(title.length<2||!items.length)return message("Informe um nome e pelo menos um exercício.",true);
  if(!items.every(validExercise))
    return message("Verifique os campos de cada exercício antes de salvar.",true);
  busy=true;
  let insertedId=null;
  try{
    const data={title,notes:$("orientacoesPlanoProf").value.trim(),patient_id:patientId,physiotherapist_id:user.id};
    if(editingPlan){
      result(await supabase.from("care_plans").update({title:data.title,notes:data.notes,updated_at:new Date().toISOString()}).eq("id",editingPlan));
      result(await supabase.from("plan_exercises").delete().eq("plan_id",editingPlan));
      result(await supabase.from("plan_exercises").insert(items.map(x=>({...x,plan_id:editingPlan}))));
    }else{
      const plan=result(await supabase.from("care_plans").insert(data).select("id").single());
      insertedId=plan.id;
      result(await supabase.from("plan_exercises").insert(items.map(x=>({...x,plan_id:insertedId}))));
    }
    clearPlanForm();
    await loadPatientData();
    navigate("planos-prof");
    message("Plano salvo para o paciente vinculado.");
  }catch(err){
    if(insertedId)await supabase.from("care_plans").delete().eq("id",insertedId);
    message("Não foi possível salvar o plano. Verifique os dados e tente novamente.",true);
  }finally{busy=false;}
}
async function deletePlan(id){
  if(!isProfessional()||busy||!confirm("Excluir este plano?"))return;
  busy=true;
  try{
    result(await supabase.from("care_plans").delete().eq("id",id));
    clearPlanForm();
    await loadPatientData();
    message("Plano excluído.");
  }catch(err){message("Não foi possível excluir o plano.",true);}
  finally{busy=false;}
}
async function saveSymptoms(){
  if(!isAuthenticated()||isProfessional()||busy)return;
  busy=true;
  const paciente = user;
  const registro = {
    patient_id: paciente.id,
    stiffness: levels[rigidezAtual],
    fatigue: levels[fadigaAtual],
    pain_rest_comparison: $("dorParadoComparacao").querySelector(".selected")?.value ?? null,
    pain_movement_comparison: $("dorMovimentoComparacao").querySelector(".selected")?.value ?? null,
    mood: moods[humorAtual] ?? null,
    activity_level: levels[atividadeAtual] ?? null
  };
  try {
    const clima = await obterClimaBrasilia().catch(() => null);
    if (user !== paciente) return;
    const associarClima = clima && weatherColumnsAvailable;
    let saved = await supabase.from("symptom_records").insert(associarClima ? {...registro, ...clima} : registro);
    if (saved.error && associarClima && isMissingWeatherColumns(saved.error)) {
      if (user !== paciente) return;
      weatherColumnsAvailable = false;
      saved = await supabase.from("symptom_records").insert(registro);
    }
    result(saved);
    if (user !== paciente) return;
    await loadPatientData();
    navigate("inicio");
    message(clima&&weatherColumnsAvailable
      ? "Sintomas e condições meteorológicas registrados. O plano permanece inalterado."
      : "Sintomas registrados. Clima indisponível ou atualização do banco pendente; nenhuma medição foi associada a este registro.", !(clima&&weatherColumnsAvailable));
    if(atipico===1)
      alert("Se os sintomas forem intensos ou inesperados, procure orientação profissional. Este aplicativo não realiza triagem clínica.");
  }catch(err){message("Não foi possível salvar os sintomas. Confira a conexão.",true);}
  finally{busy=false;}
}


let sampleList=null,loadingSample=false;
async function ebCall(opts={}){
  if(!supabase||!isAuthenticated())throw Error("Entre para consultar a biblioteca.");
  const session=await supabase.auth.getSession();
  const token=session.data?.session?.access_token;
  if(!token)throw Error("Sua sessão terminou. Entre novamente.");
  const response=await fetch("/api/exercisebank",{...opts,headers:{Authorization:"Bearer "+token,...opts.headers},cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||"ExerciseBank indisponível.");
  return data;
}
async function loadSample(force=false){
  if(!isProfessional()||loadingSample)return;
  if(sampleList&&!force){renderSample();return;}
  loadingSample=true;$("exercisebankRefresh").disabled=true;
  text("exercisebankStatus","Carregando exercícios...");
  try{
    sampleList=await ebCall();
    renderSample();
  }catch(e){
    sampleList=null;$("exercisebankResults").replaceChildren();
    text("exercisebankStatus",e.message);
  }finally{loadingSample=false;$("exercisebankRefresh").disabled=false;}
}
const BODY_REGION_LABELS={
  ombros:"Ombros",bracos:"Braços e antebraços",peito:"Peito",costas:"Costas",
  abdomen:"Abdômen e tronco",quadril:"Quadril e glúteos",coxas:"Coxas",
  pernas:"Panturrilhas e pernas","nao-classificados":"Não classificados"
};
const MUSCLE_TO_REGION={
  shoulders:"ombros",shoulder:"ombros",delts:"ombros",deltoids:"ombros",
  biceps:"bracos",triceps:"bracos",forearms:"bracos",forearm:"bracos",brachialis:"bracos",
  chest:"peito",pecs:"peito",pectorals:"peito",
  back:"costas",lats:"costas",traps:"costas",trapezius:"costas",rhomboids:"costas",erectors:"costas",lower_back:"costas",
  abs:"abdomen",abdominals:"abdomen",core:"abdomen",obliques:"abdomen",transverse_abs:"abdomen",
  glutes:"quadril",gluteals:"quadril",hip_flexors:"quadril",hip_adductors:"quadril",adductors:"quadril",abductors:"quadril",hips:"quadril",
  quads:"coxas",quadriceps:"coxas",hamstrings:"coxas",thighs:"coxas",
  calves:"pernas",calf:"pernas",gastrocnemius:"pernas",soleus:"pernas",shins:"pernas",tibialis:"pernas"
};
// Equivalências brasileiras por exercício completo; nunca traduzir por tokens soltos.
// Nomes não reconhecidos permanecem no idioma original para revisão profissional.
const EXERCISE_NAMES_PT={
  "squat":"Agachamento",
  "squats":"Agachamentos",
  "bodyweight squat":"Agachamento com peso corporal",
  "air squat":"Agachamento livre",
  "back squat":"Agachamento com barra nas costas",
  "barbell back squat":"Agachamento com barra nas costas",
  "front squat":"Agachamento frontal",
  "barbell front squat":"Agachamento frontal com barra",
  "goblet squat":"Agachamento goblet",
  "dumbbell goblet squat":"Agachamento goblet com halter",
  "sumo squat":"Agachamento sumô",
  "split squat":"Agachamento com base alternada",
  "bulgarian split squat":"Agachamento búlgaro",
  "jump squat":"Agachamento com salto",
  "wall squat":"Agachamento na parede",
  "wall sit":"Agachamento isométrico na parede",
  "box squat":"Agachamento no banco",
  "chair squat":"Agachamento com cadeira",
  "leg press":"Leg press",
  "leg extension":"Extensão de joelhos na cadeira extensora",
  "seated leg extension":"Extensão de joelhos sentado",
  "leg curl":"Flexão de joelhos",
  "lying leg curl":"Flexão de joelhos na mesa flexora",
  "seated leg curl":"Flexão de joelhos na cadeira flexora",
  "romanian deadlift":"Levantamento terra romeno",
  "barbell romanian deadlift":"Levantamento terra romeno com barra",
  "dumbbell romanian deadlift":"Levantamento terra romeno com halteres",
  "deadlift":"Levantamento terra",
  "conventional deadlift":"Levantamento terra convencional",
  "sumo deadlift":"Levantamento terra sumô",
  "stiff leg deadlift":"Levantamento terra com joelhos estendidos (stiff)",
  "stiff legged deadlift":"Levantamento terra com joelhos estendidos (stiff)",
  "hip hinge":"Flexão do quadril (padrão hinge)",
  "good morning":"Bom-dia",
  "hip thrust":"Elevação de quadril com apoio",
  "glute bridge":"Ponte de glúteos",
  "hip bridge":"Ponte de quadril",
  "bridge":"Ponte",
  "single leg glute bridge":"Ponte de glúteos unilateral",
  "single leg bridge":"Ponte unilateral",
  "clamshell":"Abdução de quadril em decúbito lateral (conchinha)",
  "clam shell":"Abdução de quadril em decúbito lateral (conchinha)",
  "fire hydrant":"Abdução de quadril em quatro apoios",
  "donkey kick":"Extensão de quadril em quatro apoios",
  "bird dog":"Extensão alternada de braço e perna em quatro apoios",
  "dead bug":"Estabilização abdominal com braços e pernas alternados (dead bug)",
  "plank":"Prancha ventral",
  "front plank":"Prancha ventral",
  "forearm plank":"Prancha ventral sobre antebraços",
  "side plank":"Prancha lateral",
  "reverse plank":"Prancha invertida",
  "high plank":"Prancha com braços estendidos",
  "mountain climber":"Escalador",
  "crunch":"Abdominal curto",
  "abdominal crunch":"Abdominal curto",
  "bicycle crunch":"Abdominal bicicleta",
  "reverse crunch":"Abdominal reverso",
  "sit up":"Abdominal completo",
  "sit ups":"Abdominais completos",
  "russian twist":"Rotação de tronco sentada (russian twist)",
  "leg raise":"Elevação de pernas",
  "lying leg raise":"Elevação de pernas em decúbito dorsal",
  "hanging leg raise":"Elevação de pernas em suspensão",
  "superman":"Extensão de tronco e membros em decúbito ventral",
  "back extension":"Extensão de tronco",
  "cat cow":"Mobilização da coluna em quatro apoios (gato-vaca)",
  "cat camel":"Mobilização da coluna em quatro apoios (gato-camelo)",
  "push up":"Flexão de braços",
  "push ups":"Flexões de braços",
  "pushup":"Flexão de braços",
  "knee push up":"Flexão de braços com apoio dos joelhos",
  "wall push up":"Flexão de braços na parede",
  "incline push up":"Flexão de braços inclinada",
  "decline push up":"Flexão de braços declinada",
  "diamond push up":"Flexão de braços com mãos próximas",
  "close grip push up":"Flexão de braços com pegada fechada",
  "bench press":"Supino reto",
  "barbell bench press":"Supino reto com barra",
  "dumbbell bench press":"Supino reto com halteres",
  "incline bench press":"Supino inclinado",
  "barbell incline bench press":"Supino inclinado com barra",
  "dumbbell incline bench press":"Supino inclinado com halteres",
  "decline bench press":"Supino declinado",
  "chest press":"Supino na máquina",
  "machine chest press":"Supino na máquina",
  "dumbbell fly":"Crucifixo com halteres",
  "dumbbell flye":"Crucifixo com halteres",
  "chest fly":"Crucifixo",
  "cable fly":"Crucifixo no cabo",
  "cable crossover":"Crucifixo no crossover",
  "pec deck":"Crucifixo na máquina",
  "pull up":"Barra fixa com pegada pronada",
  "pull ups":"Barra fixa com pegada pronada",
  "chin up":"Barra fixa com pegada supinada",
  "chin ups":"Barra fixa com pegada supinada",
  "lat pulldown":"Puxada alta",
  "wide grip lat pulldown":"Puxada alta com pegada aberta",
  "close grip lat pulldown":"Puxada alta com pegada fechada",
  "straight arm pulldown":"Puxada com braços estendidos",
  "seated row":"Remada sentada",
  "cable seated row":"Remada baixa no cabo",
  "cable row":"Remada no cabo",
  "bent over row":"Remada curvada",
  "barbell bent over row":"Remada curvada com barra",
  "dumbbell bent over row":"Remada curvada com halteres",
  "one arm dumbbell row":"Remada unilateral com halter",
  "single arm dumbbell row":"Remada unilateral com halter",
  "inverted row":"Remada invertida",
  "upright row":"Remada alta",
  "face pull":"Puxada para a face",
  "shoulder press":"Desenvolvimento de ombros",
  "overhead press":"Desenvolvimento acima da cabeça",
  "military press":"Desenvolvimento militar",
  "dumbbell shoulder press":"Desenvolvimento de ombros com halteres",
  "barbell shoulder press":"Desenvolvimento de ombros com barra",
  "arnold press":"Desenvolvimento Arnold",
  "lateral raise":"Elevação lateral dos braços",
  "dumbbell lateral raise":"Elevação lateral com halteres",
  "front raise":"Elevação frontal dos braços",
  "dumbbell front raise":"Elevação frontal com halteres",
  "rear delt fly":"Crucifixo inverso",
  "reverse fly":"Crucifixo inverso",
  "shrug":"Encolhimento de ombros",
  "barbell shrug":"Encolhimento de ombros com barra",
  "dumbbell shrug":"Encolhimento de ombros com halteres",
  "biceps curl":"Rosca bíceps",
  "barbell curl":"Rosca direta com barra",
  "dumbbell curl":"Rosca direta com halteres",
  "hammer curl":"Rosca martelo",
  "concentration curl":"Rosca concentrada",
  "preacher curl":"Rosca Scott",
  "incline dumbbell curl":"Rosca inclinada com halteres",
  "triceps pushdown":"Extensão de cotovelos na polia alta",
  "rope triceps pushdown":"Extensão de cotovelos com corda na polia alta",
  "overhead triceps extension":"Extensão de cotovelos acima da cabeça",
  "triceps kickback":"Coice de tríceps",
  "bench dip":"Mergulho de tríceps no banco",
  "triceps dip":"Mergulho de tríceps",
  "calf raise":"Elevação de panturrilhas",
  "standing calf raise":"Elevação de panturrilhas em pé",
  "seated calf raise":"Elevação de panturrilhas sentado",
  "single leg calf raise":"Elevação de panturrilha unilateral",
  "hip abduction":"Abdução de quadril",
  "hip adduction":"Adução de quadril",
  "side lying hip abduction":"Abdução de quadril em decúbito lateral",
  "standing hip abduction":"Abdução de quadril em pé",
  "lunge":"Avanço",
  "lunges":"Avanços",
  "forward lunge":"Avanço à frente",
  "reverse lunge":"Avanço para trás",
  "walking lunge":"Avanço com deslocamento",
  "lateral lunge":"Avanço lateral",
  "step up":"Subida em degrau",
  "step down":"Descida de degrau",
  "box step up":"Subida no banco",
  "jumping jack":"Polichinelo",
  "jump rope":"Pular corda",
  "burpee":"Burpee",
  "high knees":"Corrida estacionária com elevação dos joelhos",
  "marching in place":"Marcha estacionária",
  "one-leg elbow plank":"Prancha sobre antebraços com uma perna elevada",
  "one leg elbow plank":"Prancha sobre antebraços com uma perna elevada",
  "alternating decline dumbbell press":"Supino declinado alternado com halteres",
  "prone swimmer":"Extensão de tronco e movimentos dos braços em decúbito ventral",
  "dumbbell bent-over row to biceps curl":"Remada curvada seguida de rosca bíceps com halteres",
  "alternating dumbbell shoulder flexion on an incline bench":"Flexão alternada de ombros com halteres em banco inclinado",
  "alternating dumbbell shoulder flexion on incline bench":"Flexão alternada de ombros com halteres em banco inclinado",
  "upright row (resistance band)":"Remada alta com faixa elástica",
  "alternating upright row (resistance band)":"Remada alta alternada com faixa elástica",
  "dan john get-up":"Levantada do solo (variação Dan John)",
  "single-leg swing hop":"Salto unilateral com balanço da perna",
  "dumbbell king kong":"Levantamento terra sumô, rosca e desenvolvimento com halteres (King Kong)",
  "alternating-arm dumbbell king kong":"King Kong com halteres e braços alternados",
  "alternating forward lunge with lateral raise":"Avanço à frente alternado com elevação lateral dos braços",
  "forearm plank lateral elbow walk":"Deslocamento lateral na prancha sobre antebraços",
  "alternating fast feet":"Passos rápidos alternados",
  "wind relieving pose (one knee)":"Postura de liberação dos ventos com um joelho ao peito",
  "wind relieving pose (single knee)":"Postura de liberação dos ventos com um joelho ao peito",
  "single-leg romanian deadlift with dumbbells":"Levantamento terra romeno unilateral com halteres",
  "dumbbell discus throw":"Arremesso rotacional com halter",
  "suitcase carry":"Caminhada com carga unilateral (suitcase carry)",
  "eagle pose":"Postura da águia (Garudasana)",
  "alternating dumbbell floor press":"Supino no solo alternado com halteres",
  "banded single-leg heel drop (inward pull)":"Descida unilateral do calcanhar com tração elástica para dentro",
  "banded single-leg heel drop (outward pull)":"Descida unilateral do calcanhar com tração elástica para fora",
  "dumbbell pull complex":"Sequência combinada de puxadas com halteres",
  "alternating seated arnold press":"Desenvolvimento Arnold sentado e alternado",
  "alternating seated arnold shoulder press":"Desenvolvimento Arnold sentado e alternado",
  "lateral hollow rock":"Balanço lateral em posição de hollow body",
  "cross-body jumping jack":"Polichinelo cruzado",
  "skier arm swing":"Balanço dos braços do esquiador",
  "alternating reverse lunge with lateral raise":"Avanço para trás alternado com elevação lateral dos braços",
  "split-stance sprinter arms":"Simulação de corrida com braços em base alternada",
  "bear-stance push-up":"Flexão de braços em posição de urso",
  "prone superman with shoulder retraction":"Extensão de tronco em decúbito ventral com retração escapular",
  "arnold press on exercise ball":"Desenvolvimento Arnold sentado na bola suíça",
  "kipping pull-up":"Barra fixa com balanço (kipping)",
  "side-to-side lateral mountain climber":"Escalador lateral alternado",
  "side-to - lateral mountain climber":"Escalador lateral alternado",
  "seal jack":"Polichinelo com abertura horizontal dos braços",
  "split squat with lateral raise":"Agachamento em base alternada com elevação lateral dos braços",
  "battle rope lateral plank waves":"Ondulações de corda naval em prancha lateral",
  "battle rope lateral plank circles":"Círculos com corda naval em prancha lateral",
  "quickstep both feet on and off, front and back":"Passos rápidos com ambos os pés, entrando e saindo à frente e atrás",
  "quickstep two feet on and off, front and back":"Passos rápidos com ambos os pés, entrando e saindo à frente e atrás",
  "quickstep lateral to lateral, both feet together":"Saltos laterais rápidos com pés unidos",
  "child's pose":"Postura da criança (Balasana)",
  "hip bridge with leg extension":"Ponte de quadril com extensão de joelho",
  "supine spinal twist":"Rotação da coluna em decúbito dorsal",
  "downward dog to side plank":"Transição da postura do cachorro olhando para baixo para prancha lateral",
  "downward dog to lateral plank":"Transição da postura do cachorro olhando para baixo para prancha lateral",
  "blast-off push-up":"Flexão de braços com deslocamento posterior do quadril",
  "alternating decline dumbbell chest press":"Supino declinado alternado com halteres",
  "dumbbell decline alternating chest press":"Supino declinado alternado com halteres",
  "alternating decline dumbbell bench press":"Supino declinado alternado com halteres",
  "prone swimmers":"Movimentos alternados dos braços em decúbito ventral",
  "dumbbell bent over row to bicep curl":"Remada curvada seguida de rosca bíceps com halteres",
  "alternating dumbbell shoulder flexion on an inclined bench":"Flexão alternada de ombros com halteres em banco inclinado",
  "alternating dumbbell shoulder flexion incline bench":"Flexão alternada de ombros com halteres em banco inclinado",
  "one leg elbow plank":"Prancha sobre antebraços com uma perna elevada",
  "single leg elbow plank":"Prancha sobre antebraços com uma perna elevada",
  "single leg forearm plank":"Prancha sobre antebraços com uma perna elevada",
  "band alternating upright row":"Remada alta alternada com faixa elástica",
  "resistance band upright row":"Remada alta com faixa elástica",
  "alternating resistance band upright row":"Remada alta alternada com faixa elástica",
  "alternating arm dumbbell king kong":"Sequência King Kong com halteres e braços alternados",
  "alternating dumbbell king kong":"Sequência King Kong com halteres e braços alternados",
  "dumbbell pull complex":"Sequência de movimentos de puxada com halteres",
  "dumbbell pulling complex":"Sequência de movimentos de puxada com halteres",
  "alternating seated arnold shoulder press":"Desenvolvimento Arnold sentado e alternado",
  "alternating seated arnold presses":"Desenvolvimento Arnold sentado e alternado",
  "forearm plank lateral elbow walking":"Deslocamento lateral na prancha sobre antebraços",
  "forearm lateral elbow plank walk":"Deslocamento lateral na prancha sobre antebraços",
  "side to side lateral mountain climber":"Escalador lateral alternado",
  "side to lateral mountain climber":"Escalador lateral alternado",
  "quickstep two feet on and off frontal and back":"Passos rápidos com os dois pés à frente e atrás",
  "quickstep two feet on and off front and back":"Passos rápidos com os dois pés à frente e atrás",
  "quickstep both feet on and off front and back":"Passos rápidos com os dois pés à frente e atrás",
  "quickstep lateral to lateral both feet together":"Deslocamento lateral rápido com os pés unidos",
  "quickstep side to side both feet together":"Deslocamento lateral rápido com os pés unidos",
  "hip bridge with leg extension":"Ponte de quadril com extensão de um joelho",
  "hip bridge with leg lift":"Ponte de quadril com elevação de uma perna",
  "supine spinal rotation":"Rotação da coluna em decúbito dorsal",
  "supine spine twist":"Rotação da coluna em decúbito dorsal",
  "downward dog to lateral plank":"Transição do cachorro olhando para baixo para prancha lateral",
  "downward facing dog to side plank":"Transição do cachorro olhando para baixo para prancha lateral",
  "blast off push up":"Flexão de braços com deslocamento posterior do quadril",
  "cross body jumping jack":"Polichinelo cruzado",
  "split stance sprinter arms":"Movimento alternado dos braços de corrida em posição de afundo",
  "split stance sprint arm swing":"Movimento alternado dos braços de corrida em posição de afundo",
  "alternating forward lunge with lateral arm raise":"Avanço à frente alternado com elevação lateral dos braços",
  "alternating reverse lunge with lateral arm raise":"Avanço para trás alternado com elevação lateral dos braços",
  "split squat with lateral arm raise":"Agachamento em base alternada com elevação lateral dos braços",
  "battle rope side plank waves":"Ondulações de corda naval na prancha lateral",
  "battle rope side plank circles":"Círculos com corda naval na prancha lateral",
  "single leg heel drop banded inward pull":"Descida do calcanhar unilateral com tração elástica para dentro",
  "single leg heel drop banded outward pull":"Descida do calcanhar unilateral com tração elástica para fora",
  "single leg romanian deadlift with dumbbells":"Levantamento terra romeno unilateral com halteres",
  "alternating single leg romanian deadlift":"Levantamento terra romeno unilateral alternado",
  "alternating single leg romanian deadlift with dumbbells":"Levantamento terra romeno unilateral alternado com halteres",
  "skier arm swings":"Balanço de braços do esquiador",
  "wind relieving pose single knee":"Postura de liberação dos ventos com um joelho ao peito",
  "wind relieving pose one knee":"Postura de liberação dos ventos com um joelho ao peito",
  "quick punches":"Sequência de socos rápidos",
  "alternating fast feet":"Passos rápidos alternados",
  "alternating fast footwork":"Passos rápidos alternados",
  "seated alternating arnold press":"Desenvolvimento Arnold sentado e alternado",
  "alternating seated arnold press":"Desenvolvimento Arnold sentado e alternado",
  "alternating arm dumbbell floor press":"Supino no solo alternado com halteres",
  "prone superman shoulder retraction":"Extensão de tronco em decúbito ventral com retração escapular",
  "arnold press on stability ball":"Desenvolvimento Arnold sentado na bola suíça",
  "seal jumping jack":"Polichinelo com abertura horizontal dos braços",
  "single leg swing hop":"Salto unilateral com balanço da perna",
  "alternating-arm dumbbell king kong":"Sequência King Kong com halteres e braços alternados",
  "alternado declinado halter empurrada":"Supino declinado alternado com halteres",
  "em decubito ventral swimmer":"Movimentos alternados dos braços em decúbito ventral",
  "halter bent over remada to biceps rosca":"Remada curvada seguida de rosca bíceps com halteres",
  "alternado halter ombro flexao on an inclinado banco":"Flexão alternada de ombros com halteres em banco inclinado",
  "one leg cotovelo prancha":"Prancha sobre antebraços com uma perna elevada",
  "em decubito dorsal spinal torcao":"Rotação da coluna em decúbito dorsal",
  "downward dog to lateral prancha":"Transição do cachorro olhando para baixo para prancha lateral",
  "quadril ponte with perna extensao":"Ponte de quadril com extensão de um joelho",
  "alternado upright remada faixa elastica":"Remada alta alternada com faixa elástica",
  "upright remada faixa elastica":"Remada alta com faixa elástica",
  "alternado inverse avanco with lateral elevacao":"Avanço para trás alternado com elevação lateral dos braços",
  "alternado forward avanco with lateral elevacao":"Avanço à frente alternado com elevação lateral dos braços",
  "forearm prancha cotovelo lateral caminhada":"Deslocamento lateral na prancha sobre antebraços",
  "alternado fast pes":"Passos rápidos alternados",
  "alternado single leg romanian deadlift":"Levantamento terra romeno unilateral alternado",
  "alternado sentado arnold empurrada":"Desenvolvimento Arnold sentado e alternado",
  "alterando sentado arnold empurrada":"Desenvolvimento Arnold sentado e alternado",
  "halter king kong":"Sequência King Kong com halteres",
  "alterando halter solo empurrada":"Supino no solo alternado com halteres",
  "alternado halter solo empurrada":"Supino no solo alternado com halteres",
  "halter pull complex":"Sequência de movimentos de puxada com halteres",
  "barra pull complex":"Sequência de movimentos de puxada com barra",
  "alterando halter king kong":"Sequência King Kong com halteres e braços alternados",
  "alternating arm halter king kong":"Sequência King Kong com halteres e braços alternados"
};
function normalizeExerciseName(name){
  return String(name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/&/g," and ").replace(/[-_/]+/g," ")
    .replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
}
const EXERCISE_PT_LOOKUP=new Map(Object.entries(EXERCISE_NAMES_PT)
  .map(([en,pt])=>[normalizeExerciseName(en),pt]));
function translateExerciseName(name){
  const original=String(name||"").trim();
  return EXERCISE_PT_LOOKUP.get(normalizeExerciseName(original))||original;
}
function isExerciseNameTranslated(name){
  return EXERCISE_PT_LOOKUP.has(normalizeExerciseName(name));
}
const EQUIPMENT_PT={
  bodyweight:"Peso corporal",mat:"Colchonete",chair:"Cadeira",
  "exercise-mat":"Colchonete","yoga-mat":"Colchonete",
  "resistance-band":"Faixa elástica","elastic-band":"Faixa elástica",
  dumbbell:"Halter",barbell:"Barra",bench:"Banco",cable:"Cabo",
  machine:"Máquina",kettlebell:"Kettlebell",none:"Sem equipamentos"
};
function exerciseRegions(ex){
  const primary=Array.isArray(ex.primaryMuscles)?ex.primaryMuscles:[];
  const secondary=Array.isArray(ex.secondaryMuscles)?ex.secondaryMuscles:[];
  const resolve=part=>MUSCLE_TO_REGION[String(part).toLowerCase().replace(/[-\s]/g,"_")];
  const regions=[...new Set(primary.map(resolve).filter(Boolean))];
  const secondaryRegions=[...new Set(secondary.map(resolve).filter(Boolean))];
  return regions.length?regions:secondaryRegions.length?secondaryRegions:["nao-classificados"];
}
function equipmentLabel(value){return EQUIPMENT_PT[String(value||"").toLowerCase()]||String(value);}
function regionText(ex){return exerciseRegions(ex).map(key=>BODY_REGION_LABELS[key]).join(", ");}
function renderSample(){
  if(!isProfessional()||!sampleList)return;
  const q=$("exercisebankQuery").value.trim().toLocaleLowerCase("pt-BR");
  const home=$("exercisebankHomeOnly").checked;
  const region=$("exercisebankRegion").value;
  const all=Array.isArray(sampleList.items)?sampleList.items:[];
  const filtered=all.filter(x=>{
    // Exibir somente exercícios com equivalência explícita em português no glossário.
    if(!isExerciseNameTranslated(x.name))return false;
    if(home&&x.home!==true)return false;
    if(region!=="todas"&&!exerciseRegions(x).includes(region))return false;
    if(!q)return true;
    return [x.name,translateExerciseName(x.name),x.description,
      ...(x.equipment||[]),...(x.primaryMuscles||[]),...(x.secondaryMuscles||[]),
      ...exerciseRegions(x).map(key=>BODY_REGION_LABELS[key])]
      .join(" ").toLocaleLowerCase("pt-BR").includes(q);
  });
  const root=$("exercisebankResults");root.replaceChildren();
  text("exercisebankStatus",filtered.length+" exercício(s)");
  if(!filtered.length)root.append(el("p","Nenhum exercício com nome em português encontrado para esses filtros.","card-text-small"));
  filtered.forEach(x=>{
    const card=el("div",undefined,"demo-exercicio-item bank-result");
    const translated=translateExerciseName(x.name);
    card.append(el("h2",translated,"card-title"));
    const row=el("div",undefined,"demo-acoes");
    const preview=el("button","Ver vídeo","btn btn-outline");
    const pick=el("button","Selecionar exercício","btn");
    const media=el("div",undefined,"bank-media");
    preview.type=pick.type="button";
    preview.addEventListener("click",()=>loadExerciseMedia(x.id,media,preview,"ExerciseBank",true));
    pick.addEventListener("click",()=>{
      addExercise({exercise_name:translated,exercise_source:"ExerciseBank",
        external_id:x.id,instructions:x.description||"",series:2,
        repetitions:"10",duration:"",frequency:"3 vezes por semana"});
      openExerciseConfiguration($("itensPlanoProf").lastElementChild);
    });
    row.append(preview,pick);card.append(row,media);root.append(card);
  });
}
async function loadExerciseMedia(id,target,button,source="ExerciseBank",autoPlay=false){
  if(button)button.disabled=true;
  target.replaceChildren(el("p","Carregando demonstração...","card-text-small"));
  try{
    let url,poster,credit;
    if(source==="wger"){
      const resp=await fetch("/api/wger?id="+encodeURIComponent(id),{cache:"no-store"});
      const data=await resp.json();if(!resp.ok)throw Error(data.error||"Vídeo indisponível.");
      url=data.item?.videos?.[0]?.url;credit="Fonte: wger";
    }else if(source==="ExerciseBank"){
      const data=await ebCall({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids:[id]})});
      const item=data.data?.[id];
      if(!item?.signed)throw Error("Este vídeo não está disponível no catálogo de demonstração.");
      url=item.mp4;poster=item.still;credit="ExerciseBank · link temporário";
    }
    if(!url)throw Error("Vídeo indisponível.");
    if(!target.isConnected)return;
    const video=el("video");
    video.controls=true;
    video.playsInline=true;
    video.preload=autoPlay?"auto":"metadata";
    video.loop=autoPlay;
    video.muted=autoPlay;
    video.autoplay=autoPlay;
    video.src=url;
    if(poster)video.poster=poster;
    target.replaceChildren(video);
    if(autoPlay){
      video.setAttribute("aria-label","Demonstração do exercício em reprodução contínua e sem áudio");
      video.play().catch(()=>{
        if(video.isConnected)target.append(el("p","Toque no vídeo para iniciar a demonstração.","card-text-small"));
      });
    }else{
      target.append(el("p",credit,"card-text-small"));
    }
  }catch(e){if(target.isConnected)target.replaceChildren(el("p",e.message,"card-text-small"));}
  finally{if(button)button.disabled=false;}
}

async function init(){
  $("parquesDialog").addEventListener("close",()=>{
    if(!$("parquesDialog").open)closeOutdoorGuide();
  });
  menu();navigate("login");
  $("exerciseConfigDialog").addEventListener("cancel",event=>{
    event.preventDefault();
    backFromExerciseConfiguration();
  });
  $("exercisebankRefresh")?.addEventListener("click",()=>loadSample());
  $("periodoAcompanhamento").addEventListener("change",()=>{
    const root=$("graficosRegistrosProf");
    const open=[...root.querySelectorAll(":scope > details")].map(topic=>topic.open);
    const plan=$("monitoramentoPlano")?.value;
    renderProfessionalRecords();
    root.querySelectorAll(":scope > details").forEach((topic,index)=>{topic.open=!!open[index];});
    if(plan){
      const select=$("monitoramentoPlano");
      select.value=plan;
      select.dispatchEvent(new Event("change"));
    }
  });
  try{
    const response=await fetch("/api/database-config",{cache:"no-store"});
    const config=await response.json();
    if(!response.ok||!config.configured)throw Error("Conexão indisponível");
    const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    supabase=createClient(config.url,config.publishableKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
    });
    loginReady=true;
    $("loginSubmit").disabled=false;
    message("Entre com uma conta de teste cadastrada.");
    const session=await supabase.auth.getSession();
    if(session.error)throw session.error;
    if(session.data.session)await openSession();
    supabase.auth.onAuthStateChange((event)=>{
      if(event==="SIGNED_OUT"&&isAuthenticated())reset();
    });
  }catch(err){
    loginReady=false;
    $("loginSubmit").disabled=true;
    message("Não foi possível conectar ao serviço. Tente novamente mais tarde.",true);
  }
}

window.AppAuth={login,logout,navigate,saveSymptoms,isProfessional,renderWorkoutDay};
window.atualizarPacienteProfissional=()=>selectPatient($("pacienteProf").value);
window.trocarPacientePlanoProf=()=>selectPatient($("pacientePlanoProf").value);
window.trocarPacienteRegistrosProf=()=>selectPatient($("pacienteRegistrosProf").value);
window.adicionarExercicioPlano=()=>addExercise();
window.limparFormularioPlano=clearPlanForm;
window.cancelarFormularioPlano=cancelPlanEditor;
window.criarPlanoProfissional=createPlanFromScratch;
window.abrirOpcoesExercicios=openExerciseSourceOptions;
window.voltarDaEscolhaExercicios=backFromExerciseSource;
window.concluirInsercaoExercicio=finishExerciseInsertion;
window.voltarDaConfiguracaoExercicio=backFromExerciseConfiguration;
window.adicionarExercicioManual=addManualExerciseFromOptions;
window.abrirBibliotecaExerciseBank=openExerciseBankFromOptions;
window.salvarPlanoProf=savePlan;
window.avancarPlano=avancarPlano;
window.mostrarEtapaPlano=etapa=>{
  mostrarEtapaPlano(etapa);
  $("nomePlanoProf").focus();
};
document.addEventListener("DOMContentLoaded",init);
