const BASE="https://wger.de/api/v2/exerciseinfo/";
const MAX_PAGE=100;
function send(res,status,body){
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("Cache-Control","public, s-maxage=300, stale-while-revalidate=600");
  return res.status(status).json(body);
}
function mediaUrl(url){
  if(typeof url!=="string")return null;
  try{const u=new URL(url,"https://wger.de");return u.protocol==="https:"?u.href:null}catch{return null}
}
function translate(exercise){
  const translations=Array.isArray(exercise.translations)?exercise.translations:[];
  return translations.find(t=>t.language===2) || translations.find(t=>t.language===1) || translations.find(t=>typeof t.name==="string"&&t.name) || {};
}
function cleanText(value){
  return String(value||"").replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim();
}
function isHomeEquipment(items){
  if(!Array.isArray(items)||!items.length)return true;
  return items.every(e=>{
    const name=String(typeof e==="string"?e:e.name||"").toLowerCase();
    return /bodyweight|body weight|none|no equipment|mat|exercise mat|yoga mat|chair|resistance band|elastic band|sem equipamento|peso corporal|colchonete|cadeira|faixa elástica/.test(name);
  });
}
function normalize(ex){
  const t=translate(ex);
  const raw=Array.isArray(ex.videos)?ex.videos:[];
  const videos=raw.map(v=>({url:mediaUrl(v.video||v.url||v.file),license:v.license?.short_name||v.license?.full_name||v.license?.name||null,author:v.license_author||null}))
    .filter(v=>v.url);
  const equipment=Array.isArray(ex.equipment)?ex.equipment.map(e=>typeof e==="string"?e:e.name||"").filter(Boolean):[];
  return {id:String(ex.id),name:cleanText(t.name||ex.name||"Exercício"),description:cleanText(t.description||"").slice(0,500),equipment,videos,home:isHomeEquipment(ex.equipment)};
}
export default async function handler(req,res){
  if(req.method!=="GET"){res.setHeader("Allow","GET");return send(res,405,{error:"Método não permitido."})}
  const id=String(req.query.id||"").trim();
  if(id){
    if(!/^[0-9]{1,10}$/.test(id))return send(res,400,{error:"Identificador inválido."});
    try{
      const response=await fetch(BASE+id+"/?format=json",{headers:{Accept:"application/json"},signal:AbortSignal.timeout(10000)});
      if(!response.ok)return send(res,502,{error:"Não foi possível consultar o exercício."});
      const data=normalize(await response.json());
      return send(res,200,{item:data});
    }catch{return send(res,502,{error:"Não foi possível carregar o vídeo."})}
  }
  const q=String(req.query.q||"").trim().slice(0,80);
  const offset=Math.max(0,Math.min(900,Number.parseInt(req.query.offset,10)||0));
  const onlyHome=req.query.home!=="false";
  const params=new URLSearchParams({format:"json",limit:String(MAX_PAGE),offset:String(offset)});
  if(q)params.set("search",q);
  try{
    const reply=await fetch(BASE+"?"+params,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(10000)});
    if(!reply.ok)return send(res,502,{error:"A API pública da wger não respondeu à consulta."});
    const data=await reply.json();
    if(!Array.isArray(data.results))return send(res,502,{error:"Resposta inesperada da wger."});
    const items=data.results.map(normalize).filter(e=>e.videos.length>0 && (!onlyHome||e.home));
    return send(res,200,{items,nextOffset:data.next?offset+MAX_PAGE:null,scanned:data.results.length,count:data.count,query:q,home:onlyHome});
  }catch(e){return send(res,502,{error:"Não foi possível consultar a wger neste momento."})}
}
