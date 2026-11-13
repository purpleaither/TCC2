"use strict";

const $ = id => document.getElementById(id);
const levels = ["Nenhuma", "Leve", "Moderada", "Intensa"];
const exercises = [
  {id:"e1",name:"Ponte de glúteos",area:"Musculoesquelética",info:"Elevação controlada da pelve conforme prescrição."},
  {id:"e2",name:"Mobilidade de tornozelo",area:"Musculoesquelética",info:"Flexão dorsal e plantar dentro dos limites orientados."},
  {id:"e3",name:"Extensão ativa de joelho",area:"Musculoesquelética",info:"Extensão de joelho em posição sentada."},
  {id:"e4",name:"Abdução de quadril em pé",area:"Musculoesquelética",info:"Movimento lateral do quadril com apoio estável."},
  {id:"e5",name:"Sentar e levantar",area:"Funcional",info:"Movimento em cadeira estável conforme orientação."},
  {id:"e6",name:"Respiração diafragmática",area:"Respiratória",info:"Respiração em posição confortável conforme orientação profissional."},
  {id:"e7",name:"Expiração com lábios semicerrados",area:"Respiratória",info:"Expiração controlada sem esforço excessivo, quando indicada."}
];

let supabase = null;
let user = null;
let profile = null;
let patients = [];
let patientId = null;
let plans = [];
let records = [];
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
  text("loginStatus",value);
  const flash = $("authFlash");
  if(flash) {
    flash.hidden = !isAuthenticated();
    flash.textContent = value;
    flash.style.background = isError ? "#fff0f0" : "#e8f5e9";
    flash.style.color = isError ? "#b3261e" : "#003366";
  }
}
function menu() {
  document.querySelectorAll("[data-perfil]").forEach(item=>{
    item.style.display = isAuthenticated() && item.dataset.perfil === profile.role ? "" : "none";
  });
  text("headerPerfilBtn",isProfessional() ? "Profissional" : "Perfil");
}
function navigate(page) {
  if(!isAuthenticated()) page="login";
  else {
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
  message("Verificando o acesso...");
  try {
    result(await supabase.auth.signInWithPassword({email,password}));
    $("loginSenha").value="";
    await openSession();
  } catch(err) {
    message("Não foi possível entrar. Verifique as credenciais e o cadastro do perfil.",true);
  } finally {
    busy=false;
    $("loginSubmit").disabled=!loginReady;
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
  user=null;
  profile=null;
  patients=[];
  patientId=null;
  plans=[];
  records=[];
  editingPlan=null;
  currentPatientExercise=0;
  workoutCompletedInView=false;
  treinosConcluidos=[];
  registrosUsuario=[];
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
    navigate("inicio");
  }
  message("Acesso autenticado. Utilize somente dados fictícios.");
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
  editingPlan=null;
  clearPlanForm();
  updatePatientSelectors();
  await loadPatientData();
}
async function obterClimaBrasilia() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7500);
  try {
    const endpoint = "https://api.open-meteo.com/v1/forecast?latitude=-15.7801&longitude=-47.9292&current=temperature_2m,relative_humidity_2m,surface_pressure&timezone=America%2FSao_Paulo";
    const response = await fetch(endpoint,{signal:controller.signal,cache:"no-store"});
    if (!response.ok) throw Error("Serviço meteorológico indisponível");
    const payload = await response.json();
    const current = payload.current;
    if (!current || ![current.temperature_2m,current.relative_humidity_2m,current.surface_pressure].every(Number.isFinite)) {
      throw Error("Medições meteorológicas inválidas");
    }
    return {
      weather_city:"Brasília",
      weather_temperature:current.temperature_2m,
      weather_humidity:Math.round(current.relative_humidity_2m),
      weather_pressure:current.surface_pressure,
      weather_observed_at:current.time ? new Date(current.time + (payload.utc_offset_seconds===-10800?"-03:00":"Z")).toISOString() : new Date().toISOString()
    };
  } finally {
    clearTimeout(timeout);
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
  plans=[];
  records=[];
  if(!patientId){
    renderProfessionalPlans();
    renderProfessionalRecords();
    return;
  }
  try {
    plans=result(await supabase.from("care_plans")
      .select("id,title,notes,created_at,updated_at,plan_exercises(id,exercise_name,exercise_source,external_id,series,repetitions,duration,frequency,instructions,position)")
      .eq("patient_id",patientId).order("created_at",{ascending:false}))||[];
    const baseFields="id,recorded_at,pain_rest,pain_movement,stiffness,fatigue";
    const weatherFields=",weather_city,weather_temperature,weather_humidity,weather_pressure,weather_observed_at";
    let symptomsResponse=await supabase.from("symptom_records")
      .select(baseFields+(weatherColumnsAvailable?weatherFields:""))
      .eq("patient_id",patientId).order("recorded_at",{ascending:false}).limit(500);
    if (symptomsResponse.error && weatherColumnsAvailable && isMissingWeatherColumns(symptomsResponse.error)) {
      weatherColumnsAvailable=false;
      symptomsResponse=await supabase.from("symptom_records").select(baseFields)
        .eq("patient_id",patientId).order("recorded_at",{ascending:false}).limit(500);
    }
    records=result(symptomsResponse)||[];
    if(!isProfessional()){
      const workoutResponse=await supabase.from("workout_sessions")
        .select("id,patient_id,completed_at,exercises")
        .eq("patient_id",user.id).order("completed_at",{ascending:false}).limit(500);
      treinosConcluidos=workoutResponse.error?[]:(workoutResponse.data||[]);
    }
    if(isProfessional()){
      renderProfessionalPlans();
      renderProfessionalRecords();
    } else {
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
    message("Não foi possível consultar os dados do paciente. Verifique a conexão e as permissões.",true);
  }
}
const patientTpeAdvice=[
  {title:"Compreendendo a dor",body:"A dor envolve aspectos físicos, emocionais e do ambiente. Entender esses fatores pode ajudar no autocuidado e na confiança para se movimentar."},
  {title:"Clima e sintomas",body:"Algumas pessoas percebem mudanças no conforto e na rigidez quando o clima varia. Observe como você se sente e respeite as orientações da sua equipe."},
  {title:"Autonomia no dia a dia",body:"Pequenas adaptações nas atividades de casa e do trabalho podem ajudar a manter o movimento e favorecer o autocuidado."}
];
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
        "Séries: "+(item.series||"–"),"Repetições: "+(item.repetitions||"–"),
        "Duração: "+(item.duration||"–"),"Frequência: "+(item.frequency||"–")
      ].join(" · "),"card-text-small"));
      card.append(row);
    }
    root.append(card);
  }
}
function renderPatientPlans(){
  if(!isAuthenticated()||isProfessional())return;
  const root=$("exNormalContainer");
  if(!root)return;
  root.replaceChildren();
  text("homeRoutineValue",plans.length?plans.length+" plano(s) atribuído(s)":"Aguardando atribuição");
  text("homeRoutineLabel","Plano fisioterapêutico");
  text("homeRoutineDesc",plans.length?"Acompanhe um exercício por vez, conforme a prescrição do fisioterapeuta.":"Nenhum plano foi atribuído a esta conta.");
  const assigned=patientExerciseAssignments();
  if(!assigned.length){
    root.append(el("h3","Nenhum exercício atribuído","card-title"),
      el("p","Os exercícios aparecerão aqui após a prescrição profissional.","card-text"));
    return;
  }
  currentPatientExercise=Math.max(0,Math.min(currentPatientExercise,assigned.length-1));
  const {plan,exercise}=assigned[currentPatientExercise];
  const card=el("div",undefined,"patient-exercise-card");
  card.append(el("p",plan.title,"patient-plan-title"));
  const progress=el("p","Exercício "+(currentPatientExercise+1)+" de "+assigned.length,"patient-exercise-progress");
  progress.setAttribute("role","status");
  progress.setAttribute("aria-live","polite");
  card.append(progress);
  const name=exercise.exercise_source==="ExerciseBank"
    ?translateExerciseName(exercise.exercise_name)
    :exercise.exercise_name;
  card.append(el("h2",name,"patient-exercise-title"));

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
  const advice=patientTpeAdvice[currentPatientExercise%patientTpeAdvice.length];
  const adviceBox=el("aside",undefined,"patient-tpe-advice");
  adviceBox.setAttribute("aria-label","Conselho de educação terapêutica");
  adviceBox.append(
    el("span","Conselho","patient-tpe-label"),
    el("h3",advice.title,"patient-tpe-heading"),
    el("p",advice.body,"patient-tpe-text")
  );
  const moreAdvice=el("button","Saiba mais em Aprender a cuidar","patient-tpe-link");
  moreAdvice.type="button";
  moreAdvice.addEventListener("click",()=>navigate("orientacoes"));
  adviceBox.append(moreAdvice);
  card.append(adviceBox);
  // Instruções clínicas individuais continuam disponíveis; descrições automáticas
  // em inglês do banco de vídeos não são apresentadas como orientação ao paciente.
  if(exercise.instructions && exercise.exercise_source!=="ExerciseBank")
    card.append(el("p",exercise.instructions,"patient-exercise-instructions"));

  const actions=el("div",undefined,"demo-acoes");
  const previous=el("button","Anterior","btn btn-outline");
  previous.type="button";
  previous.disabled=currentPatientExercise===0;
  previous.addEventListener("click",()=>{
    if(currentPatientExercise>0){currentPatientExercise--;renderPatientPlans();}
  });
  const next=el("button","Próximo","btn");
  next.type="button";
  next.disabled=currentPatientExercise===assigned.length-1;
  next.addEventListener("click",()=>{
    if(currentPatientExercise<assigned.length-1){currentPatientExercise++;renderPatientPlans();}
  });
  actions.append(previous,next);
  card.append(actions);
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
  const mainActions=$("planMainActions");
  if(mainActions)mainActions.hidden=!!plans.length;
  const createEntry=$("createPlanEntry");
  if(createEntry)createEntry.disabled=!patientId;
  for(const p of plans){
    const card=el("div",undefined,"card");
    card.append(el("h3",p.title,"card-title"));
    if(p.notes)card.append(el("p",p.notes,"card-text"));
    for(const x of [...(p.plan_exercises||[])].sort((a,b)=>a.position-b.position)){
      const line=el("div",undefined,"demo-detalhe");
      line.append(el("strong",x.exercise_name,"plan-exercise-name"));
      line.append(el("p",(x.series||"–")+" série(s) · "+(x.repetitions||"–")+" repetições · "+(x.duration||"–")+" duração · "+x.frequency,"plan-exercise-prescription"));
      if(["ExerciseBank","wger"].includes(x.exercise_source) && x.external_id){
        const view=el("button","Ver demonstração","btn btn-outline");
        view.type="button";
        const media=el("div",undefined,"bank-media");
        view.addEventListener("click",()=>loadExerciseMedia(x.external_id,media,view,x.exercise_source,true));
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
    const moreActions=el("div",undefined,"plan-card-add-actions");
    const create=el("button","Criar plano terapêutico","btn");
    create.type="button";
    create.addEventListener("click",createPlanFromScratch);
    const add=el("button","Adicionar exercícios","btn btn-outline");
    add.type="button";
    add.addEventListener("click",()=>addExercisesToExistingPlan(p.id));
    moreActions.append(create,add);
    card.append(moreActions);
    root.append(card);
  }
}
function renderProfessionalRecords(){
  if(!isProfessional())return;
  updatePatientSelectors();
  const root=$("listaRegistrosProf");
  root.replaceChildren();
  if(!records.length)root.append(el("p","Nenhum registro disponível.","demo-vazio"));
  for(const r of records) {
    const card=el("div",undefined,"card");
    card.append(el("h3",date(r.recorded_at),"card-title"));
    card.append(el("p","Dor em repouso: "+r.pain_rest+"/10 · Dor ao movimento: "+r.pain_movement+"/10","card-text"));
    card.append(el("p","Rigidez: "+r.stiffness+" · Fadiga: "+r.fatigue,"card-text-small"));
    const clima=mapWeather(r);
    if(clima)card.append(el("p","Clima registrado em "+date(clima.observadoEm)+": "+clima.temperatura+" °C · "+clima.umidade+"% · "+clima.pressao+" hPa ("+clima.cidade+")","card-text-small"));
    root.append(card);
  }
}
function addExercise(entry){
  if(!isProfessional())return;
  const row=el("div",undefined,"demo-exercicio-item");
  const label=el("label","Exercício","form-label");
  const select=el("select",undefined,"form-input");
  select.name="exercise";
  for(const x of exercises){
    const option=el("option",x.name+" · "+x.area);
    option.value=x.id;
    select.append(option);
  }
  const custom=el("option","Outro exercício (digitar nome)");
  custom.value="other";
  select.append(custom);
  label.append(select);
  row.append(label);
  const externalId=el("input");
  externalId.name="externalId";
  externalId.type="hidden";
  const externalInstructions=el("input");
  externalInstructions.name="externalInstructions";
  externalInstructions.type="hidden";
  const externalName=el("input");
  externalName.name="externalName";
  externalName.type="hidden";
  const externalSource=el("input");externalSource.name="externalSource";externalSource.type="hidden";
  row.append(externalId,externalInstructions,externalName,externalSource);
  const customName=el("input",undefined,"form-input");
  customName.name="customName";
  customName.placeholder="Nome do exercício";
  customName.maxLength=160;
  customName.hidden=true;
  row.append(customName);
  select.addEventListener("change",()=>{
    customName.hidden=select.value!=="other";
    customName.required=select.value==="other";
    externalId.value="";
    externalInstructions.value="";
    externalName.value="";externalSource.value="";
  });
  const params=el("div",undefined,"demo-grid-parametros");
  for(const [key,title,type,value] of [
    ["series","Séries","number",2],
    ["repetitions","Repetições","text","10"],
    ["duration","Duração","text",""],
    ["frequency","Frequência","text","3 vezes por semana"]
  ]){
    const wrap=el("div",undefined,"form-group");
    const lbl=el("label",title,"form-label");
    const input=el("input",undefined,"form-input");
    input.name=key;input.type=type;input.value=value;
    if(type==="number"){input.min="1";input.max="20";}
    else input.maxLength=80;
    lbl.append(input);wrap.append(lbl);params.append(wrap);
  }
  row.append(params);
  const remove=el("button","Remover exercício","btn btn-outline");
  remove.type="button";
  remove.addEventListener("click",()=>{row.remove();updatePlanEditorSummary();});
  row.append(remove);
  $("itensPlanoProf").append(row);
  updatePlanEditorSummary();
  if(entry){
    const existing=["ExerciseBank","wger"].includes(entry.exercise_source)?null:exercises.find(x=>x.name===entry.exercise_name);
    select.value=existing?existing.id:"other";
    customName.value=entry.exercise_name;
    customName.hidden=!!existing;
    customName.required=!existing;
    if(["ExerciseBank","wger"].includes(entry.exercise_source)&&entry.external_id){
      externalId.value=entry.external_id;
      externalInstructions.value=entry.instructions||"";
      externalName.value=entry.exercise_name;externalSource.value=entry.exercise_source;
      const sourceLabel=el("p",entry.exercise_source==="ExerciseBank"?"ExerciseBank · amostra Sandbox":"wger · vídeo sujeito à disponibilidade e licença","card-text-small");
      row.prepend(sourceLabel);
    }
    for(const k of ["series","repetitions","duration","frequency"])
      row.querySelector('[name="'+k+'"]').value=entry[k]??"";
  }
}
let exerciseReturnPage="planos-prof";
let pendingExerciseRow=null;
let pendingExerciseOrigin="exercise-source-prof";
let pendingExercisePlaceholder=null;
function exerciseNameFromRow(row){
  const selected=row.querySelector('[name="exercise"]');
  const custom=row.querySelector('[name="customName"]');
  return (
    selected?.value==="other" ? custom?.value.trim() : exercises.find(x=>x.id===selected?.value)?.name
  )||"Exercício sem nome";
}
function updatePlanEditorSummary(){
  const stored=$("itensPlanoProf");
  const rows=Array.from(stored?.children||[]).filter(row=>row.classList.contains("demo-exercicio-item"));
  text("resumoEtapaPlano",rows.length+
    (rows.length===1?" exercício adicionado ao plano.":" exercícios adicionados ao plano."));
  const list=$("resumoExerciciosPlano");
  if(!list)return;
  list.replaceChildren();
  if(!rows.length){
    list.append(el("p","Adicione exercícios para montar a ficha.","card-text-small"));
    return;
  }
  rows.forEach((row,index)=>{
    const item=el("div",undefined,"exercise-summary-item");
    const heading=el("strong",(index+1)+". "+exerciseNameFromRow(row),"exercise-summary-name");
    const detail=el("p",[
      "Séries: "+(row.querySelector('[name="series"]')?.value||"–"),
      "Repetições: "+(row.querySelector('[name="repetitions"]')?.value||"–"),
      "Duração: "+(row.querySelector('[name="duration"]')?.value||"–"),
      "Frequência: "+(row.querySelector('[name="frequency"]')?.value||"–")
    ].join(" · "),"card-text-small");
    const actions=el("div",undefined,"demo-acoes");
    const edit=el("button","Editar exercício","btn btn-outline");
    edit.type="button";
    edit.addEventListener("click",()=>openExerciseConfiguration(row,"editor-prof",true));
    const remove=el("button","Remover","btn btn-outline");
    remove.type="button";
    remove.addEventListener("click",()=>{row.remove();updatePlanEditorSummary();});
    actions.append(edit,remove);
    item.append(heading,detail,actions);
    list.append(item);
  });
}
function choosePlanForExerciseAddition(){
  if(!isProfessional()||!patientId)return;
  if(!plans.length){
    message("Crie um plano terapêutico antes de adicionar exercícios.",true);
    return;
  }
  if(plans.length===1){
    addExercisesToExistingPlan(plans[0].id);
    return;
  }
  const root=$("exerciseTargetPlans");
  root.replaceChildren();
  for(const plan of plans){
    const card=el("div",undefined,"card");
    card.append(el("h3",plan.title,"card-title"));
    const count=Array.isArray(plan.plan_exercises)?plan.plan_exercises.length:0;
    card.append(el("p",count+" exercício(s) no plano.","card-text-small"));
    const button=el("button","Adicionar exercícios a este plano","btn");
    button.type="button";
    button.addEventListener("click",()=>addExercisesToExistingPlan(plan.id));
    card.append(button);
    root.append(card);
  }
  navigate("exercise-target-prof");
}
function addExercisesToExistingPlan(planId){
  if(!isProfessional())return;
  const plan=plans.find(x=>x.id===planId);
  if(!plan)return;
  editPlan(planId);
  openExerciseSourceOptions();
}
function openExerciseSourceOptions(){
  if(!isProfessional())return;
  exerciseReturnPage=$("page-editor-prof").classList.contains("active")?"editor-prof":"planos-prof";
  navigate("exercise-source-prof");
}
function backFromExerciseSource(){
  navigate(exerciseReturnPage);
}
function addManualExerciseFromOptions(){
  if(!isProfessional())return;
  addExercise();
  const row=$("itensPlanoProf").lastElementChild;
  const select=row.querySelector('[name="exercise"]');
  select.value="other";
  select.dispatchEvent(new Event("change"));
  openExerciseConfiguration(row,"exercise-source-prof",false);
}
function openExerciseBankFromOptions(){
  if(!isProfessional())return;
  navigate("exercise-bank-prof");
}
function openExerciseConfiguration(row,origin,existing=false){
  if(!isProfessional()||!row)return;
  if(pendingExerciseRow)return;
  pendingExerciseRow=row;
  pendingExerciseOrigin=origin;
  pendingExercisePlaceholder=existing?document.createElement("span"):null;
  if(existing)row.before(pendingExercisePlaceholder);
  $("exerciseConfigRow").append(row);
  const remove=row.querySelector("button.btn-outline");
  if(remove)remove.hidden=true;
  navigate("exercise-config-prof");
}
function finishExerciseInsertion(){
  if(!pendingExerciseRow)return;
  const row=pendingExerciseRow;
  const select=row.querySelector('[name="exercise"]');
  const custom=row.querySelector('[name="customName"]');
  const series=Number(row.querySelector('[name="series"]')?.value);
  const repeats=row.querySelector('[name="repetitions"]')?.value.trim()||"";
  const duration=row.querySelector('[name="duration"]')?.value.trim()||"";
  const frequency=row.querySelector('[name="frequency"]')?.value.trim()||"";
  const name=select?.value==="other"?custom?.value.trim():exerciseNameFromRow(row);
  if(!name||name.length<2||!Number.isInteger(series)||series<1||series>20||(!repeats&&!duration)||!frequency){
    message("Informe o exercício, as séries, as repetições ou duração e a frequência.",true);
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
  updatePlanEditorSummary();
  navigate("editor-prof");
  message("Exercício inserido. Revise a quantidade e salve o plano quando terminar.");
}
function backFromExerciseConfiguration(){
  if(!pendingExerciseRow)return navigate("exercise-source-prof");
  const remove=pendingExerciseRow.querySelector("button.btn-outline");
  if(remove)remove.hidden=false;
  if(pendingExercisePlaceholder)pendingExercisePlaceholder.replaceWith(pendingExerciseRow);
  else pendingExerciseRow.remove();
  pendingExerciseRow=null;
  pendingExercisePlaceholder=null;
  updatePlanEditorSummary();
  navigate(pendingExerciseOrigin);
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
  text("tituloFormularioPlano","Criar plano terapêutico");
}
function editPlan(id){
  const plan=plans.find(p=>p.id===id);
  if(!plan||!isProfessional())return;
  clearPlanForm();
  editingPlan=id;
  $("nomePlanoProf").value=plan.title;
  $("orientacoesPlanoProf").value=plan.notes||"";
  for(const x of [...(plan.plan_exercises||[])].sort((a,b)=>a.position-b.position))addExercise(x);
  text("tituloFormularioPlano","Editar plano terapêutico");
  navigate("editor-prof");
}
function readExercises(){
  return Array.from($("itensPlanoProf").children).map((row,i)=>{
    const v=key=>row.querySelector('[name="'+key+'"]').value.trim();
    const selected=exercises.find(x=>x.id===v("exercise"));
    const bankId=v("externalId");
    const name=selected?selected.name:v("customName");
    return {
      exercise_name:name,
      exercise_source:bankId?(row.querySelector("[name=externalSource]")?.value||"ExerciseBank"):"manual",
      external_id:bankId||null,
      series:Number(v("series")),
      repetitions:v("repetitions"),
      duration:v("duration"),
      frequency:v("frequency"),
      instructions:bankId?v("externalInstructions"):(selected?selected.info:""),
      position:i
    };
  });
}
async function savePlan(event){
  if(event)event.preventDefault();
  if(!isProfessional()||!patientId||busy)return;
  const title=$("nomePlanoProf").value.trim();
  const items=readExercises();
  if(title.length<2||!items.length)return message("Informe um nome e pelo menos um exercício.",true);
  if(items.some(x=>x.exercise_name.length<2||!Number.isInteger(x.series)||x.series<1||x.series>20||(!x.repetitions&&!x.duration)||!x.frequency))
    return message("Verifique o exercício, as séries, as repetições ou duração e a frequência.",true);
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
    if(clima && weatherColumnsAvailable)Object.assign(registro,clima);
    let saved=await supabase.from("symptom_records").insert(registro);
    if(saved.error && clima && isMissingWeatherColumns(saved.error)) {
      weatherColumnsAvailable=false;
      saved=await supabase.from("symptom_records").insert({
        patient_id:user.id,pain_rest:painRest,pain_movement:painMove,
        stiffness:levels[rigidezAtual]||"Leve",
        fatigue:levels[fadigaAtual]||"Leve"
      });
    }
    result(saved);
    await loadPatientData();
    navigate("inicio");
    message(clima&&weatherColumnsAvailable
      ? "Sintomas e condições meteorológicas registrados. O plano permanece inalterado."
      : "Sintomas registrados. Clima indisponível ou atualização do banco pendente; nenhuma medição foi associada a este registro.", !(clima&&weatherColumnsAvailable));
    if(atipico===1||Math.max(painRest,painMove)>=8)
      alert("Se os sintomas forem intensos ou inesperados, procure orientação profissional. Este aplicativo não realiza triagem clínica.");
  }catch(err){message("Não foi possível salvar os sintomas. Confira a conexão.",true);}
  finally{busy=false;}
}


let sampleList=null,loadingSample=false;
async function ebCall(opts={}){
  if(!supabase||!isAuthenticated())throw Error("Faça login para consultar a biblioteca.");
  const session=await supabase.auth.getSession();
  const token=session.data?.session?.access_token;
  if(!token)throw Error("Sessão expirada. Faça login novamente.");
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
    card.append(el("h4",translated,"card-title"));
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
      openExerciseConfiguration($("itensPlanoProf").lastElementChild,"exercise-bank-prof",false);
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
      if(!item?.signed)throw Error("Vídeo não liberado no Sandbox.");
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
  menu();navigate("login");
  $("exercisebankRefresh")?.addEventListener("click",()=>loadSample());
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
    message("Não foi possível conectar ao Supabase. Confira a configuração da Vercel.",true);
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
window.escolherPlanoParaExercicios=choosePlanForExerciseAddition;
window.voltarDaEscolhaExercicios=backFromExerciseSource;
window.concluirInsercaoExercicio=finishExerciseInsertion;
window.voltarDaConfiguracaoExercicio=backFromExerciseConfiguration;
window.adicionarExercicioManual=addManualExerciseFromOptions;
window.abrirBibliotecaExerciseBank=openExerciseBankFromOptions;
window.salvarPlanoProf=savePlan;
document.addEventListener("DOMContentLoaded",init);
