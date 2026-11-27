import {
  arredondarLocalizacao, carregarLimites, carregarRegioes, consultarAmbiente, consultarParques, gerarRecomendacoesClimaticas
} from "./environmentalService.js";
import {desenharMapa} from "./parksMap.js";

const metrics = [
  ["temperature_2m", "Temperatura", "°C"],
  ["relative_humidity_2m", "Umidade relativa", "%"],
  ["surface_pressure", "Pressão na superfície", "hPa"],
  ["uv_index", "Índice UV", ""],
  ["carbon_dioxide", "CO₂", "ppm"],
  ["pm2_5", "Partículas finas (PM2,5)", "µg/m³"]
];
const number = new Intl.NumberFormat("pt-BR", {maximumFractionDigits: 1});

function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

export function criarGuiaAoArLivre(host, confirmarIndicacao) {
  let lifetime;
  let request;
  let selection;
  const root = document.getElementById("modeloGuiaArLivre").content.cloneNode(true);
  const section = root.firstElementChild;
  const region = section.querySelector("select");
  const gps = section.querySelector("button");
  const status = section.querySelector("[role=status]");
  const suggestions = section.querySelector("[data-guia-recomendacoes]");
  const measurements = section.querySelector("[data-guia-dados]");
  const environment = section.querySelector("[data-guia-ambiente]");
  const map = section.querySelector("[data-guia-mapa]");
  const parksStatus = section.querySelector("[data-guia-parques-status]");

  function showAdvice(data) {
    suggestions.replaceChildren(...gerarRecomendacoesClimaticas(data).map(text => element("li", text)));
  }
  function showEnvironment(data) {
    measurements.hidden = false;
    environment.replaceChildren(...metrics.flatMap(([key, label, unit]) => [
      element("dt", label),
      element("dd", Number.isFinite(data[key]) ? [number.format(data[key]), unit].filter(Boolean).join(" ") : "Indisponível")
    ]));
  }
  async function search(local, signal) {
    status.textContent = "Consultando condições ambientais e parques próximos…";
    const allowed = await confirmarIndicacao();
    if (signal.aborted) return;
    if (!allowed) {
      status.textContent = "Não foi possível confirmar a indicação. Tente novamente.";
      return;
    }
    const [data, results, bounds] = await Promise.all([
      consultarAmbiente(local, signal), consultarParques(local, signal),
      carregarLimites(signal).catch(() => [])
    ]);
    if (signal.aborted) return;
    showEnvironment(data);
    showAdvice(data);
    if (results.length) desenharMapa(map, local, results, bounds, signal);
    else parksStatus.textContent = "Nenhum parque disponível para esta consulta.";
    status.textContent = metrics.some(([key]) => Number.isFinite(data[key]))
      ? "Consulta concluída." : "Dados ambientais indisponíveis. Veja os cuidados ao ar livre.";
  }
  function start() {
    request?.abort();
    request = new AbortController();
    environment.replaceChildren();
    measurements.hidden = true;
    map.hidden = true;
    parksStatus.textContent = "";
    showAdvice();
    status.textContent = "";
    return request.signal;
  }
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
    status.textContent = "Aguardando permissão para acessar sua localização…";
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
