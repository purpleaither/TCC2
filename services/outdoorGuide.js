import {
  arredondarLocalizacao, carregarRegioes, consultarAmbiente, consultarParques, gerarRecomendacoesClimaticas
} from "./environmentalService.js";

const metrics = [
  ["temperature_2m", "Temperatura", "°C"],
  ["relative_humidity_2m", "Umidade relativa", "%"],
  ["surface_pressure", "Pressão na superfície", "hPa"],
  ["uv_index", "Índice UV", ""],
  ["carbon_dioxide", "CO₂", "ppm"],
  ["pm2_5", "Partículas finas (PM2,5)", "µg/m³"],
  ["european_aqi", "Índice europeu de qualidade do ar", ""]
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
  const exercises = section.querySelector("[data-guia-exercicios]");
  const region = section.querySelector("select");
  const gps = section.querySelector("button");
  const status = section.querySelector("[role=status]");
  const suggestions = section.querySelector("[data-guia-recomendacoes]");
  const environment = section.querySelector("[data-guia-ambiente]");
  const parks = section.querySelector("[data-guia-parques]");

  function showAdvice(data) {
    suggestions.replaceChildren(...gerarRecomendacoesClimaticas(data).map(text => element("li", text)));
  }
  function showEnvironment(data) {
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
    const [data, results] = await Promise.all([consultarAmbiente(local, signal), consultarParques(local, signal)]);
    if (signal.aborted) return;
    showEnvironment(data);
    showAdvice(data);
    parks.replaceChildren(...results.map(park => {
      const item = element("li");
      const accessibility = {yes: "Acesso por cadeira de rodas informado", limited: "Acesso por cadeira de rodas limitado", no: "Sem acesso por cadeira de rodas informado"};
      const meta = [park.regiao, park.categoria, accessibility[park.acessibilidade],
        park.piso && "Tipo de piso no mapa: " + park.piso, park.fonte].filter(Boolean);
      item.append(element("strong", park.nome),
        element("p", number.format(park.distancia) + " km em linha reta · " + meta.join(" · ")));
      return item;
    }));
    status.textContent = metrics.some(([key]) => Number.isFinite(data[key]))
      ? "Consulta concluída." : "Dados ambientais indisponíveis. Consulte os cuidados gerais abaixo.";
    if (!results.length) parks.append(element("li", "Nenhum parque disponível para esta consulta."));
  }
  function start() {
    request?.abort();
    request = new AbortController();
    environment.replaceChildren();
    parks.replaceChildren();
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
    update(names) {
      if (!names.length) {
        request?.abort();
        lifetime?.abort();
        lifetime = null;
        section.remove();
        region.value = "";
        status.textContent = "";
        return;
      }
      exercises.replaceChildren(...[...new Set(names)].map(name => element("li", name)));
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
