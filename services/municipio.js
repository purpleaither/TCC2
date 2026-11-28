export const estados = Object.freeze({AC:"Acre",AL:"Alagoas",AP:"Amapá",AM:"Amazonas",BA:"Bahia",CE:"Ceará",DF:"Distrito Federal",ES:"Espírito Santo",GO:"Goiás",MA:"Maranhão",MT:"Mato Grosso",MS:"Mato Grosso do Sul",MG:"Minas Gerais",PA:"Pará",PB:"Paraíba",PR:"Paraná",PE:"Pernambuco",PI:"Piauí",RJ:"Rio de Janeiro",RN:"Rio Grande do Norte",RS:"Rio Grande do Sul",RO:"Rondônia",RR:"Roraima",SC:"Santa Catarina",SP:"São Paulo",SE:"Sergipe",TO:"Tocantins"});
const normalizar = v => v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
export async function localizarMunicipio(query={}) {
  const cidade=typeof query.cidade==="string"?query.cidade.trim():"";
  const uf=typeof query.uf==="string"?query.uf.toUpperCase():"";
  if(!/^[\p{L}][\p{L}\s.'’-]{1,79}$/u.test(cidade)||!Object.hasOwn(estados,uf))
    throw Object.assign(Error("Informe município e UF válidos"),{status:400});
  const params=new URLSearchParams({name:cidade,count:"100",language:"pt",format:"json",countryCode:"BR"});
  const resposta=await fetch("https://geocoding-api.open-meteo.com/v1/search?"+params,{signal:AbortSignal.timeout(5000)});
  if(!resposta.ok)throw Object.assign(Error("Busca indisponível"),{status:502});
  const dados=await resposta.json();
  const local=(dados.results||[]).find(x=>x.country_code==="BR"&&normalizar(x.name||"")===normalizar(cidade)&&normalizar(x.admin1||"")===normalizar(estados[uf])&&Number.isFinite(x.latitude)&&Number.isFinite(x.longitude));
  if(!local)throw Object.assign(Error("Município não encontrado na UF"),{status:404});
  return {cidade:local.name+" - "+uf,latitude:local.latitude,longitude:local.longitude};
}
