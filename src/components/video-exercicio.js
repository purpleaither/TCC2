import { el } from '../utils/dom.js';
import { consultarWger } from '../services/biblioteca.js';

export function criarExibicaoDeVideo(ebCall) {
  return async function loadExerciseMedia(id,target,button,source="ExerciseBank",autoPlay=false){
  if(button)button.disabled=true;
  target.replaceChildren(el("p","Carregando demonstração...","card-text-small"));
  try{
    let url,poster,credit;
    if(source==="wger"){
      const data = await consultarWger(id);
      url=data.item?.videos?.[0]?.url;credit="Fonte: wger";
    }else if(source==="ExerciseBank"){
      const data=await ebCall({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids:[id]})});
      const item=data.data?.[id];
      if(!item?.signed)throw Error("Este vídeo não está disponível no catálogo de demonstração.");
      url=item.mp4;poster=item.still;credit="ExerciseBank · link temporário";
    }
    if(!url)throw Error("Vídeo indisponível.");
    if(!target.isConnected)return;
    const video=el("video");
    video.controls=true;
    video.playsInline=true;
    video.preload=autoPlay?"auto":"metadata";
    video.loop=autoPlay;
    video.muted=autoPlay;
    video.autoplay=autoPlay;
    video.src=url;
    if(poster)video.poster=poster;
    target.replaceChildren(video);
    if(autoPlay){
      video.setAttribute("aria-label","Demonstração do exercício em reprodução contínua e sem áudio");
      video.play().catch(()=>{
        if(video.isConnected)target.append(el("p","Toque no vídeo para iniciar a demonstração.","card-text-small"));
      });
    }else{
      target.append(el("p",credit,"card-text-small"));
    }
  }catch(e){if(target.isConnected)target.replaceChildren(el("p",e.message,"card-text-small"));}
  finally{if(button)button.disabled=false;}
};
}
