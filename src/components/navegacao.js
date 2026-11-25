export function navegarNaInterface(page, { isAuthenticated, isProfessional, atualizarTela }) {
  if(!isAuthenticated()) page="login";
  else {
    if (page === "conta") page = isProfessional() ? "profissional" : "contatos";
    const allowed = isProfessional()
      ? ["profissional","planos-prof","exercise-target-prof","exercise-source-prof","exercise-bank-prof","exercise-config-prof","editor-prof","registros-prof"]
      : ["inicio","sintomas","historico","orientacoes","exercicios","contatos"];
    if(!allowed.includes(page)) page=isProfessional() ? "profissional" : "inicio";
  }
  document.querySelectorAll(".page").forEach(n=>n.classList.toggle("active",n.id==="page-"+page));
  mostrarCabecalho(page!=="login");
  document.querySelectorAll(".menu-item").forEach(item=>{
    const selected=item.getAttribute("onclick")==="navegarPara('"+(
      ["editor-prof","exercise-target-prof","exercise-source-prof","exercise-bank-prof","exercise-config-prof"].includes(page)?"planos-prof":page
    )+"')";
    item.classList.toggle("active",selected);
    if(selected)item.setAttribute("aria-current","page");
    else item.removeAttribute("aria-current");
  });
  fecharMenu();
  fecharClimaSheet();
  atualizarTela(page);
  window.scrollTo(0,0);
}
