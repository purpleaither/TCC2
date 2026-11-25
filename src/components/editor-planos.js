import { $, el, text } from '../utils/dom.js';
import { validarExercicio } from '../utils/validacao.js';
import { adicionarLinha, lerExercicio } from './linha-exercicio.js';

export function criarEditor({ isProfessional, pacienteSelecionado, listarPlanos, ocupado, navigate, message }) {
  let editingPlan = null;
  const addExercise = entry => adicionarLinha(entry, isProfessional, updatePlanEditorSummary);

  let exerciseReturnPage="planos-prof";
  let pendingExerciseRow=null;
  let pendingExerciseOrigin="exercise-source-prof";
  let pendingExercisePlaceholder=null;
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
      const heading=el("strong",(index+1)+". "+(lerExercicio(row).exercise_name || "Exercício sem nome"),"exercise-summary-name");
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
    if(!isProfessional()||!pacienteSelecionado())return;
    const plans = listarPlanos();
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
      card.append(el("h2",plan.title,"card-title"));
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
    const plan=listarPlanos().find(x=>x.id===planId);
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
    if(!validarExercicio(lerExercicio(row))){
      message("Informe o exercício, as séries, as repetições ou duração e a frequência.",true);
      return;
    }
    encerrarConfiguracao(true);
    navigate("editor-prof");
    message("Exercício inserido. Revise a quantidade e salve o plano quando terminar.");
  }
  function backFromExerciseConfiguration(){
    if(!pendingExerciseRow)return navigate("exercise-source-prof");
    encerrarConfiguracao(false);
    navigate(pendingExerciseOrigin);
  }
  function encerrarConfiguracao(inserir) {
    const remove=pendingExerciseRow.querySelector("button.btn-outline");
    if(remove)remove.hidden=false;
    if(pendingExercisePlaceholder)pendingExercisePlaceholder.replaceWith(pendingExerciseRow);
    else if (inserir) $("itensPlanoProf").append(pendingExerciseRow);
    else pendingExerciseRow.remove();
    pendingExerciseRow=null;
    pendingExercisePlaceholder=null;
    updatePlanEditorSummary();
  }
  function createPlanFromScratch(){
    if(!isProfessional())return;
    clearPlanForm();
    navigate("editor-prof");
  }
  function cancelPlanEditor(){
    if(!isProfessional()||ocupado())return;
    const hasDraft=!!editingPlan||!!$("itensPlanoProf")?.children.length||
      !!$("nomePlanoProf")?.value.trim()||!!$("orientacoesPlanoProf")?.value.trim();
    if(hasDraft&&!confirm("Descartar as alterações não salvas e cancelar a edição?"))return;
    clearPlanForm();
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
    const plan=listarPlanos().find(p=>p.id===id);
    if(!plan||!isProfessional())return;
    clearPlanForm();
    editingPlan=id;
    $("nomePlanoProf").value=plan.title;
    $("orientacoesPlanoProf").value=plan.notes||"";
    for(const x of [...(plan.plan_exercises||[])].sort((a,b)=>a.position-b.position))addExercise(x);
    text("tituloFormularioPlano","Editar plano terapêutico");
    navigate("editor-prof");
  }
  return {
    addExercise, updatePlanEditorSummary, choosePlanForExerciseAddition, addExercisesToExistingPlan,
    openExerciseSourceOptions, backFromExerciseSource, addManualExerciseFromOptions, openExerciseBankFromOptions,
    openExerciseConfiguration, finishExerciseInsertion, backFromExerciseConfiguration, createPlanFromScratch,
    cancelPlanEditor, clearPlanForm, editPlan, planoEmEdicao: () => editingPlan
  };
}
