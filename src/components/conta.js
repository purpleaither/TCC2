import { $, el, text } from '../utils/dom.js';

export function exibirMensagem(value, isError, autenticado) {
  text("loginStatus",value);
  const flash = $("authFlash");
  if(flash) {
    flash.hidden = !autenticado;
    flash.textContent = value;
    flash.style.background = isError ? "var(--fundo-alerta)" : "var(--superficie-verde)";
    flash.style.color = isError ? "var(--erro)" : "var(--titulo)";
  }
}
export function exibirMenu(perfil, profissional) {
  document.querySelectorAll("[data-perfil]").forEach(item=>{
    item.style.display = perfil && item.dataset.perfil === perfil.role ? "" : "none";
  });
  text("headerPerfilBtn",profissional ? "Profissional" : "Minha conta");
}
export function exibirSeletoresDePaciente(patients, patientId) {
  for (const select of document.querySelectorAll("[data-paciente]")) {
    select.replaceChildren();
    for(const patient of patients) {
      const option=el("option",patient.display_name);
      option.value=patient.id;
      select.append(option);
    }
    if(patientId)select.value=patientId;
    select.disabled=!patientId;
  }
  const submit=$("formPlanoProf")?.querySelector('button[type="submit"]');
  if(submit)submit.disabled=!patientId;
}
