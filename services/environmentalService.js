const FORECAST = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY = "https://air-quality-api.open-meteo.com/v1/air-quality";
const OVERPASS = "https://overpass-api.de/api/interpreter";
const PEDESTRIAN = "https://routing.openstreetmap.de/routed-foot/";
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
  const consulta = `[out:json][timeout:7];(way["leisure"="park"]${raio};relation["leisure"="park"]${raio};)->.parks;.parks out body center;(node(w.parks)["entrance"];node(r.parks)["entrance"];);out body;`;
  const [oficiais, dinamicos] = await Promise.all([
    json(new URL("../data/parques_df.json", import.meta.url), {}, signal).catch(() => []),
    json(OVERPASS, {method: "POST", body: new URLSearchParams({data: consulta})}, signal)
      .then(({elements}) => {
        const entrances = new Map(elements.filter(({type, tags, lat, lon}) => type === "node" &&
          tags?.entrance && !["no","emergency","exit","service"].includes(tags.entrance) &&
          !["no","private"].includes(tags.access) && tags.foot !== "no" &&
          Number.isFinite(lat) && Number.isFinite(lon)
        ).map(node => [node.id, {latitude:node.lat, longitude:node.lon}]));
        return elements.filter(({tags, center}) => tags?.name && Number.isFinite(center?.lat) &&
          Number.isFinite(center?.lon)).map(({tags, center, nodes, members}) => {
          const ids = nodes ?? members?.filter(member => member.type === "node").map(member => member.ref) ?? [];
          const entrance = ids.map(id => entrances.get(id)).filter(Boolean)
            .sort((a, b) => distanciaKm(local, a) - distanciaKm(local, b))[0];
          return {nome:tags.name, latitude:center.lat, longitude:center.lon, entrada:entrance, fonte:"OpenStreetMap"};
        });
      })
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
      similar.entrada ??= parque.entrada;
    } else unicos.push({...parque, distancia: distanciaKm(local, parque)});
  }
  const candidatos = unicos.sort((a, b) => a.distancia - b.distancia).slice(0, 12);
  if (!signal?.aborted && candidatos.length) await atribuirDistanciasAPe({latitude, longitude}, candidatos, signal);
  return candidatos.sort((a, b) => (a.distanciaAPe ?? Infinity) - (b.distanciaAPe ?? Infinity) || a.distancia - b.distancia).slice(0, 5);
}

let ultimaRota = -Infinity;
const pertoDoPonto = point => Number.isFinite(point?.distance) && point.distance <= 150;

async function consultarRoteador(type, origem, parques, params, signal) {
  while (!signal?.aborted && performance.now() - ultimaRota < 1000) {
    await new Promise(resolve => setTimeout(resolve, 1000 - (performance.now() - ultimaRota)));
  }
  if (signal?.aborted) return null;
  ultimaRota = performance.now();
  const coords = [arredondarLocalizacao(origem.latitude, origem.longitude), ...parques.map(p => p.entrada ?? p)]
    .map(p => p.longitude + "," + p.latitude).join(";");
  return json(PEDESTRIAN + type + "/v1/driving/" + coords + "?" + new URLSearchParams(params),
    {referrerPolicy:"origin"}, signal).catch(() => null);
}

async function atribuirDistanciasAPe(origem, parques, signal) {
  const destinations = parques.map((_, index) => index + 1).join(";");
  const data = await consultarRoteador("table", origem, parques,
    {sources:"0", destinations, annotations:"distance", generate_hints:"false"}, signal);
  if (data?.code !== "Ok" || !pertoDoPonto(data.sources?.[0])) return;
  parques.forEach((parque, index) => {
    const metros = data.distances?.[0]?.[index];
    if (Number.isFinite(metros) && metros >= 0 && pertoDoPonto(data.destinations?.[index]))
      parque.distanciaAPe = metros;
  });
}

export async function consultarTrajeto(origem, parque, signal) {
  const data = await consultarRoteador("route", origem, [parque],
    {overview:"full", geometries:"geojson", alternatives:"3", steps:"false", generate_hints:"false"}, signal);
  if (data?.code !== "Ok" || data.waypoints?.length !== 2 || !data.waypoints.every(pertoDoPonto)) return null;
  const routes = Array.isArray(data.routes) ? data.routes : [];
  return routes.filter(route => Number.isFinite(route.distance) && route.distance >= 0 &&
    Number.isFinite(route.duration) && route.duration >= 0 && route.geometry?.coordinates?.length >= 2
  ).sort((a, b) => a.distance - b.distance || a.duration - b.duration)[0] ?? null;
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
