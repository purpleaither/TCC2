import { $, el } from '../utils/dom.js';
import { exercises } from '../data/exercicios-manuais.js';

export function adicionarLinha(entry, isProfessional, updatePlanEditorSummary) {
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
  const hiddenFields = ["externalId", "externalInstructions", "externalSource"].map(name => {
    const field = el("input");
    field.name = name;
    field.type = "hidden";
    return field;
  });
  const [externalId, externalInstructions, externalSource] = hiddenFields;
  row.append(...hiddenFields);
  const customName=el("input",undefined,"form-input");
  customName.name="customName";
  customName.placeholder="Nome do exercício";
  customName.maxLength=160;
  customName.hidden=true;
  row.append(customName);
  select.addEventListener("change",()=>{
    customName.hidden=select.value!=="other";
    customName.required=select.value==="other";
    for (const field of hiddenFields) field.value = "";
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
      externalSource.value=entry.exercise_source;
      const sourceLabel=el("p",entry.exercise_source==="ExerciseBank"?"ExerciseBank · catálogo de demonstração":"wger · vídeo sujeito à disponibilidade e licença","card-text-small");
      row.prepend(sourceLabel);
    }
    for(const k of ["series","repetitions","duration","frequency"])
      row.querySelector('[name="'+k+'"]').value=entry[k]??"";
  }
}

export function readExercises(){
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
