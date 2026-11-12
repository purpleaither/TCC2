import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const byId = id => document.getElementById(id);
const authPages = ["auth-profissional","auth-planos","auth-registros","auth-inicio","auth-exercicios","auth-sintomas","auth-historico"];
let client = null;
let currentUser = null;
let currentProfile = null;
let linkedPatients = [];
let patientId = null;
let busy = false;

function setStatus(message, error = false) {
  const el = byId("portalStatus");
  el.textContent = message;
  el.style.color = error ? "#b3261e" : "#555";
  const flash = byId("authFlash");
  if (flash) {
    flash.hidden = !isAuthenticated();
    flash.textContent = message;
    flash.style.background = error ? "#fff0f0" : "#e8f5e9";
    flash.style.color = error ? "#b3261e" : "#003366";
  }
}

function makeNode(tag, content, className = "") {
  const n = document.createElement(tag);
  if (content !== undefined) n.textContent = String(content);
  if (className) n.className = className;
  return n;
}

function assertResult(response) {
  if (response.error) throw response.error;
  return response.data;
}

function formatDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "Data indisponível" : d.toLocaleString("pt-BR", {dateStyle:"short",timeStyle:"short"});
}

function isAuthenticated() {
  return !!currentUser && !!currentProfile;
}

function isProfessional() {
  return isAuthenticated() && currentProfile.role === "fisioterapeuta";
}

function showNavigation() {
  const role = currentProfile ? "auth-" + currentProfile.role : "";
  document.querySelectorAll("[data-perfil]").forEach(item => {
    item.style.display = item.dataset.perfil === role ? "" : "none";
  });
  const menu = byId("menuBtn");
  if (menu) menu.setAttribute("aria-label", isProfessional() ? "Abrir menu profissional" : "Abrir menu do paciente");
  const btn = byId("headerPerfilBtn");
  if (btn) btn.textContent = isProfessional() ? "Profissional" : "Perfil";
}

function navigate(page) {
  const fallback = isProfessional() ? "auth-profissional" : "auth-inicio";
  const allowed = isProfessional() ? ["auth-profissional","auth-planos","auth-registros"] : ["auth-inicio","auth-exercicios","auth-sintomas","auth-historico"];
  if (!allowed.includes(page)) page = fallback;
  document.querySelectorAll(".page").forEach(item => item.classList.toggle("active", item.id === "page-" + page));
  mostrarCabecalho(true);
  document.querySelectorAll(".menu-item").forEach(item => {
    const active = item.getAttribute("onclick") === "navegarPara('" + page + "')";
    item.classList.toggle("active", active);
    if (active) item.setAttribute("aria-current", "page"); else item.removeAttribute("aria-current");
  });
  fecharMenu();
  fecharClimaSheet();
  window.scrollTo(0, 0);
  if (page === "auth-planos" || page === "auth-exercicios") renderPlans();
  if (page === "auth-registros" || page === "auth-historico") renderSymptoms();
}

function clearSessionUI() {
  currentUser = null;
  currentProfile = null;
  linkedPatients = [];
  patientId = null;
  showNavigation();
  const flash = byId("authFlash");
  if (flash) flash.hidden = true;
  const password = byId("passwordPortal");
  if (password) password.value = "";
  mostrarCabecalho(false);
  navegarPara("login-auth");
}

async function signOut() {
  if (client) await client.auth.signOut();
  clearSessionUI();
  setStatus("Sessão encerrada.");
}

async function login(event) {
  event.preventDefault();
  if (busy || !client) return;
  busy = true;
  setStatus("Verificando acesso...");
  try {
    const email = byId("emailPortal").value.trim();
    const password = byId("passwordPortal").value;
    assertResult(await client.auth.signInWithPassword({email,password}));
    byId("passwordPortal").value = "";
    await restoreSession();
  } catch (err) {
    setStatus("Não foi possível entrar. Verifique suas credenciais e o cadastro do perfil.", true);
  } finally {
    busy = false;
  }
}

async function restoreSession() {
  const auth = assertResult(await client.auth.getUser());
  if (!auth.user) return;
  const profile = assertResult(await client.from("profiles").select("id,display_name,role").eq("id",auth.user.id).single());
  if (!profile || !["fisioterapeuta","paciente"].includes(profile.role)) throw Error("Perfil sem acesso autorizado");
  currentUser = auth.user;
  currentProfile = profile;
  f2Session = null;
  f2StoreSession();
  showNavigation();
  if (isProfessional()) {
    byId("authProfessionalTitle").textContent = "Olá, " + profile.display_name;
    const links = assertResult(await client.from("care_links").select("patient_id").eq("physiotherapist_id",auth.user.id));
    const ids = (links || []).map(link => link.patient_id);
    linkedPatients = ids.length ? assertResult(await client.from("profiles").select("id,display_name").in("id",ids)) : [];
    const select = byId("patientPortal");
    select.replaceChildren();
    for (const patient of linkedPatients) {
      const option = makeNode("option", patient.display_name);
      option.value = patient.id;
      select.append(option);
    }
    patientId = linkedPatients[0]?.id || null;
    if (patientId) {
      select.value = patientId;
      if (!byId("exercisePortalRows").children.length) addExerciseRow();
    }
    byId("planPortalForm").querySelectorAll("input,textarea,button").forEach(el => el.disabled = !patientId);
    await refreshData();
    navigate("auth-profissional");
  } else {
    patientId = auth.user.id;
    byId("authPatientName").textContent = profile.display_name;
    await refreshData();
    navigate("auth-inicio");
  }
  setStatus("Acesso autenticado. Utilize apenas dados fictícios.");
}

function addExerciseRow() {
  if (!isProfessional()) return;
  const item = makeNode("div", undefined, "demo-exercicio-item");
  const label = makeNode("label", "Nome do exercício", "form-label");
  const name = makeNode("input", undefined, "form-input");
  name.type = "text";
  name.name = "exercise";
  name.required = true;
  name.maxLength = 160;
  name.placeholder = "Ex.: Mobilidade de tornozelo";
  label.append(name);
  item.append(label);

  const grid = makeNode("div", undefined, "demo-grid-parametros");
  const fields = [
    ["series","Séries","number","2"],
    ["repetitions","Repetições","text","10"],
    ["duration","Duração","text",""],
    ["frequency","Frequência","text","3 vezes por semana"]
  ];
  for (const [key,title,type,value] of fields) {
    const wrap = makeNode("div", undefined, "form-group");
    const fieldLabel = makeNode("label", title, "form-label");
    const input = makeNode("input", undefined, "form-input");
    input.name = key;
    input.type = type;
    input.value = value;
    if (type === "number") {
      input.min = "1";
      input.max = "20";
    } else input.maxLength = 80;
    fieldLabel.append(input);
    wrap.append(fieldLabel);
    grid.append(wrap);
  }
  item.append(grid);
  const remove = makeNode("button", "Remover exercício", "btn btn-outline");
  remove.type = "button";
  remove.addEventListener("click", () => item.remove());
  item.append(remove);
  byId("exercisePortalRows").append(item);
}

async function savePlan(event) {
  event.preventDefault();
  if (busy || !isProfessional() || !patientId) return;
  const form = byId("planPortalForm");
  const title = byId("planTitlePortal").value.trim();
  const rows = Array.from(byId("exercisePortalRows").children);
  if (title.length < 2 || rows.length < 1) return setStatus("Informe o nome do plano e pelo menos um exercício.",true);
  const exercises = rows.map((row,index) => {
    const val = name => row.querySelector('[name="' + name + '"]').value.trim();
    return {
      exercise_name:val("exercise"),
      series:Number(val("series")),
      repetitions:val("repetitions"),
      duration:val("duration"),
      frequency:val("frequency"),
      position:index
    };
  });
  if (exercises.some(item => item.exercise_name.length < 2 || !Number.isInteger(item.series) || item.series < 1 || item.series > 20 || (!item.repetitions && !item.duration) || !item.frequency)) return setStatus("Revise os parâmetros de todos os exercícios.",true);
  busy = true;
  let createdId = null;
  setStatus("Salvando o plano...");
  try {
    const plan = assertResult(await client.from("care_plans").insert({
      physiotherapist_id:currentUser.id,
      patient_id:patientId,
      title,
      notes:byId("planNotesPortal").value.trim()
    }).select("id").single());
    createdId = plan.id;
    assertResult(await client.from("plan_exercises").insert(exercises.map(item => ({...item,plan_id:createdId}))));
    form.reset();
    byId("exercisePortalRows").replaceChildren();
    addExerciseRow();
    await refreshData();
    navigate("auth-planos");
    setStatus("Plano salvo e associado ao paciente.");
  } catch (err) {
    if (createdId) await client.from("care_plans").delete().eq("id",createdId);
    setStatus("Não foi possível salvar o plano. Verifique a conexão e as permissões.",true);
  } finally {
    busy = false;
  }
}

async function saveSymptoms(event) {
  event.preventDefault();
  if (busy || !isAuthenticated() || isProfessional()) return;
  const rest = Number(byId("restPortal").value);
  const movement = Number(byId("movePortal").value);
  if (![rest,movement].every(n => Number.isInteger(n) && n >= 0 && n <= 10)) return setStatus("Informe valores de dor entre 0 e 10.",true);
  busy = true;
  setStatus("Salvando registro...");
  try {
    assertResult(await client.from("symptom_records").insert({
      patient_id:currentUser.id,
      pain_rest:rest,
      pain_movement:movement,
      stiffness:byId("stiffPortal").value,
      fatigue:byId("fatiguePortal").value
    }));
    byId("symptomsPortalForm").reset();
    await refreshData();
    navigate("auth-historico");
    setStatus("Registro salvo. O plano terapêutico não foi modificado.");
  } catch (err) {
    setStatus("Não foi possível salvar os sintomas. Verifique a conexão.",true);
  } finally {
    busy = false;
  }
}

function renderPlans() {
  if (!isAuthenticated()) return;
  const target = byId(isProfessional() ? "plansPortal" : "patientPlansPortal");
  target.replaceChildren();
  const plans = window.authPlans || [];
  if (isProfessional()) {
    byId("authPlanSubtitle").textContent = "Planos de " + (linkedPatients.find(p => p.id === patientId)?.display_name || "paciente");
  }
  if (!plans.length) target.append(makeNode("p","Nenhum plano atribuído.","card-text"));
  for (const plan of plans) {
    const card = makeNode("div",undefined,isProfessional() ? "demo-detalhe" : "card");
    card.append(makeNode("h3",plan.title,"card-title"));
    if (plan.notes) card.append(makeNode("p",plan.notes,"card-text"));
    const items = makeNode("ol");
    for (const ex of (plan.plan_exercises || []).sort((a,b) => a.position - b.position)) {
      const li = makeNode("li",ex.exercise_name + " · " + (ex.series ?? "–") + " séries · " + (ex.repetitions || "–") + " repetições · " + (ex.duration || "–") + " duração · " + ex.frequency);
      items.append(li);
    }
    card.append(items);
    card.append(makeNode("p","Criado em " + formatDate(plan.created_at),"card-text-small"));
    target.append(card);
  }
  if (!isProfessional()) byId("authHomePlanSummary").textContent = plans.length ? plans.length + " plano(s) individualizado(s) disponível(is)." : "Nenhum plano foi atribuído ainda.";
}

function renderSymptoms() {
  if (!isAuthenticated()) return;
  const target = byId(isProfessional() ? "symptomsPortal" : "patientSymptomsPortal");
  target.replaceChildren();
  if (isProfessional()) {
    byId("authRecordsSubtitle").textContent = "Registros de " + (linkedPatients.find(p => p.id === patientId)?.display_name || "paciente");
  }
  const records = window.authSymptoms || [];
  if (!records.length) target.append(makeNode("p","Nenhum registro disponível.","card-text"));
  for (const rec of records) {
    const card = makeNode("div",undefined,"demo-detalhe");
    card.append(makeNode("strong",formatDate(rec.recorded_at)));
    card.append(makeNode("p","Dor em repouso: " + rec.pain_rest + "/10 · Dor ao movimento: " + rec.pain_movement + "/10","card-text"));
    card.append(makeNode("p","Rigidez: " + rec.stiffness + " · Fadiga: " + rec.fatigue,"card-text-small"));
    target.append(card);
  }
}

async function refreshData() {
  window.authPlans = [];
  window.authSymptoms = [];
  if (!patientId) {
    if (isProfessional()) setStatus("Não há pacientes vinculados a este perfil.",true);
    renderPlans();
    renderSymptoms();
    return;
  }
  try {
    window.authPlans = assertResult(await client.from("care_plans")
      .select("id,title,notes,created_at,plan_exercises(exercise_name,series,repetitions,duration,frequency,position)")
      .eq("patient_id",patientId).order("created_at",{ascending:false})) || [];
    window.authSymptoms = assertResult(await client.from("symptom_records")
      .select("recorded_at,pain_rest,pain_movement,stiffness,fatigue")
      .eq("patient_id",patientId).order("recorded_at",{ascending:false}).limit(30)) || [];
    renderPlans();
    renderSymptoms();
  } catch (err) {
    setStatus("Não foi possível carregar os registros. Confira os vínculos e as permissões.",true);
  }
}

async function init() {
  const form = byId("loginPortalForm");
  form.addEventListener("submit",login);
  byId("planPortalForm").addEventListener("submit",savePlan);
  byId("symptomsPortalForm").addEventListener("submit",saveSymptoms);
  byId("addExercisePortal").addEventListener("click",addExerciseRow);
  byId("patientPortal").addEventListener("change",async event => {
    patientId = event.target.value;
    await refreshData();
  });
  try {
    const response = await fetch("/api/database-config",{cache:"no-store"});
    const config = await response.json();
    if (!response.ok || !config.configured) throw Error("Conexão ainda não disponível");
    client = createClient(config.url,config.publishableKey,{
      auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}
    });
    const session = await client.auth.getSession();
    if (session.error) throw session.error;
    client.auth.onAuthStateChange(event => {
      if (event === "SIGNED_OUT" && isAuthenticated()) clearSessionUI();
    });
    if (session.data.session) {
      await restoreSession();
    } else {
      setStatus("Entre com uma conta de teste cadastrada no Supabase.");
      if (location.hash === "#conta") navegarPara("login-auth");
    }
  } catch (err) {
    setStatus("A conexão autenticada ainda não está disponível.",true);
  }
}

window.AuthPortal = {
  isLoggedIn:isAuthenticated,
  isProfessional,
  navigate,
  signOut,
  enterLogin:() => navegarPara("login-auth")
};

document.addEventListener("DOMContentLoaded",init);
