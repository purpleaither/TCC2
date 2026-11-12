export default function handler(req,res){
  if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({error:"Método não permitido"});}
  res.setHeader("Cache-Control","no-store");
  const url=process.env.SUPABASE_URL||"";
  const key=process.env.SUPABASE_PUBLISHABLE_KEY||"";
  if(!/^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/.test(url)||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)){
    return res.status(503).json({configured:false,error:"O banco de dados ainda não foi configurado."});
  }
  return res.status(200).json({configured:true,url:url.replace(/\/$/,""),publishableKey:key});
}
