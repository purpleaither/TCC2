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
      ? ["profissional","planos-prof","registros-prof"]
      : ["inicio","sintomas","historico","orientacoes","exercicios","contatos"];
    if(!allowed.includes(page)) page=homePage();
  }
  document.querySelectorAll(".page").forEach(n=>n.classList.toggle("active",n.id==="page-"+page));
  mostrarCabecalho(page!=="login");
  document.querySelectorAll(".menu-item").forEach(item=>{
    const selected=item.getAttribute("onclick")==="navegarPara('"+page+"')";
    item.classList.toggle("active",selected);
    if(selected)item.setAttribute("aria-current","page");
    else item.removeAttribute("aria-current");
  });
  fecharMenu();
  fecharClimaSheet();
  if(page==="planos-prof"){renderProfessionalPlans();loadSample();}
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
function renderPatientPlans(){
  if(!isAuthenticated() || isProfessional())return;
  const root=$("exNormalContainer");
  if(!root)return;
  root.replaceChildren();
  text("homeRoutineValue",plans.length?plans.length+" plano(s) atribuído(s)":"Aguardando atribuição");
  text("homeRoutineLabel","Plano fisioterapêutico");
  text("homeRoutineDesc",plans.length?"Visualize os exercícios individualizados disponibilizados pelo fisioterapeuta.":"Nenhum plano foi atribuído a esta conta.");
  if(!plans.length) {
    root.append(el("h3","Nenhum plano atribuído","card-title"),el("p","Os exercícios aparecerão aqui após a prescrição profissional.","card-text"));
    return;
  }
  for(const p of plans){
    const card=el("div",undefined,"demo-detalhe");
    card.append(el("h3",p.title,"card-title"));
    if(p.notes)card.append(el("p",p.notes,"card-text"));
    const ordered=el("ol");
    for(const x of [...(p.plan_exercises||[])].sort((a,b)=>a.position-b.position)){
      const item=el("li");
      item.append(el("strong",x.exercise_name));
      item.append(el("p",[
        "Séries: "+(x.series||"–"),
        "Repetições: "+(x.repetitions||"–"),
        "Duração: "+(x.duration||"–"),
        "Frequência: "+x.frequency
      ].join(" · "),"card-text-small"));
      if(x.instructions)item.append(el("p",x.instructions,"card-text-small"));
      if(["ExerciseBank","wger"].includes(x.exercise_source) && x.external_id){
        const view=el("button","Ver demonstração em vídeo","btn btn-outline");
        view.type="button";
        const media=el("div",undefined,"bank-media");
        view.addEventListener("click",()=>loadExerciseMedia(x.external_id,media,view,x.exercise_source));
        item.append(view,media);
      }
      ordered.append(item);
    }
    card.append(ordered);
    root.append(card);
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
  for(const p of plans){
    const card=el("div",undefined,"card");
    card.append(el("h3",p.title,"card-title"));
    if(p.notes)card.append(el("p",p.notes,"card-text"));
    for(const x of [...(p.plan_exercises||[])].sort((a,b)=>a.position-b.position)){
      const line=el("div",undefined,"demo-detalhe");
      line.append(el("p",x.exercise_name+" · "+(x.series||"–")+" série(s) · "+(x.repetitions||"–")+" repetições · "+(x.duration||"–")+" duração · "+x.frequency));
      if(["ExerciseBank","wger"].includes(x.exercise_source) && x.external_id){
        const view=el("button","Ver demonstração","btn btn-outline");
        view.type="button";
        const media=el("div",undefined,"bank-media");
        view.addEventListener("click",()=>loadExerciseMedia(x.external_id,media,view,x.exercise_source));
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
  remove.addEventListener("click",()=>row.remove());
  row.append(remove);
  $("itensPlanoProf").append(row);
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
function clearPlanForm(){
  editingPlan=null;
  $("formPlanoProf").reset();
  $("itensPlanoProf").replaceChildren();
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
  $("formPlanoProf").scrollIntoView({behavior:"smooth"});
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
  text("exercisebankStatus","Carregando os vídeos liberados no Sandbox...");
  try{
    sampleList=await ebCall();
    renderSample();
  }catch(e){
    sampleList=null;$("exercisebankResults").replaceChildren();
    text("exercisebankStatus",e.message);
  }finally{loadingSample=false;$("exercisebankRefresh").disabled=false;}
}
function renderSample(){
  if(!isProfessional()||!sampleList)return;
  const q=$("exercisebankQuery").value.trim().toLowerCase(),home=$("exercisebankHomeOnly").checked;
  const all=Array.isArray(sampleList.items)?sampleList.items:[];
  const filtered=all.filter(x=>(!home||x.home===true)&&(!q||[x.name,x.description,...x.equipment,...x.primaryMuscles].join(" ").toLowerCase().includes(q)));
  const root=$("exercisebankResults");root.replaceChildren();
  text("exercisebankStatus",filtered.length+" exibidos de "+all.length+" exercícios com vídeo liberado; "+sampleList.sampleCount+" IDs na amostra."+(home?" Filtro domiciliar ativo.":""));
  if(!filtered.length)root.append(el("p","Nenhum exercício encontrado com os filtros atuais.","card-text-small"));
  filtered.forEach(x=>{
    const card=el("div",undefined,"demo-exercicio-item bank-result");
    card.append(el("h4",x.name,"card-title"));
    if(x.description)card.append(el("p",x.description,"card-text-small"));
    card.append(el("p","Equipamentos: "+(x.equipment.length?x.equipment.join(", "):"Nenhum"),"card-text-small"));
    const row=el("div",undefined,"demo-acoes"),preview=el("button","Ver vídeo","btn btn-outline"),pick=el("button","Selecionar exercício","btn"),media=el("div",undefined,"bank-media");
    preview.type=pick.type="button";
    preview.addEventListener("click",()=>loadExerciseMedia(x.id,media,preview,"ExerciseBank"));
    pick.addEventListener("click",()=>{
      addExercise({exercise_name:x.name,exercise_source:"ExerciseBank",external_id:x.id,instructions:x.description||"",series:2,repetitions:"10",duration:"",frequency:"3 vezes por semana"});
      message("Exercício adicionado. Configure os parâmetros e salve o plano.");
      $("itensPlanoProf").lastElementChild?.scrollIntoView({behavior:"smooth",block:"nearest"});
    });
    row.append(preview,pick);card.append(row,media);root.append(card);
  });
}
let sandboxAudit=null;
let auditRunning=false;
async function auditSandboxVideos(){
  if(!isProfessional()||auditRunning)return;
  auditRunning=true;
  const button=$("exercisebankAudit");
  button.disabled=true;
  $("exercisebankExport").hidden=true;
  text("exercisebankAuditStatus","Verificando a disponibilidade dos vídeos da amostra Sandbox...");
  try{
    const result=await ebCall({
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"audit"})
    });
    sandboxAudit=result;
    const rows=Array.isArray(result.rows)?result.rows:[];
    const totals=result.totals||{};
    const table=el("table",undefined);
    table.style.width="100%";
    const header=el("thead");
    const headRow=el("tr");
    for(const name of ["Exercício","Equipamentos","Vídeo","Domiciliar"]){
      headRow.append(el("th",name));
    }
    header.append(headRow);
    const body=el("tbody");
    for(const item of rows){
      const tr=el("tr");
      const status=item.videoStatus==="liberado"?"Liberado":item.videoStatus==="bloqueado"?"Bloqueado":"Sem link";
      for(const value of [
        item.name+" ("+item.id+")",
        Array.isArray(item.equipment)&&item.equipment.length?item.equipment.join(", "):"Não informado",
        status,
        item.home?"Sim":"Não"
      ]){
        const td=el("td",String(value));
        td.style.padding="8px";
        tr.append(td);
      }
      body.append(tr);
    }
    table.append(header,body);
    const wrap=el("div");
    wrap.style.overflowX="auto";
    wrap.append(table);
    $("exercisebankAuditResults").replaceChildren(wrap);
    text("exercisebankAuditStatus",
      "Amostra: "+(totals.sample??rows.length)+
      " · Vídeos liberados: "+(totals.liberated??0)+
      " · Bloqueados: "+(totals.blocked??0)+
      " · Sem link: "+(totals.noLink??0)+
      " · Domiciliares com link: "+(totals.homeWithVideo??0)+
      ". Verificação de URLs, não da reprodução efetiva.");
    $("exercisebankExport").hidden=!rows.length;
  }catch(e){
    sandboxAudit=null;
    $("exercisebankAuditResults").replaceChildren();
    text("exercisebankAuditStatus",e.message);
  }finally{
    auditRunning=false;
    button.disabled=false;
  }
}
function exportSandboxAudit(){
  const rows=Array.isArray(sandboxAudit?.rows)?sandboxAudit.rows:[];
  if(!rows.length)return;
  const encode=value=>'"'+String(value??"").replace(/"/g,'""')+'"';
  const data=[
    ["ID","Nome","Equipamentos","Vídeo","Domiciliar"],
    ...rows.map(item=>[
      item.id,item.name,Array.isArray(item.equipment)?item.equipment.join("; "):"",
      item.videoStatus,item.home?"Sim":"Não"
    ])
  ];
  const csv="\uFEFF"+data.map(row=>row.map(encode).join(",")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;link.download="exercisebank_sandbox_verificacao.csv";
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function loadExerciseMedia(id,target,button,source="ExerciseBank"){
  button.disabled=true;target.replaceChildren(el("p","Carregando demonstração...","card-text-small"));
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
    const video=el("video");video.controls=true;video.playsInline=true;video.preload="metadata";video.src=url;if(poster)video.poster=poster;
    target.replaceChildren(video,el("p",credit,"card-text-small"));
  }catch(e){target.replaceChildren(el("p",e.message,"card-text-small"));}
  finally{button.disabled=false;}
}

async function init(){
  menu();navigate("login");
  $("exercisebankRefresh")?.addEventListener("click",()=>loadSample(true));
  $("exercisebankAudit")?.addEventListener("click",auditSandboxVideos);
  $("exercisebankExport")?.addEventListener("click",exportSandboxAudit);
  $("exercisebankQuery")?.addEventListener("input",renderSample);
  $("exercisebankHomeOnly")?.addEventListener("change",renderSample);
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

window.AppAuth={login,logout,navigate,saveSymptoms,isProfessional};
window.atualizarPacienteProfissional=()=>selectPatient($("pacienteProf").value);
window.trocarPacientePlanoProf=()=>selectPatient($("pacientePlanoProf").value);
window.trocarPacienteRegistrosProf=()=>selectPatient($("pacienteRegistrosProf").value);
window.adicionarExercicioPlano=()=>addExercise();
window.limparFormularioPlano=clearPlanForm;
window.salvarPlanoProf=savePlan;
document.addEventListener("DOMContentLoaded",init);
