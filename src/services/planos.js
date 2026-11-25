import { result } from './banco.js';

export async function gravarPlano(supabase, editingPlan, data, items) {
  const gravacao = await supabase.rpc("gravar_plano", {
    p_plano: editingPlan,
    p_paciente: data.patient_id,
    p_titulo: data.title,
    p_notas: data.notes,
    p_itens: items
  });
  // Mantém a gravação disponível em implantações anteriores à migração.
  // Erros de gravação ou autorização nunca disparam a gravação alternativa.
  if (gravacao.error?.code !== "PGRST202") return result(gravacao);
  return gravarPlanoLegado(supabase, editingPlan, data, items);
}

async function gravarPlanoLegado(supabase, editingPlan, data, items) {
  let insertedId = null;
  try {
    if(editingPlan){
      result(await supabase.from("care_plans").update({title:data.title,notes:data.notes,updated_at:new Date().toISOString()}).eq("id",editingPlan));
      result(await supabase.from("plan_exercises").delete().eq("plan_id",editingPlan));
      result(await supabase.from("plan_exercises").insert(items.map(x=>({...x,plan_id:editingPlan}))));
    }else{
      const plan=result(await supabase.from("care_plans").insert(data).select("id").single());
      insertedId=plan.id;
      result(await supabase.from("plan_exercises").insert(items.map(x=>({...x,plan_id:insertedId}))));
    }
  } catch (error) {
    if (insertedId) await supabase.from("care_plans").delete().eq("id", insertedId);
    throw error;
  }
}

export async function excluirPlano(supabase, id) {
  return result(await supabase.from("care_plans").delete().eq("id", id));
}
