export function date(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "Data indisponível" : d.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
}
export function localDateKey(value){
  const day=new Date(value);
  if(Number.isNaN(day.getTime()))return "";
  return [day.getFullYear(),String(day.getMonth()+1).padStart(2,"0"),String(day.getDate()).padStart(2,"0")].join("-");
}
export function monitoringWeeks(){
  const today = new Date();
  return [27, 20, 13, 6, -1].map(offset =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset));
}
