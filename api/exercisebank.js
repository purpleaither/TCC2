import { createHash } from "node:crypto";

const API="https://exercisebank.net/v1";
const IDENTIFIER=/^[a-zA-Z0-9_-]{2,80}$/;
const LIMIT=50;
function respond(res,status,data){
  res.setHeader("Cache-Control","private, no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  return res.status(status).json(data);
}
async function request(url,headers,opts={}){
  const response=await fetch(url,{
    ...opts,
    headers:{Accept:"application/json",...headers,...opts.headers},
    signal:AbortSignal.timeout(11000)
  });
  const data=await response.json().catch(()=>null);
  return {ok:response.ok,status:response.status,data};
}
function safeError(response){
  if(response.status===401)return "Chave ExerciseBank inválida ou revogada.";
  if(response.status===429)return "Limite de requisições da ExerciseBank atingido.";
  return "Não foi possível consultar a ExerciseBank.";
}
async function authenticatedUser(req){
  const url=(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||"").trim().replace(/\/$/,"");
  const key=(process.env.SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||"").trim();
  const authorization=req.headers.authorization||"";
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)||!key||!/^Bearer \S+$/.test(authorization))return null;
  const headers={apikey:key,authorization};
  const user=await request(url+"/auth/v1/user",headers);
  if(!user.ok||!user.data?.id)return null;
  const p=await request(url+"/rest/v1/profiles?select=role&id=eq."+encodeURIComponent(user.data.id),headers);
  if(!p.ok||!Array.isArray(p.data)||p.data.length!==1)return null;
  const role=p.data[0].role;
  if(!["paciente","fisioterapeuta"].includes(role))return null;
  return {id:user.data.id,role,url,headers};
}
async function isAssigned(session,ids){
  const query="/rest/v1/care_plans?select=id,plan_exercises(external_id,exercise_source)&patient_id=eq."+encodeURIComponent(session.id);
  const response=await request(session.url+query,session.headers);
  if(!response.ok||!Array.isArray(response.data))return false;
  const assigned=new Set(response.data.flatMap(plan=>Array.isArray(plan.plan_exercises)?
    plan.plan_exercises.filter(x=>x.exercise_source==="ExerciseBank").map(x=>x.external_id):[]));
  return ids.every(id=>assigned.has(id));
}
function sampleIds(meta){
  const items=meta?.sample;
  return Array.isArray(items)?[...new Set(items.filter(id=>typeof id==="string"&&IDENTIFIER.test(id)))].slice(0,LIMIT):[];
}
function homeExercise(ex){
  if(!Array.isArray(ex.equipment))return false;
  const permitted=new Set(["bodyweight","mat","yoga-mat","exercise-mat","chair","resistance-band","elastic-band"]);
  return ex.equipment.every(item=>typeof item==="string"&&permitted.has(item.toLowerCase().trim()));
}
function normalize(ex){
  return {
    id:ex.id,
    name:ex.name||ex.variant||ex.id,
    description:String(ex.description||"").slice(0,500),
    equipment:Array.isArray(ex.equipment)?ex.equipment:[],
    difficulty:ex.difficulty??null,
    primaryMuscles:Array.isArray(ex.primaryMuscles)?ex.primaryMuscles:[],
    secondaryMuscles:Array.isArray(ex.secondaryMuscles)?ex.secondaryMuscles:[],
    movementPattern:ex.movementPattern||null,
    hasVideo:Boolean(ex.media?.mp4),
    home:homeExercise(ex)
  };
}
export default async function handler(req,res){
  res.setHeader("Allow","GET, POST");
  if(!["GET","POST"].includes(req.method))return respond(res,405,{error:"Método não permitido."});
  const apiKey=process.env.EXERCISEBANK_API_KEY||process.env.EB_KEY;
  if(!apiKey)return respond(res,503,{error:"Configure EXERCISEBANK_API_KEY na Vercel para consultar os 50 vídeos do Sandbox."});
  try{
    const session=await authenticatedUser(req);
    if(!session)return respond(res,401,{error:"Acesso autenticado necessário."});
    const ebHeaders={Authorization:"Bearer "+apiKey};
    const meta=await request(API+"/meta",ebHeaders);
    if(!meta.ok)return respond(res,meta.status===429?429:502,{error:safeError(meta)});
    const sample=sampleIds(meta.data);
    if(!sample.length)return respond(res,502,{error:"A ExerciseBank não retornou a lista de amostra do Sandbox."});

    if(req.method==="POST"&&req.body?.action==="audit"){
      if(session.role!=="fisioterapeuta")return respond(res,403,{error:"Auditoria disponível apenas para o fisioterapeuta."});
      const params=new URLSearchParams({ids:sample.join(","),limit:String(LIMIT)});
      const catalog=await request(API+"/exercises?"+params,ebHeaders);
      if(!catalog.ok)return respond(res,catalog.status===429?429:502,{error:safeError(catalog)});
      const catalogItems=Array.isArray(catalog.data?.data)?catalog.data.data:[];
      const catalogue=new Map(catalogItems.filter(ex=>sample.includes(ex.id)).map(ex=>[ex.id,normalize(ex)]));
      const viewer="tcc_"+createHash("sha256").update(session.id).digest("hex").slice(0,32);
      const media=await request(API+"/media/urls",ebHeaders,{
        method:"POST",
        headers:{"Content-Type":"application/json","X-End-User":viewer,"X-End-User-Role":"coach"},
        body:JSON.stringify({ids:sample,kinds:["mp4"],ttl:900})
      });
      if(!media.ok)return respond(res,media.status===429?429:502,{error:safeError(media)});
      const mediaMap=media.data?.data||{};
      const rows=sample.map(id=>{
        const ex=catalogue.get(id);
        const mediaItem=mediaMap[id];
        const videoAvailable=mediaItem?.signed===true&&typeof mediaItem.mp4==="string"&&/^https:\/\//.test(mediaItem.mp4);
        return {
          id,name:ex?.name||"Nome não retornado pelo catálogo",
          equipment:ex?.equipment||[],home:ex?.home===true,
          catalogHasVideo:ex?.hasVideo===true,
          videoStatus:videoAvailable?"liberado":mediaItem?.signed===false?"bloqueado":"sem_link"
        };
      });
      const totals={
        sample:sample.length,
        liberated:rows.filter(x=>x.videoStatus==="liberado").length,
        blocked:rows.filter(x=>x.videoStatus==="bloqueado").length,
        noLink:rows.filter(x=>x.videoStatus==="sem_link").length,
        homeWithVideo:rows.filter(x=>x.home&&x.videoStatus==="liberado").length
      };
      return respond(res,200,{rows,totals,method:"Verificação dos links temporários fornecidos pela ExerciseBank; não testa reprodução no navegador."});
    }

    if(req.method==="GET"){
      if(session.role!=="fisioterapeuta")return respond(res,403,{error:"A seleção de exercícios é exclusiva do fisioterapeuta."});
      const params=new URLSearchParams({ids:sample.join(","),limit:String(LIMIT)});
      const response=await request(API+"/exercises?"+params,ebHeaders);
      if(!response.ok)return respond(res,response.status===429?429:502,{error:safeError(response)});
      const candidates=Array.isArray(response.data?.data)?response.data.data:[];
      const allowed=new Set(sample);
      const all=candidates.filter(ex=>allowed.has(ex.id)&&ex.media?.mp4===true).map(normalize);
      const byId=new Map(all.map(ex=>[ex.id,ex]));
      const sorted=sample.filter(id=>byId.has(id)).map(id=>byId.get(id));
      return respond(res,200,{items:sorted,sampleCount:sample.length,matchedCount:sorted.length,homeCount:sorted.filter(ex=>ex.home).length});
    }

    const ids=req.body?.ids;
    if(!Array.isArray(ids)||ids.length<1||ids.length>12||ids.some(id=>typeof id!=="string"||!IDENTIFIER.test(id)))
      return respond(res,400,{error:"Informe de 1 a 12 IDs válidos."});
    if(ids.some(id=>!sample.includes(id)))return respond(res,403,{error:"Um ou mais vídeos não estão liberados no Sandbox."});
    if(session.role==="paciente"&&!(await isAssigned(session,ids)))
      return respond(res,403,{error:"Este vídeo não foi atribuído ao paciente."});
    const viewer="tcc_"+createHash("sha256").update(session.id).digest("hex").slice(0,32);
    const media=await request(API+"/media/urls",ebHeaders,{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "X-End-User":viewer,
        ...(session.role==="fisioterapeuta"?{"X-End-User-Role":"coach"}:{})
      },
      body:JSON.stringify({ids,kinds:["mp4","still"],ttl:900})
    });
    if(!media.ok)return respond(res,media.status===429?429:502,{error:safeError(media)});
    const result={};
    for(const id of ids){
      const mediaItem=media.data?.data?.[id]||{};
      result[id]={signed:mediaItem.signed===true,mp4:mediaItem.signed?mediaItem.mp4||null:null,still:mediaItem.signed?mediaItem.still||null:null};
    }
    return respond(res,200,{data:result});
  }catch(err){
    return respond(res,502,{error:"Falha temporária na conexão com a ExerciseBank."});
  }
}
