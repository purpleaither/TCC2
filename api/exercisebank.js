/* Proxy da ExerciseBank para Vercel. A chave NUNCA é enviada ao navegador.
 * Configure EXERCISEBANK_API_KEY no painel da Vercel.
 * Somente metadados e URLs assinadas, sem dados reais de saúde.
 */
const BASE="https://exercisebank.net/v1";
function respond(res,status,body){res.setHeader("Cache-Control","no-store");res.setHeader("X-Content-Type-Options","nosniff");res.status(status).json(body)}
const safeId=id=>typeof id==="string"&&/^[a-zA-Z0-9_-]{2,80}$/.test(id);
export default async function handler(req,res){
  res.setHeader("Allow","GET, POST");
  if(req.method!=="GET"&&req.method!=="POST")return respond(res,405,{error:"Método não permitido"});
  const key=process.env.EXERCISEBANK_API_KEY;
  if(!key)return respond(res,503,{error:"A biblioteca ExerciseBank ainda não foi configurada neste ambiente."});
  try{
    let url=BASE+"/exercises",opts={method:"GET",headers:{Authorization:"Bearer "+key,Accept:"application/json"},signal:AbortSignal.timeout(9500)};
    if(req.method==="GET"){
      const q=String(req.query.q||"").trim().slice(0,90);
      const limit=Math.min(24,Math.max(1,Number.parseInt(req.query.limit,10)||12));
      const offset=Math.min(2000,Math.max(0,Number.parseInt(req.query.offset,10)||0));
      const params=new URLSearchParams({limit:String(limit),offset:String(offset)});
      if(q)params.set("q",q);
      url+="?"+params.toString();
    }else{
      let {ids,endUser,role}=req.body||{};
      if(!Array.isArray(ids)||ids.length<1||ids.length>12||!ids.every(safeId))return respond(res,400,{error:"Selecione de 1 a 12 exercícios válidos"});
      if(typeof endUser!=="string"||!/^[a-zA-Z0-9_-]{8,90}$/.test(endUser))return respond(res,400,{error:"Identificador demonstrativo inválido"});
      url=BASE+"/media/urls";
      opts={...opts,method:"POST",headers:{...opts.headers,"Content-Type":"application/json","X-End-User":endUser},body:JSON.stringify({ids,kinds:["mp4","still"],ttl:900})};
      if(role==="coach")opts.headers["X-End-User-Role"]="coach";
    }
    const upstream=await fetch(url,opts);
    const data=await upstream.json().catch(()=>null);
    if(!upstream.ok){
      const message=upstream.status===401?"Chave ExerciseBank inválida ou revogada.":upstream.status===429?"Limite de requisições ou de vídeos da licença atingido.":"O serviço ExerciseBank não respondeu como esperado.";
      return respond(res,upstream.status===401?503:upstream.status===429?429:502,{error:message});
    }
    return respond(res,200,data);
  }catch(e){
    return respond(res,502,{error:e.name==="TimeoutError"?"Tempo limite ao consultar ExerciseBank.":"Não foi possível consultar ExerciseBank."});
  }
}