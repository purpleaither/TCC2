import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const $=id=>document.getElementById(id);
let client=null,me=null,profile=null,patients=[],selectedPatient=null,loading=false;
function setStatus(message,error=false){const n=$("portalStatus");n.textContent=message;n.className=error?"portal-note portal-error":"card-text";}
function show(id,visible){$(id).hidden=!visible}
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n}
function clear(id){$(id).replaceChildren()}
function date(v){return new Date(v).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}
function check(data){if(data.error)throw data.error;return data.data}
async function init(){
 try{
  const response=await fetch("/api/database-config",{cache:"no-store"});
  const conf=await response.json();
  if(!response.ok||!conf.configured)throw Error(conf.error||"Banco indisponível");
  client=createClient(conf.url,conf.publishableKey,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}});
  const session=await client.auth.getSession();if(session.error)throw session.error;
  $("loginPortalForm").addEventListener("submit",login);
  $("logoutPortal").addEventListener("click",logout);
  $("planPortalForm").addEventListener("submit",savePlan);
  $("symptomsPortalForm").addEventListener("submit",saveSymptoms);
  $("addExercisePortal").addEventListener("click",()=>addExerciseRow());
  $("patientPortal").addEventListener("change",async e=>{selectedPatient=e.target.value;await refreshData()});
  client.auth.onAuthStateChange((event)=>{if(event==="SIGNED_OUT"){me=null;profile=null;show("contentPortal",false);show("loginPortal",true);show("logoutPortal",false);setStatus("Entre com uma conta de teste autorizada.");}});
  if(session.data.session)await hydrate();else{show("loginPortal",true);setStatus("Conexão disponível. Entre com uma conta de teste.");}
 }catch(error){setStatus("A área autenticada ainda não está disponível: "+error.message,true);show("loginPortal",false);show("contentPortal",false)}
}
async function login(e){
 e.preventDefault();if(loading)return;loading=true;setStatus("Verificando credenciais...");
 try{const result=await client.auth.signInWithPassword({email:$("emailPortal").value.trim(),password:$("passwordPortal").value});check(result);$("passwordPortal").value="";await hydrate();}
 catch(error){setStatus("Não foi possível entrar. Verifique as credenciais e a configuração de acesso.",true)}
 finally{loading=false}
}
async function logout(){if(!client)return;await client.auth.signOut();show("contentPortal",false);show("loginPortal",true);show("logoutPortal",false)}
async function hydrate(){
 const user=check(await client.auth.getUser()).user;if(!user)throw Error("Sessão não encontrada");me=user;
 const data=check(await client.from("profiles").select("id,display_name,role").eq("id",me.id).single());
 if(!data||!["fisioterapeuta","paciente"].includes(data.role)){await client.auth.signOut();throw Error("Perfil ainda não autorizado pela administração")}
 profile=data;
 $("welcomePortal").textContent="Olá, "+profile.display_name;
 $("rolePortal").textContent=profile.role==="fisioterapeuta"?"Fisioterapeuta · acesso autenticado":"Paciente · acesso autenticado";
 show("loginPortal",false);show("contentPortal",true);show("logoutPortal",true);
 show("professionalPortal",profile.role==="fisioterapeuta");show("patientPortalSection",profile.role==="paciente");
 if(profile.role==="fisioterapeuta"){
  const links=check(await client.from("care_links").select("patient_id").eq("physiotherapist_id",me.id));
  const ids=(links||[]).map(x=>x.patient_id);
  patients=ids.length?check(await client.from("profiles").select("id,display_name").in("id",ids)):[];
  $("patientPortal").replaceChildren();
  for(const patient of patients){const op=node("option",patient.display_name);op.value=patient.id;$("patientPortal").append(op)}
  selectedPatient=patients[0]?.id||null;
  if(selectedPatient){$("patientPortal").value=selectedPatient;if(!$("exercisePortalRows").children.length)addExerciseRow()}
  $("planPortalForm").querySelectorAll("input,textarea,button").forEach(n=>n.disabled=!selectedPatient);
 }else selectedPatient=me.id;
 await refreshData();
 setStatus("Conexão autenticada. Utilize exclusivamente dados fictícios nesta fase.");
}
function addExerciseRow(){
 if(!profile||profile.role!=="fisioterapeuta")return;
 const wrap=node("div",undefined,"portal-exercise");
 const title=document.createElement("label");title.textContent="Nome do exercício";
 const name=document.createElement("input");name.className="form-input";name.name="exercise";name.maxLength=160;name.required=true;name.placeholder="Ex.: Mobilidade de tornozelo";
 title.append(name);wrap.append(title);
 const grid=node("div",undefined,"portal-row");
 const fields=[["series","Séries","number","2"],["repetitions","Repetições","text","10"],["duration","Duração","text",""],["frequency","Frequência","text","3 vezes por semana"]];
 for(const [key,label,type,value] of fields){
  const box=document.createElement("label");box.textContent=label;
  const inp=document.createElement("input");inp.name=key;inp.type=type;inp.value=value;inp.className="form-input";inp.maxLength=80;
  if(type==="number"){inp.min="1";inp.max="20";}
  box.append(inp);grid.append(box);
 }
 wrap.append(grid);
 const remove=node("button","Remover exercício","btn btn-outline");remove.type="button";remove.addEventListener("click",()=>wrap.remove());wrap.append(remove);
 $("exercisePortalRows").append(wrap);
}
async function savePlan(e){
 e.preventDefault();if(loading||!profile||profile.role!=="fisioterapeuta"||!selectedPatient)return;
 const elements=Array.from($("exercisePortalRows").children);if(!elements.length)return setStatus("Adicione pelo menos um exercício.",true);
 const exercises=elements.map(row=>{const val=name=>row.querySelector('[name="'+name+'"]').value.trim();return{exercise_name:val("exercise"),series:Number(val("series")),repetitions:val("repetitions"),duration:val("duration"),frequency:val("frequency"),position:0}});
 if(exercises.some(x=>x.exercise_name.length<2||x.series<1||x.series>20||!x.frequency||(!x.repetitions&&!x.duration)))return setStatus("Confira os dados dos exercícios.",true);
 loading=true;setStatus("Salvando plano...");
 let newId=null;
 try{
  const plan=check(await client.from("care_plans").insert({physiotherapist_id:me.id,patient_id:selectedPatient,title:$("planTitlePortal").value.trim(),notes:$("planNotesPortal").value.trim()}).select("id").single());
  newId=plan.id;
  check(await client.from("plan_exercises").insert(exercises.map((x,i)=>({...x,plan_id:newId,position:i}))));
  $("planPortalForm").reset();clear("exercisePortalRows");addExerciseRow();
  await refreshData();setStatus("Plano salvo no banco, associado ao paciente vinculado.");
 }catch(error){
  if(newId)await client.from("care_plans").delete().eq("id",newId);
  setStatus("Não foi possível salvar o plano. Nenhum plano incompleto deverá permanecer.",true);
 }finally{loading=false}
}
async function saveSymptoms(e){
 e.preventDefault();if(loading||!profile||profile.role!=="paciente")return;loading=true;
 try{
  const item={patient_id:me.id,pain_rest:Number($("restPortal").value),pain_movement:Number($("movePortal").value),stiffness:$("stiffPortal").value,fatigue:$("fatiguePortal").value};
  if(!Number.isInteger(item.pain_rest)||!Number.isInteger(item.pain_movement)||item.pain_rest<0||item.pain_rest>10||item.pain_movement<0||item.pain_movement>10)throw Error("Intensidade de dor inválida");
  check(await client.from("symptom_records").insert(item));
  $("symptomsPortalForm").reset();await refreshData();setStatus("Registro demonstrativo salvo. A prescrição não foi modificada.");
 }catch(error){setStatus("Não foi possível registrar os sintomas.",true)}
 finally{loading=false}
}
async function refreshData(){
 clear("plansPortal");clear("symptomsPortal");
 if(!selectedPatient){$("plansPortal").append(node("p","Nenhum paciente vinculado."));$("symptomsPortal").append(node("p","Nenhum registro."));return}
 try{
  const plans=check(await client.from("care_plans").select("id,title,notes,created_at,plan_exercises(exercise_name,series,repetitions,duration,frequency,instructions,position)").eq("patient_id",selectedPatient).order("created_at",{ascending:false}));
  if(!plans.length)$("plansPortal").append(node("p","Nenhum plano individualizado atribuído.","card-text"));
  for(const p of plans){
   const card=node("article",undefined,"portal-activity");
   card.append(node("h3",p.title,"card-title"));
   if(p.notes)card.append(node("p",p.notes,"card-text"));
   const list=document.createElement("ol");
   (p.plan_exercises||[]).sort((a,b)=>a.position-b.position).forEach(item=>{const li=node("li",item.exercise_name+" · "+(item.series||"-")+" séries · "+(item.repetitions||"-")+" repetições · "+(item.duration||"-")+" duração · "+item.frequency);list.append(li)});
   card.append(list);card.append(node("small",date(p.created_at)));
   $("plansPortal").append(card);
  }
  const symptoms=check(await client.from("symptom_records").select("recorded_at,pain_rest,pain_movement,stiffness,fatigue").eq("patient_id",selectedPatient).order("recorded_at",{ascending:false}).limit(30));
  if(!symptoms.length)$("symptomsPortal").append(node("p","Nenhum registro ainda.","card-text"));
  for(const r of symptoms){const card=node("article",undefined,"portal-activity");card.append(node("strong",date(r.recorded_at)),node("p","Dor em repouso: "+r.pain_rest+"/10 · Dor ao movimento: "+r.pain_movement+"/10"),node("small","Rigidez: "+r.stiffness+" · Fadiga: "+r.fatigue));$("symptomsPortal").append(card)}
 }catch(error){setStatus("Não foi possível carregar os dados. Confira as permissões e o vínculo de acesso.",true)}
}
init();
