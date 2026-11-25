export async function consultarExerciseBank(supabase, opts={}){
  const session=await supabase.auth.getSession();
  const token=session.data?.session?.access_token;
  if(!token)throw Error("Sua sessão terminou. Entre novamente.");
  const response=await fetch("/api/exercisebank",{...opts,headers:{Authorization:"Bearer "+token,...opts.headers},cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||"ExerciseBank indisponível.");
  return data;
}

export async function consultarWger(id) {
  const resp=await fetch("/api/wger?id="+encodeURIComponent(id),{cache:"no-store"});
  const data=await resp.json();if(!resp.ok)throw Error(data.error||"Vídeo indisponível.");
  return data;
}
