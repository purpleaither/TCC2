import {arredondarLocalizacao, consultarTrajeto, distanciaKm} from "./environmentalService.js";

const point = ([longitude, latitude]) => ({latitude, longitude});

function prepareRoute(route) {
  const points = route.geometry.coordinates.map(point);
  let total = 0;
  const segments = points.slice(1).map((end, index) => {
    const start = points[index];
    const length = distanciaKm(start, end) * 1000;
    const segment = {start, end, length, offset:total};
    total += length;
    return segment;
  });
  let travel = 0;
  const steps = route.legs?.flatMap(leg => leg.steps ?? []).map(step => {
    const offset = travel;
    travel += step.distance;
    return {...step, offset};
  }) ?? [];
  return {segments, total, steps, destination:points.at(-1)};
}

function progressOnRoute(position, segments, previous) {
  const longitudeScale = Math.cos(position.latitude * Math.PI / 180);
  let best = {distance:Infinity, progress:previous};
  for (const {start, end, length, offset} of segments) {
    const x = (end.longitude - start.longitude) * longitudeScale;
    const y = end.latitude - start.latitude;
    const px = (position.longitude - start.longitude) * longitudeScale;
    const py = position.latitude - start.latitude;
    const factor = x || y ? Math.max(0, Math.min(1, (px*x + py*y) / (x*x + y*y))) : 0;
    const meters = distanciaKm(position, {
      latitude:start.latitude + factor*(end.latitude - start.latitude),
      longitude:start.longitude + factor*(end.longitude - start.longitude)
    })*1000;
    const progress = offset + factor*length;
    if (meters < best.distance && progress >= previous - 35) best = {distance:meters, progress};
  }
  return best;
}

const maneuverIcon = {
  left:"↰", right:"↱", "sharp left":"↰", "sharp right":"↱",
  "slight left":"↖", "slight right":"↗", uturn:"↶", straight:"↑"
};

function instructionFor(step) {
  const {type, modifier, exit} = step.maneuver ?? {};
  const directions = {
    left:"Vire à esquerda", right:"Vire à direita",
    "slight left":"Mantenha-se à esquerda", "slight right":"Mantenha-se à direita",
    "sharp left":"Vire acentuadamente à esquerda", "sharp right":"Vire acentuadamente à direita",
    uturn:"Faça o retorno", straight:"Siga em frente"
  };
  if (type === "arrive") return "Chegue ao destino";
  if (["roundabout", "rotary", "roundabout turn"].includes(type))
    return exit ? "Pegue a " + exit + "ª saída da rotatória" : "Siga pela rotatória";
  return directions[modifier] ?? "Siga pelo caminho indicado";
}

export function createWalkingNavigation(root, signal, park, update) {
  const button = root.querySelector("[data-trajeto-acao]");
  const status = root.querySelector("[data-trajeto-instrucao]");
  let watch;
  let controller;
  let route;
  let latest;
  let progress = 0;
  let outside = 0;
  let lastRequest = -Infinity;

  function report(message, icon = "") {
    status.dataset.icon = icon;
    if (status.textContent !== message)status.textContent = message;
  }
  function stop(message = "") {
    if (watch !== undefined)navigator.geolocation.clearWatch(watch);
    watch = undefined;
    controller?.abort();
    controller = undefined;
    route = latest = undefined;
    progress = outside = 0;
    button.textContent = "Iniciar trajeto";
    update();
    report(message);
  }
  async function reroute() {
    if (controller || !latest) return;
    lastRequest = performance.now();
    controller = new AbortController();
    const request = AbortSignal.any([signal, controller.signal]);
    report(route ? "Recalculando o trajeto…" : "Calculando trajeto a partir da sua posição…");
    const origin = arredondarLocalizacao(latest.latitude,latest.longitude);
    const result = await consultarTrajeto(origin, park(), request);
    if (request.aborted) return;
    controller = undefined;
    if (!result) {
      report("Não foi possível calcular o trajeto. O app tentará novamente se você continuar se movendo.");
      return;
    }
    progress = outside = 0;
    route = prepareRoute(result);
    update(latest,result,origin);
    follow();
  }
  function follow() {
    if (!latest || !route) return;
    const nearest = progressOnRoute(latest, route.segments, progress);
    if (nearest.distance > Math.max(50,latest.accuracy*1.5)) {
      outside++;
      if (outside >= 2 && performance.now() - lastRequest >= 15000)void reroute();
      else if (!controller)report("Você está fora do trajeto traçado.");
      return;
    }
    outside = 0;
    progress = Math.max(progress,nearest.progress);
    if (route.total - progress <= 18 && distanciaKm(latest,route.destination)*1000 <= 25) {
      stop("Você chegou ao ponto indicado.");
      return;
    }
    const step = route.steps.find(item => item.maneuver?.type !== "depart" && item.offset >= progress - 6);
    if (!step) { report("Siga pelo caminho traçado até o destino."); return; }
    const meters = Math.max(0,step.offset-progress);
    const distance = meters >= 1000 ? (Math.round(meters/100)/10).toLocaleString("pt-BR")+" km" : Math.ceil(meters/10)*10+" m";
    const {type,modifier} = step.maneuver ?? {};
    const icon = type === "arrive" ? "●" : type?.includes("roundabout") || type === "rotary" ? "⟳" : maneuverIcon[modifier] ?? "↑";
    report(instructionFor(step) + (meters < 12 ? " agora" : " em " + distance) + (step.name ? " · " + step.name : ""),icon);
  }
  button.onclick = () => {
    if (signal.aborted) return;
    if (watch !== undefined) { stop("Trajeto encerrado."); return; }
    if (!navigator.geolocation) { report("Localização indisponível neste aparelho."); return; }
    button.textContent = "Encerrar trajeto";
    report("Aguardando sua localização…");
    lastRequest = -Infinity;
    watch = navigator.geolocation.watchPosition(({coords}) => {
      if (signal.aborted || watch === undefined || document.hidden) return;
      if (!Number.isFinite(coords.accuracy) || coords.accuracy > 65) {
        report("Aguardando uma localização mais precisa…");
        return;
      }
      const moving = coords.speed == null || coords.speed >= .4;
      const heading = moving && Number.isFinite(coords.heading) ? coords.heading : null;
      latest = {latitude:coords.latitude,longitude:coords.longitude,accuracy:coords.accuracy,heading};
      update(latest);
      if (route)follow();
      else if (performance.now() - lastRequest >= 15000)void reroute();
    }, error => {
      if (watch === undefined || signal.aborted) return;
      if (error.code === 1)stop("Permita o uso da localização para iniciar o trajeto.");
      else report("Sinal de localização indisponível. Aguardando o GPS.");
    }, {enableHighAccuracy:true,maximumAge:0,timeout:12000});
  };
  const pause = () => {
    if (document.hidden && watch !== undefined)stop("Trajeto encerrado. Inicie novamente para continuar.");
  };
  document.addEventListener("visibilitychange",pause,{signal});
  signal.addEventListener("abort",() => stop(),{once:true});
  return {stop};
}
