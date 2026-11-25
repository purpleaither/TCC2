import { $, el, text } from '../utils/dom.js';

export function exibirPlanosProfissionais({ patients, patientId, plans, loadExerciseMedia, editPlan, deletePlan, createPlanFromScratch, addExercisesToExistingPlan }) {
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
    card.append(el("h2",p.title,"card-title"));
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
