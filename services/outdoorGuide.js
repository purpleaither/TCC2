import {
  arredondarLocalizacao, carregarLimites, carregarRegioes, consultarParques
} from "./environmentalService.js";
import {desenharMapa} from "./parksMap.js";

export function criarGuiaAoArLivre(host, confirmarIndicacao) {
  let lifetime;
  let request;
  let selection;
  const root = document.getElementById("modeloGuiaArLivre").content.cloneNode(true);
  const section = root.firstElementChild;
  const locationStep = section.querySelector("[data-guia-local]");
  const resultStep = section.querySelector("[data-guia-resultado]");
  const region = locationStep.querySelector("select");
  const gps = locationStep.querySelector("button");
  const loading = section.querySelector(".guia-carregando");
  const status = section.querySelector("[data-guia-status]");
  const map = section.querySelector("[data-guia-mapa]");
  const parksStatus = section.querySelector("[data-guia-parques-status]");

  async function search(local, signal) {
    locationStep.hidden = true;
    resultStep.hidden = false;
    loading.hidden = false;
    resultStep.focus();
    status.textContent = "";
    const allowed = await confirmarIndicacao();
    if (signal.aborted) return;
    if (!allowed) {
      loading.hidden = true;
      status.textContent = "Não foi possível confirmar a indicação. Tente novamente.";
      return;
    }
    const [results, bounds] = await Promise.all([
      consultarParques(local, signal),
      carregarLimites(signal).catch(() => [])
    ]);
    if (signal.aborted) return;
    loading.hidden = true;
    if (results.length) desenharMapa(map, local, results, bounds, signal);
    else parksStatus.textContent = "Nenhum parque disponível para esta consulta.";

  }
  function start() {
    request?.abort();
    request = new AbortController();
    locationStep.hidden = false;
    resultStep.hidden = true;
    loading.hidden = true;
    map.hidden = true;
    parksStatus.textContent = "";
    status.textContent = "";
    return request.signal;
  }
  resultStep.querySelector("[data-guia-alterar]").addEventListener("click", () => {
    start();
    region.value = "";
    (region.disabled ? gps : region).focus();
  });
  region.addEventListener("change", () => {
    const signal = start();
    if (region.value) {
      const [latitude, longitude] = selection[region.value];
      void search(arredondarLocalizacao(latitude, longitude), signal);
    }
  });
  gps.addEventListener("click", () => {
    const signal = start();
    region.value = "";
    if (!navigator.geolocation) {
      status.textContent = "Localização indisponível. Escolha uma região do DF.";
      return;
    }
    status.textContent = "Autorize o acesso no aviso do navegador ou escolha uma região.";
    navigator.geolocation.getCurrentPosition(({coords}) => {
      if (!signal.aborted) void search(arredondarLocalizacao(coords.latitude, coords.longitude), signal);
    }, () => {
      if (!signal.aborted) status.textContent = "Não foi possível usar sua localização. Escolha uma região do DF.";
    }, {enableHighAccuracy: false, timeout: 8000, maximumAge: 0});
  });

  return {
    update(enabled) {
      if (!enabled) {
        request?.abort();
        lifetime?.abort();
        lifetime = null;
        section.remove();
        region.value = "";
        loading.hidden = true;
        status.textContent = "";
        return;
      }
      if (section.isConnected) return;
      start();
      host.append(section);
      lifetime = new AbortController();
      if (selection) return;
      const {signal} = lifetime;
      carregarRegioes(signal).then(regions => {
        if (signal.aborted) return;
        selection = regions;
        region.append(...Object.keys(regions).map(name => new Option(name, name)));
        region.disabled = false;
      }).catch(() => {
        if (!signal.aborted) status.textContent = "Lista de regiões indisponível. Você pode usar a localização aproximada.";
      });
    }
  };
}
