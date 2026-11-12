import { createHash } from "node:crypto";

const BASE = "https://exercisebank.net/v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXERCISE_ID = /^[a-zA-Z0-9_-]{2,80}$/;

function send(res,status,body) {
  res.setHeader("Cache-Control","no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  return res.status(status).json(body);
}

async function readJSON(url,headers,options={}) {
  const reply = await fetch(url,{
    ...options,
    headers:{Accept:"application/json",...headers,...options.headers},
    signal:AbortSignal.timeout(9000)
  });
  const body = await reply.json().catch(()=>null);
  return {status:reply.status,ok:reply.ok,data:body};
}

async function authenticate(req) {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/,"");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  const authorization = req.headers.authorization || "";
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || !key || !/^Bearer \S+$/.test(authorization)) return null;
  const headers = {apikey:key,authorization};
  const who = await readJSON(url+"/auth/v1/user",headers);
  if(!who.ok || !UUID.test(who.data?.id||""))return null;
  const profile = await readJSON(url+"/rest/v1/profiles?select=role&id=eq."+encodeURIComponent(who.data.id),headers);
  if(!profile.ok || !Array.isArray(profile.data) || profile.data.length!==1)return null;
  return {id:who.data.id,role:profile.data[0].role,url,headers};
}

async function patientExerciseIds(session) {
  const query="/rest/v1/care_plans?select=id,plan_exercises(external_id,exercise_source)&patient_id=eq."+session.id;
  const response=await readJSON(session.url+query,session.headers);
  if(!response.ok || !Array.isArray(response.data))return null;
  return new Set(response.data.flatMap(p=>(p.plan_exercises||[])
    .filter(x=>x.exercise_source==="ExerciseBank"&&EXERCISE_ID.test(x.external_id||""))
    .map(x=>x.external_id)));
}

export default async function handler(req,res) {
  res.setHeader("Allow","GET, POST");
  if(!["GET","POST"].includes(req.method))return send(res,405,{error:"Método não permitido."});
  const key=process.env.EXERCISEBANK_API_KEY || process.env.EB_KEY;
  if(!key)return send(res,503,{error:"A chave da ExerciseBank não está configurada na Vercel."});
  try{
    const session=await authenticate(req);
    if(!session)return send(res,401,{error:"Acesso não autenticado."});
    const upstreamHeaders={Authorization:"Bearer "+key};
    let endpoint=BASE+"/exercises";
    let options={method:"GET"};
    if(req.method==="GET"){
      if(session.role!=="fisioterapeuta")return send(res,403,{error:"A pesquisa é exclusiva do fisioterapeuta."});
      const q=String(req.query.q||"").trim().slice(0,90);
      const offset=Math.min(500,Math.max(0,Number.parseInt(req.query.offset,10)||0));
      const params=new URLSearchParams({limit:"12",offset:String(offset)});
      if(q)params.set("q",q);
      if(req.query.sample==="true"){
        endpoint=BASE+"/meta";
      }else{
        endpoint+="?"+params.toString();
      }
    }else{
      const ids=req.body?.ids;
      if(!Array.isArray(ids)||!ids.length||ids.length>12||!ids.every(id=>typeof id==="string"&&EXERCISE_ID.test(id)))
        return send(res,400,{error:"Selecione até 12 exercícios válidos."});
      if(!["paciente","fisioterapeuta"].includes(session.role))return send(res,403,{error:"Perfil sem permissão."});
      if(session.role==="paciente"){
        const assigned=await patientExerciseIds(session);
        if(!assigned)return send(res,502,{error:"Não foi possível verificar os exercícios atribuídos."});
        if(ids.some(id=>!assigned.has(id)))return send(res,403,{error:"O exercício não está atribuído a esta conta."});
      }
      endpoint=BASE+"/media/urls";
      const opaqueId="tcc_"+createHash("sha256").update(session.id).digest("hex").slice(0,32);
      options={
        method:"POST",
        headers:{"Content-Type":"application/json","X-End-User":opaqueId,...(session.role==="fisioterapeuta"?{"X-End-User-Role":"coach"}:{})},
        body:JSON.stringify({ids,kinds:["mp4","still"],ttl:900})
      };
    }
    const response=await readJSON(endpoint,upstreamHeaders,options);
    if(!response.ok){
      const details=response.data?.error;
      const safeMessage=response.status===429?"Limite de acesso da ExerciseBank atingido.":response.status===401?"Chave da ExerciseBank inválida ou revogada.":typeof details?.message==="string"&&response.status===400?details.message:"Não foi possível consultar a biblioteca ExerciseBank.";
      return send(res,[400,429].includes(response.status)?response.status:502,{error:safeMessage});
    }
    return send(res,200,response.data);
  }catch(error){
    return send(res,502,{error:"Não foi possível consultar a ExerciseBank neste momento."});
  }
}
