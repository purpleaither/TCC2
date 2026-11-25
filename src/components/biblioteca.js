import { $, el, text } from '../utils/dom.js';
import { BODY_REGION_LABELS, exerciseRegions, isExerciseNameTranslated, translateExerciseName } from '../utils/exercicios.js';

export function criarBiblioteca({ isProfessional, ebCall, addExercise, openExerciseConfiguration, loadExerciseMedia }) {
  let sampleList = null, loadingSample = false;
  let versao = 0;
  async function loadSample(){
    if(!isProfessional()||loadingSample)return;
    if(sampleList){renderSample();return;}
    const atual = ++versao;
    loadingSample=true;$("exercisebankRefresh").disabled=true;
    text("exercisebankStatus","Carregando exercícios...");
    try{
      const response = await ebCall();
      if (versao !== atual) return;
      sampleList = response;
      renderSample();
    }catch(e){
      if (versao !== atual) return;
      sampleList=null;$("exercisebankResults").replaceChildren();
      text("exercisebankStatus",e.message);
    }finally{
      if (versao === atual) {
        loadingSample=false;
        $("exercisebankRefresh").disabled=false;
      }
    }
  }
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
        openExerciseConfiguration($("itensPlanoProf").lastElementChild,"exercise-bank-prof",false);
      });
      row.append(preview,pick);card.append(row,media);root.append(card);
    });
  }
  function resetLibrary() {
    versao += 1;
    sampleList = null;
    loadingSample = false;
    $("exercisebankRefresh").disabled = false;
    $("exercisebankResults").replaceChildren();
  }
  return { loadSample, resetLibrary };
}
