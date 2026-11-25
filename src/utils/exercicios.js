import primeiraParte from '../data/glossario-exercicios-primeira-parte.js';
import segundaParte from '../data/glossario-exercicios-segunda-parte.js';

export const EXERCISE_NAMES_PT = { ...primeiraParte, ...segundaParte };

export const BODY_REGION_LABELS={
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
export function normalizeExerciseName(name){
  return String(name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/&/g," and ").replace(/[-_/]+/g," ")
    .replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
}
const EXERCISE_PT_LOOKUP=new Map(Object.entries(EXERCISE_NAMES_PT)
  .map(([en,pt])=>[normalizeExerciseName(en),pt]));
export function translateExerciseName(name){
  const original=String(name||"").trim();
  return EXERCISE_PT_LOOKUP.get(normalizeExerciseName(original))||original;
}
export function isExerciseNameTranslated(name){
  return EXERCISE_PT_LOOKUP.has(normalizeExerciseName(name));
}
export function exerciseRegions(ex){
  const primary=Array.isArray(ex.primaryMuscles)?ex.primaryMuscles:[];
  const secondary=Array.isArray(ex.secondaryMuscles)?ex.secondaryMuscles:[];
  const resolve=part=>MUSCLE_TO_REGION[String(part).toLowerCase().replace(/[-\s]/g,"_")];
  const regions=[...new Set(primary.map(resolve).filter(Boolean))];
  const secondaryRegions=[...new Set(secondary.map(resolve).filter(Boolean))];
  return regions.length?regions:secondaryRegions.length?secondaryRegions:["nao-classificados"];
}
