export function result(reply) {
  if(reply.error) throw reply.error;
  return reply.data;
}

export async function conectarBanco() {
  const response=await fetch("/api/database-config",{cache:"no-store"});
  const config=await response.json();
  if(!response.ok||!config.configured)throw Error("Conexão indisponível");
  const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2/+esm");
  return createClient(config.url,config.publishableKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
  });
}

export async function consultarPerfil(supabase, id) {
  return result(await supabase.from("profiles").select("id,display_name,role").eq("id",id).single());
}

export async function consultarPacientesVinculados(supabase, id) {
  const links=result(await supabase.from("care_links").select("patient_id").eq("physiotherapist_id",id));
  const ids=(links||[]).map(x=>x.patient_id);
  return ids.length ? result(await supabase.from("profiles").select("id,display_name").in("id",ids)) : [];
}

export async function autenticar(supabase, email, password) {
  return result(await supabase.auth.signInWithPassword({ email, password }));
}

export async function encerrarSessao(supabase) {
  return result(await supabase.auth.signOut());
}

export async function consultarUsuario(supabase) {
  return result(await supabase.auth.getUser()).user;
}

export async function consultarSessao(supabase) {
  return result(await supabase.auth.getSession()).session;
}

export function observarSessao(supabase, callback) {
  return supabase.auth.onAuthStateChange(callback);
}
