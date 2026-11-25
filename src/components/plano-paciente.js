import { $, el } from '../utils/dom.js';
import { translateExerciseName } from '../utils/exercicios.js';
import { patientTpeAdviceForToday } from '../utils/conselho-educativo.js';

export function exibirTreinosDoDia(treinosConcluidos, year,month,day) {
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

export function exibirPlanoPaciente({ assigned, estado, records, navigate, completePatientWorkout, loadExerciseMedia }) {
  const root=$("exNormalContainer");
  if(!root)return;
  root.replaceChildren();
  if(!assigned.length){
    root.append(el("h2","Nenhum exercício atribuído","card-title"),
      el("p","Os exercícios aparecerão aqui após a prescrição profissional.","card-text"));
    return;
  }
  estado.indice=Math.max(0,Math.min(estado.indice,assigned.length-1));
  const {plan,exercise}=assigned[estado.indice];
  const card=el("div",undefined,"patient-exercise-card");
  card.append(el("p",plan.title,"patient-plan-title"));
  const progress=el("p","Exercício "+(estado.indice+1)+" de "+assigned.length,"patient-exercise-progress");
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
  const advice=patientTpeAdviceForToday(records);
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

  if(assigned.length>1){
    const actions=el("div",undefined,"demo-acoes");
    const previous=el("button","Anterior","btn btn-outline");
    previous.type="button";
    previous.disabled=estado.indice===0;
    previous.addEventListener("click",()=>{
      if(estado.indice>0){estado.indice--;exibirPlanoPaciente({ assigned, estado, records, navigate, completePatientWorkout, loadExerciseMedia });}
    });
    const next=el("button","Próximo","btn");
    next.type="button";
    next.disabled=estado.indice===assigned.length-1;
    next.addEventListener("click",()=>{
      if(estado.indice<assigned.length-1){estado.indice++;exibirPlanoPaciente({ assigned, estado, records, navigate, completePatientWorkout, loadExerciseMedia });}
    });
    actions.append(previous,next);
    card.append(actions);
  }
  if(estado.indice===assigned.length-1){
    const finish=el("button",estado.concluido?"Treino concluído ✓":"Treino concluído","btn patient-workout-finish");
    finish.id="finishPatientWorkout";
    finish.type="button";
    finish.disabled=estado.concluido;
    finish.addEventListener("click",completePatientWorkout);
    card.append(finish);
  }
  root.append(card);
  if(videoArea.isConnected){
    loadExerciseMedia(exercise.external_id,videoArea,null,exercise.exercise_source,true);
  }
}
