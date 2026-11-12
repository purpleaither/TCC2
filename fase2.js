"use strict";
var F2_SESSION="tcc_fase2_sessao_v1";
var F2_PLANS="tcc_fase2_planos_v1";
var F2_PATIENTS=[{id:"p1",nome:"Maria Silva"},{id:"p2",nome:"João Oliveira"}];
var F2_EXERCISES=[
{id:"e1",nome:"Ponte de glúteos",area:"Musculoesquelética",instrucao:"Elevar a pelve de maneira controlada, conforme orientação profissional."},
{id:"e2",nome:"Mobilidade de tornozelo",area:"Musculoesquelética",instrucao:"Movimentos confortáveis de flexão dorsal e plantar."},
{id:"e3",nome:"Extensão ativa de joelho",area:"Musculoesquelética",instrucao:"Estender o joelho sentado e retornar lentamente."},
{id:"e4",nome:"Abdução de quadril em pé",area:"Musculoesquelética",instrucao:"Afastar a perna lateralmente com apoio estável."},
{id:"e5",nome:"Sentar e levantar",area:"Funcional",instrucao:"Executar o movimento em cadeira estável conforme prescrição."},
{id:"e6",nome:"Respiração diafragmática",area:"Respiratória",instrucao:"Praticar a respiração em posição confortável, conforme orientação profissional."},
{id:"e7",nome:"Expiração com lábios semicerrados",area:"Respiratória",instrucao:"Expirar lentamente sem forçar, quando indicado pelo profissional."}
];
var f2Session=null,f2Patient="p1",f2Editing=null;
function f2Get(key,fallback){try{var v=JSON.parse(localStorage.getItem(key));return v===null?fallback:v}catch(e){return fallback}}
function f2Put(key,v){try{localStorage.setItem(key,JSON.stringify(v));return true}catch(e){alert("Não foi possível salvar neste navegador.");return false}}
function f2ReadSession(){try{var s=JSON.parse(sessionStorage.getItem(F2_SESSION)||"null");if(s&&["paciente","fisioterapeuta"].includes(s.role)&&(s.role!=="paciente"||F2_PATIENTS.some(function(p){return p.id===s.patientId})))return s}catch(e){}return null}
function f2StoreSession(){try{if(f2Session)sessionStorage.setItem(F2_SESSION,JSON.stringify(f2Session));else sessionStorage.removeItem(F2_SESSION)}catch(e){}}
function f2RecordsKey(pid){return "tcc_fase2_registros_"+pid+"_v1"}
function f2LoadRecords(){registrosUsuario=f2Get(f2RecordsKey(f2Session.patientId),[]);if(!Array.isArray(registrosUsuario))registrosUsuario=[]}
function f2Plans(){var x=f2Get(F2_PLANS,{p1:[],p2:[]});if(!x||typeof x!=="object")x={};F2_PATIENTS.forEach(function(p){if(!Array.isArray(x[p.id]))x[p.id]=[]});return x}
function f2PatientName(id){var p=F2_PATIENTS.find(function(x){return x.id===id});return p?p.nome:"Paciente fictício"}
function f2Node(tag,cl,label){var n=document.createElement(tag);if(cl)n.className=cl;if(label!==undefined)n.textContent=String(label);return n}
function f2Text(id,value){var n=document.getElementById(id);if(n)n.textContent=String(value)}
function alternarPerfilLogin(){document.getElementById("loginPacienteGrupo").hidden=document.getElementById("loginTipo").value!=="paciente"}
function realizarLogin(event){if(event)event.preventDefault();var role=document.getElementById("loginTipo").value;var pid=document.getElementById("loginPaciente").value;
if(role!=="paciente"&&role!=="fisioterapeuta")return;
f2Session=role==="paciente"?{role:"paciente",patientId:pid}:{role:"fisioterapeuta"};
f2StoreSession();f2ApplySession()}
function realizarLogout(){f2Session=null;usuarioAtual=null;f2StoreSession();try{localStorage.removeItem(CHAVE_STORAGE);sessionStorage.removeItem(CHAVE_STORAGE)}catch(e){}f2ApplySession()}
function verificarSessao(){f2Session=f2ReadSession();f2ApplySession()}
function f2IsProf(){return !!f2Session&&f2Session.role==="fisioterapeuta"}
function f2ApplySession(){
document.querySelectorAll("[data-perfil]").forEach(function(n){n.style.display=f2Session&&n.dataset.perfil===f2Session.role?"":"none"});
var btn=document.getElementById("menuBtn");
if(btn){btn.setAttribute("aria-label",f2IsProf()?"Abrir menu do fisioterapeuta":"Abrir menu do paciente");btn.setAttribute("aria-controls","menuDrawer");btn.setAttribute("aria-expanded","false")}
if(!f2Session){mostrarCabecalho(false);navegarPara("login");return}
if(f2IsProf()){usuarioAtual={nome:"Fisioterapeuta demonstrativo"};f2Text("headerPerfilBtn","Profissional");f2SyncSelectors();navegarPara("profissional")}
else{usuarioAtual={nome:f2PatientName(f2Session.patientId)};f2Text("headerPerfilBtn","Perfil");f2LoadRecords();aplicarUsuarioNaInterface(usuarioAtual.nome);gerarHeatmap();verificarRegistroHoje();f2RenderPatientPlans();navegarPara("inicio")}
}
function navegarPara(page){
if(f2Session){
var prof=["profissional","planos-prof","registros-prof"],pac=["inicio","sintomas","historico","orientacoes","exercicios","contatos"];
if(f2IsProf()&&!prof.includes(page))page="profissional";
if(!f2IsProf()&&!pac.includes(page))page="inicio"
}else if(!["login","boas-vindas","tcle","questionario-inicial"].includes(page))page="login";
document.querySelectorAll(".page").forEach(function(n){n.classList.toggle("active",n.id==="page-"+page)});
mostrarCabecalho(!["login","boas-vindas","tcle","questionario-inicial"].includes(page));
document.querySelectorAll(".menu-item").forEach(function(n){var active=n.getAttribute("onclick")==="navegarPara('"+page+"')";n.classList.toggle("active",active);if(active)n.setAttribute("aria-current","page");else n.removeAttribute("aria-current")});
fecharMenu();fecharClimaSheet();
if(page==="planos-prof")f2RenderProfPlans();
if(page==="registros-prof")f2RenderProfRecords();
if(page==="exercicios")f2RenderPatientPlans();
window.scrollTo(0,0)}
function concluirRegistro(event){
if(event)event.preventDefault();if(!f2Session||f2IsProf())return;
var maiorDor=Math.max(dorRepouso,dorMovimento);
var registro={data:new Date().toISOString(),dorRepouso:dorRepouso,dorMovimento:dorMovimento,maiorDor:maiorDor,rigidez:rigidezAtual,fadiga:fadigaAtual,humor:humorAtual,atividade:atividadeAtual,sinalAtipico:atipico===1};
registrosUsuario.push(registro);
if(!f2Put(f2RecordsKey(f2Session.patientId),registrosUsuario)){registrosUsuario.pop();return}
gerarHeatmap();buscarClimaReal();
var a=document.getElementById("climaBloqueado"),b=document.getElementById("climaLiberado");
if(a)a.style.display="none";if(b)b.style.display="block";
if(registro.sinalAtipico||maiorDor>=8)alert("Registro salvo. Se houver sintomas intensos ou inesperados, procure orientação profissional. Nenhum exercício foi alterado ou bloqueado automaticamente.");
navegarPara("inicio");verificarRegistroHoje()}
function f2SyncSelectors(){["pacienteProf","pacientePlanoProf","pacienteRegistrosProf"].forEach(function(id){var n=document.getElementById(id);if(n)n.value=f2Patient})}
function atualizarPacienteProfissional(){f2Patient=document.getElementById("pacienteProf").value;f2SyncSelectors()}
function trocarPacientePlanoProf(){f2Patient=document.getElementById("pacientePlanoProf").value;f2SyncSelectors();limparFormularioPlano();f2RenderProfPlans()}
function trocarPacienteRegistrosProf(){f2Patient=document.getElementById("pacienteRegistrosProf").value;f2SyncSelectors();f2RenderProfRecords()}
function f2RenderProfPlans(){
if(!f2IsProf())return;f2SyncSelectors();f2Text("profPlanosDescricao","Planos de "+f2PatientName(f2Patient)+" - dados fictícios");
var root=document.getElementById("listaPlanosProf");root.replaceChildren();var items=f2Plans()[f2Patient];
if(!items.length)root.append(f2Node("p","demo-vazio","Nenhum plano atribuído a este paciente fictício."));
items.forEach(function(plan){var box=f2Node("div","card");box.append(f2Node("h3","card-title",plan.nome));
if(plan.orientacoes)box.append(f2Node("p","card-text",plan.orientacoes));
(plan.exercicios||[]).forEach(function(item){var ex=F2_EXERCISES.find(function(x){return x.id===item.exercicioId});if(!ex)return;box.append(f2Node("div","demo-detalhe",ex.nome+" · "+item.series+" série(s) · "+(item.repeticoes||"-")+" repetições · "+(item.duracao||"-")+" duração · "+(item.frequencia||"-")+" frequência"))});
var actions=f2Node("div","demo-acoes"),edit=f2Node("button","btn","Editar"),del=f2Node("button","btn btn-outline","Excluir");
edit.type="button";del.type="button";edit.addEventListener("click",function(){f2EditPlan(plan.id)});del.addEventListener("click",function(){f2DeletePlan(plan.id)});actions.append(edit,del);box.append(actions);root.append(box)})}
function adicionarExercicioPlano(item){
if(!f2IsProf())return;var root=document.getElementById("itensPlanoProf"),row=f2Node("div","demo-exercicio-item"),select=f2Node("select","form-input");
select.name="exercicioId";select.setAttribute("aria-label","Exercício");F2_EXERCISES.forEach(function(ex){var op=f2Node("option","",ex.nome+" ("+ex.area+")");op.value=ex.id;select.append(op)});if(item&&item.exercicioId)select.value=item.exercicioId;
row.append(f2Node("label","form-label","Exercício"),select);var group=f2Node("div","demo-grid-parametros");
[["series","Séries","number","2"],["repeticoes","Repetições","text","10"],["duracao","Duração","text",""],["frequencia","Frequência","text","3x/semana"]].forEach(function(a){var wrap=f2Node("div","form-group"),inp=f2Node("input","form-input");inp.name=a[0];inp.type=a[2];inp.value=item&&item[a[0]]!==undefined?item[a[0]]:a[3];if(a[2]==="number"){inp.min="1";inp.max="20"}else inp.maxLength=60;wrap.append(f2Node("label","form-label",a[1]),inp);group.append(wrap)});
row.append(group);var remove=f2Node("button","btn btn-outline","Remover exercício");remove.type="button";remove.addEventListener("click",function(){row.remove()});row.append(remove);root.append(row)}
function limparFormularioPlano(){f2Editing=null;document.getElementById("formPlanoProf").reset();document.getElementById("itensPlanoProf").replaceChildren();f2Text("tituloFormularioPlano","Criar plano terapêutico")}
function f2EditPlan(id){if(!f2IsProf())return;var p=f2Plans()[f2Patient].find(function(x){return x.id===id});if(!p)return;limparFormularioPlano();f2Editing=id;document.getElementById("nomePlanoProf").value=p.nome;document.getElementById("orientacoesPlanoProf").value=p.orientacoes||"";(p.exercicios||[]).forEach(adicionarExercicioPlano);f2Text("tituloFormularioPlano","Editar plano terapêutico");document.getElementById("formPlanoProf").scrollIntoView({behavior:"smooth"})}
function salvarPlanoProf(event){
if(event)event.preventDefault();if(!f2IsProf())return;var nome=document.getElementById("nomePlanoProf").value.trim();
var rows=Array.from(document.querySelectorAll("#itensPlanoProf .demo-exercicio-item"));
if(!nome||!rows.length){alert("Informe um nome e inclua pelo menos um exercício.");return}
var items=rows.map(function(row){function val(name){return row.querySelector('[name="'+name+'"]').value.trim()}return{exercicioId:val("exercicioId"),series:Number(val("series")),repeticoes:val("repeticoes"),duracao:val("duracao"),frequencia:val("frequencia")}});
if(items.some(function(i){return!i.series||i.series<1||i.series>20||(!i.repeticoes&&!i.duracao)||!i.frequencia})){alert("Confira séries (1 a 20), repetições ou duração e frequência de cada exercício.");return}
var data=f2Plans(),arr=data[f2Patient],plan={id:f2Editing||"pl_"+Date.now().toString(36),nome:nome.slice(0,100),orientacoes:document.getElementById("orientacoesPlanoProf").value.trim().slice(0,700),exercicios:items,atualizadoEm:new Date().toISOString()},at=arr.findIndex(function(p){return p.id===f2Editing});if(at>=0)arr[at]=plan;else arr.push(plan);
if(f2Put(F2_PLANS,data)){limparFormularioPlano();f2RenderProfPlans();alert("Plano fictício salvo neste navegador.")}}
function f2DeletePlan(id){if(!f2IsProf()||!confirm("Excluir este plano fictício?"))return;var data=f2Plans();data[f2Patient]=data[f2Patient].filter(function(p){return p.id!==id});if(f2Put(F2_PLANS,data)){limparFormularioPlano();f2RenderProfPlans()}}
function f2RenderPatientPlans(){
if(!f2Session||f2IsProf())return;var arr=f2Plans()[f2Session.patientId],home=document.getElementById("homeRoutineValue"),desc=document.getElementById("homeRoutineDesc");
if(home)home.textContent=arr.length?arr.length+" plano(s) atribuído(s)":"Aguardando atribuição";
if(desc)desc.textContent=arr.length?"Consulte o plano individualizado configurado pelo fisioterapeuta demonstrativo.":"Nenhum plano foi atribuído a este perfil fictício.";
var root=document.getElementById("exNormalContainer");if(!root)return;root.replaceChildren();
if(!arr.length){root.append(f2Node("h3","card-title","Nenhum plano atribuído"),f2Node("p","card-text","Aguarde a configuração do plano pelo fisioterapeuta demonstrativo."));return}
arr.forEach(function(plan){var card=f2Node("div","card");card.append(f2Node("h3","card-title",plan.nome));
if(plan.orientacoes)card.append(f2Node("p","card-text",plan.orientacoes));
(plan.exercicios||[]).forEach(function(item){var ex=F2_EXERCISES.find(function(x){return x.id===item.exercicioId});if(!ex)return;var box=f2Node("div","demo-detalhe");box.append(f2Node("strong","",ex.nome),f2Node("p","card-text",ex.instrucao),f2Node("p","card-text","Séries: "+item.series+" · Repetições: "+(item.repeticoes||"-")+" · Duração: "+(item.duracao||"-")+" · Frequência: "+item.frequencia));card.append(box)});root.append(card)})}
function f2RenderProfRecords(){
if(!f2IsProf())return;var root=document.getElementById("listaRegistrosProf");root.replaceChildren();var data=f2Get(f2RecordsKey(f2Patient),[]);
if(!Array.isArray(data)||!data.length){root.append(f2Node("p","demo-vazio","Nenhum registro de sintomas deste paciente fictício neste navegador."));return}
data.slice().reverse().forEach(function(r){var card=f2Node("div","card");card.append(f2Node("h3","card-title",new Date(r.data).toLocaleString("pt-BR")),f2Node("p","card-text","Dor em repouso: "+r.dorRepouso+"/10 · Dor ao movimento: "+r.dorMovimento+"/10"),f2Node("p","card-text","Rigidez: "+["Nenhuma","Leve","Moderada","Intensa"][r.rigidez]+" · Fadiga: "+["Nenhuma","Leve","Moderada","Intensa"][r.fadiga]));root.append(card)})}
document.addEventListener("DOMContentLoaded",function(){verificarSessao()});
