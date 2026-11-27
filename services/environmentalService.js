const FORECAST = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY = "https://air-quality-api.open-meteo.com/v1/air-quality";
const OVERPASS = "https://overpass-api.de/api/interpreter";
const PEDESTRIAN = "https://routing.openstreetmap.de/routed-foot/table/v1/driving/";
const CO2_REFERENCIA_EDUCATIVA = 500;

export function arredondarLocalizacao(latitude, longitude) {
  return {
    latitude: Math.round(latitude * 1000) / 1000,
    longitude: Math.round(longitude * 1000) / 1000
  };
}

async function json(url, options = {}, signal) {
  const timeout = AbortSignal.timeout(8000);
  const response = await fetch(url, {
    credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store",
    ...options, signal: signal ? AbortSignal.any([signal, timeout]) : timeout
  });
  if (!response.ok) throw Error("Serviço indisponível");
  return response.json();
}

export function carregarRegioes(signal) {
  return json(new URL("../data/regioes_df.json", import.meta.url), {}, signal);
}

export function carregarLimites(signal) {
  return json(new URL("../data/limites_df.json", import.meta.url), {}, signal);
}

export function distanciaKm(a, b) {
  const rad = graus => graus * Math.PI / 180;
  const lat = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2;
  const lon = Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, lat + lon *
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)))));
}

function nomeNormalizado(nome) {
  return nome.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
    .replace(/\b(parque|ecologico|urbano|distrital)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

export async function consultarParques(local, signal) {
  const {latitude, longitude} = arredondarLocalizacao(local.latitude, local.longitude);
  const raio = `(around:3000,${latitude},${longitude})`;
  const consulta = `[out:json][timeout:7];(way["leisure"="park"]${raio};relation["leisure"="park"]${raio};);out center tags;`;
  const [oficiais, dinamicos] = await Promise.all([
    json(new URL("../data/parques_df.json", import.meta.url), {}, signal).catch(() => []),
    json(OVERPASS, {method: "POST", body: new URLSearchParams({data: consulta})}, signal)
      .then(result => result.elements.map(({tags, center}) => ({
        nome: tags?.name, latitude: center?.lat, longitude: center?.lon,
        acessibilidade: tags?.wheelchair, piso: tags?.surface, iluminacao: tags?.lit, fonte: "OpenStreetMap"
      })).filter(p => p.nome?.trim() && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)))
      .catch(() => [])
  ]);
  const unicos = [];
  for (const parque of [...oficiais, ...dinamicos]) {
    const nome = nomeNormalizado(parque.nome);
    const similar = unicos.find(item => {
      const outro = nomeNormalizado(item.nome);
      return nome && outro && (nome === outro || nome.endsWith(" " + outro) || outro.endsWith(" " + nome)) &&
        distanciaKm(item, parque) < 2;
    });
    if (similar) {
      similar.acessibilidade ??= parque.acessibilidade;
      similar.piso ??= parque.piso;
      similar.iluminacao ??= parque.iluminacao;
    } else unicos.push({...parque, distancia: distanciaKm(local, parque)});
  }
  const candidatos = unicos.sort((a, b) => a.distancia - b.distancia).slice(0, 12);
  if (!signal?.aborted && candidatos.length) await atribuirDistanciasAPe({latitude, longitude}, candidatos, signal);
  return candidatos.sort((a, b) => (a.distanciaAPe ?? Infinity) - (b.distanciaAPe ?? Infinity) || a.distancia - b.distancia).slice(0, 5);
}

let ultimaRota = -Infinity;
async function atribuirDistanciasAPe(origem, parques, signal) {
  const espera = Math.max(0, 1000 - (performance.now() - ultimaRota));
  if (espera) await new Promise(resolve => setTimeout(resolve, espera));
  if (signal?.aborted) return;
  ultimaRota = performance.now();
  const coords = [origem, ...parques].map(p => p.longitude + "," + p.latitude).join(";");
  const destinations = parques.map((_, index) => index + 1).join(";");
  const params = new URLSearchParams({sources:"0", destinations, annotations:"distance", generate_hints:"false"});
  const data = await json(PEDESTRIAN + coords + "?" + params, {referrerPolicy:"origin"}, signal).catch(() => null);
  const pertoDoPonto = point => Number.isFinite(point?.distance) && point.distance <= 150;
  if (data?.code !== "Ok" || !pertoDoPonto(data.sources?.[0])) return;
  parques.forEach((parque, index) => {
    const metros = data.distances?.[0]?.[index];
    if (Number.isFinite(metros) && metros >= 0 && pertoDoPonto(data.destinations?.[index]))
      parque.distanciaAPe = metros;
  });
}

export async function consultarAmbiente(local, signal) {
  const aproximada = arredondarLocalizacao(local.latitude, local.longitude);
  const current = (url, fields) => json(url + "?" + new URLSearchParams({...aproximada, current: fields}), {}, signal)
    .then(data => data.current ?? {}).catch(() => ({}));
  const [clima, ar] = await Promise.all([
    current(FORECAST, "temperature_2m,relative_humidity_2m,surface_pressure,uv_index"),
    current(AIR_QUALITY, "carbon_dioxide,pm2_5,european_aqi")
  ]);
  return {...clima, ...ar};
}

export function gerarRecomendacoesClimaticas(dados = {}) {
  const {uv_index: uv, temperature_2m: temperatura, relative_humidity_2m: umidade,
    pm2_5: particulas, european_aqi: qualidade, carbon_dioxide: co2} = dados;
  const avisos = [
    "Beba água regularmente antes, durante e após a atividade ao ar livre.",
    "Use roupas leves e calçados adequados para a atividade."
  ];
  if (!Number.isFinite(uv) || uv >= 3)
    avisos.push("Use protetor solar e boné ou chapéu. Dê preferência a percursos com sombra.");
  if (!Number.isFinite(temperatura) || temperatura >= 28)
    avisos.push("Prefira horários amenos, como início da manhã ou fim da tarde. Em dias quentes, evite o período entre 10h e 16h e procure sombra.");
  if (Number.isFinite(umidade) && umidade <= 30)
    avisos.push("O tempo está seco. Reforce a hidratação e observe seu conforto ao respirar.");
  if (particulas >= 25 || qualidade >= 60 || co2 >= CO2_REFERENCIA_EDUCATIVA)
    avisos.push("Prefira áreas arborizadas e afastadas do tráfego intenso. Mantenha um ritmo confortável e anote eventuais sintomas respiratórios para conversar com seu fisioterapeuta.");
  return avisos;
}
