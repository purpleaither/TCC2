import { localDateKey } from './datas.js';

// Conselho educativo por sintomas do dia, sem diagnóstico nem mudança da prescrição.
function todaysPatientSymptoms(records) {
  if(!records.length)return null;
  const today=localDateKey(new Date());
  return records.filter(r=>localDateKey(r.recorded_at)===today)
    .sort((a,b)=>new Date(b.recorded_at)-new Date(a.recorded_at))[0]||null;
}
export function patientTpeAdviceForToday(records) {
  const record=todaysPatientSymptoms(records);
  if(!record)return {
    title:"Conselho geral",
    body:"O registro de sintomas de hoje ainda não foi realizado. Observe como você se sente e siga o plano combinado com seu fisioterapeuta; o conselho será ajustado após o registro."
  };
  const rest=Number(record.pain_rest), movement=Number(record.pain_movement);
  const intensity=Math.max(Number.isFinite(rest)?rest:0,Number.isFinite(movement)?movement:0);
  const stiffness=String(record.stiffness||"").toLowerCase();
  const fatigue=String(record.fatigue||"").toLowerCase();
  if(intensity>=8)return {
    title:"Atenção aos sintomas de hoje",
    body:"Você registrou dor intensa hoje. Não force os movimentos nem aumente a intensidade por conta própria. Entre em contato com o fisioterapeuta para orientar a continuidade do plano. Se a dor for súbita, muito diferente da habitual ou acompanhada de sinais preocupantes, procure atendimento de saúde."
  };
  if(intensity>=5)return {
    title:"Dor e movimento",
    body:"Hoje você registrou dor moderada ou elevada. A intensidade da dor pode variar de um dia para outro e não indica, sozinha, dano aos tecidos. Respeite os limites orientados pelo fisioterapeuta e converse com ele caso os exercícios piorem os sintomas."
  };
  if(fatigue==="intensa"||fatigue==="moderada")return {
    title:"Fadiga e organização das atividades",
    body:"Você relatou fadiga hoje. Planejar pausas e distribuir as atividades ao longo do dia pode ajudar no autocuidado. Mantenha as orientações do fisioterapeuta e informe caso a fadiga limite a execução do plano."
  };
  if(stiffness==="intensa"||stiffness==="moderada")return {
    title:"Rigidez e movimento",
    body:"Você relatou rigidez hoje. Movimentos confortáveis, realizados conforme o plano prescrito, podem ajudar a explorar a mobilidade sem forçar amplitudes. Se a rigidez for incomum ou piorar, converse com o fisioterapeuta."
  };
  return {
    title:"Autonomia no dia a dia",
    body:"Seu registro de hoje indica sintomas menos intensos. Continue observando como se sente e siga o ritmo e os exercícios indicados pelo fisioterapeuta, sem aumentar a carga por conta própria."
  };
}
