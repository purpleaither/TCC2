import {arredondarLocalizacao, consultarTrajeto} from "./environmentalService.js";
import {createWalkingNavigation} from "./walkingNavigation.js";

const km = new Intl.NumberFormat("pt-BR", {maximumFractionDigits: 1});
const distanceLabel = park => {
  if (!Number.isFinite(park.distanciaAPe)) return "Distância a pé indisponível";
  if (park.distanciaAPe < 1000) return Math.round(park.distanciaAPe) + " m a pé";
  return km.format(park.distanciaAPe / 1000) + " km a pé";
};
export function desenharMapa(figure, local, parques, limites, signal, view) {
  const initial = !view;
  view ??= {zoom:null, selected:0, route:null, pending:true};
  const viewport = figure.querySelector(".guia-mapa-superficie");
  const frame = viewport.querySelector("[data-mapa-quadro]");
  const picker = figure.querySelector("#parqueSelecionado");
  const canvas = figure.querySelector("canvas");
  const layer = figure.querySelector("[data-mapa-marcadores]");
  const detail = figure.querySelector("[data-mapa-detalhe]");
  const ctx = canvas.getContext("2d");
  const {width, height} = canvas;
  const base = figure.querySelector("[data-mapa-ruas]");
  const mapStatus = figure.querySelector("[data-mapa-status]");
  const points = [view.routeOrigin ?? local, ...parques.map(park => park.entrada ?? park)];
  const world = ({latitude, longitude}) => {
    const radians = latitude * Math.PI / 180;
    return [(longitude + 180) / 360, (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2];
  };
  const mercator = points.map(world);
  const [horizontal, vertical] = [0, 1].map(axis => {
    const values = mercator.map(point => point[axis]);
    return [Math.min(...values), Math.max(...values)];
  });
  const tileSize = 256;
  const overview = Math.min(16, Math.max(0, Math.floor(Math.log2(Math.min(
    (width - 120) / Math.max(.000002, horizontal[1] - horizontal[0]),
    (height - 120) / Math.max(.000002, vertical[1] - vertical[0])
  ) / tileSize))));
  const zoom = view.zoom ?? overview;
  const zoomIn = figure.querySelector("[data-mapa-ampliar]");
  const zoomOut = figure.querySelector("[data-mapa-reduzir]");
  zoomIn.disabled = zoom >= 18;
  const minimumZoom = Math.max(0,overview - 2);
  zoomOut.disabled = zoom <= minimumZoom;
  function changeZoom(offset, anchor) {
    const next = Math.min(18, Math.max(minimumZoom, zoom + offset));
    if (next === zoom) return;
    if (anchor) {
      view.following = false;
      const box = viewport.getBoundingClientRect();
      const ratios = [(anchor.x - box.left) / box.width - .5, (anchor.y - box.top) / box.height - .5];
      view.center = center.map((value, axis) =>
        value + ratios[axis] * [width, height][axis] * (1 / scale - 1 / (tileSize * 2 ** next)));
    }
    view.zoom = next;
    redraw();
  }
  zoomIn.onclick = () => changeZoom(1);
  zoomOut.onclick = () => changeZoom(-1);
  const tileCount = 2 ** zoom;
  const scale = tileSize * tileCount;
  const center = view.center ?? (zoom <= overview
    ? [horizontal, vertical].map(([lower, upper]) => (lower + upper) / 2)
    : mercator[view.selected + 1]);
  const [west, north] = center.map((value, axis) => value * scale - [width, height][axis] / 2);
  const project = point => world(point).map((value, axis) => value * scale - [west, north][axis]);

  function redraw() {
    desenharMapa(figure, local, parques, limites, signal, view);
  }
  view.redraw = redraw;
  function pan(x, y) {
    view.following = false;
    view.zoom = zoom;
    view.center = center.map((value, axis) => Math.max(0, Math.min(1,
      value - [x, y][axis] / scale)));
    redraw();
  }
  const followButton = figure.querySelector("[data-trajeto-seguir]");
  followButton.hidden = !view.position || view.following;
  view.moveCamera = (position, centerNow = false) => {
    if (!view.following) return;
    const [x,y] = project(position);
    if (!centerNow && x > width*.28 && x < width*.72 && y > height*.28 && y < height*.72) return;
    const approximate = world(arredondarLocalizacao(position.latitude,position.longitude));
    if (!centerNow && view.center?.every((value,index) => value === approximate[index])) return;
    view.center = approximate;
    if (centerNow)view.zoom = Math.max(16,zoom);
    redraw();
  };
  followButton.onclick = () => {
    if (!view.position) return;
    view.following = true;
    view.moveCamera(view.position,true);
    viewport.focus({preventScroll:true});
  };
  if(initial)picker.replaceChildren(...parques.map((park, index) =>
    new Option((index + 1) + ". " + park.nome, String(index))));
  picker.onchange = () => {
    view.center = null;
    view.zoom = null;
    void selectPark(Number(picker.value), true);
  };

  const help = viewport.querySelector(".guia-mapa-ajuda");
  const helpButton = viewport.querySelector(".guia-mapa-duvida");
  if(initial) {
    help.hidden = false;
    helpButton.hidden = true;
    helpButton.setAttribute("aria-expanded", "false");
  }
  function hideHelp() {
    help.hidden = true;
    helpButton.hidden = false;
    helpButton.setAttribute("aria-expanded", "false");
  }
  helpButton.onclick = () => {
    help.hidden = !help.hidden;
    helpButton.setAttribute("aria-expanded", String(!help.hidden));
  };

  const pointers = new Map();
  let pinch;
  let lastTap;
  function pair() {
    const [a, b] = pointers.values();
    return {distance:Math.hypot(a.x - b.x, a.y - b.y), x:(a.x + b.x) / 2, y:(a.y + b.y) / 2};
  }
  viewport.onpointerdown = event => {
    if (!event.target.closest(".guia-mapa-duvida"))hideHelp();
    const control = event.target.closest("button, a");
    if (event.button !== 0 || (control && event.pointerType !== "touch") || pointers.size >= 2) return;
    pointers.set(event.pointerId, {x:event.clientX, y:event.clientY, startX:event.clientX, startY:event.clientY, control});
    if (!control)viewport.setPointerCapture(event.pointerId);
    if (pointers.size === 2) {
      for (const id of pointers.keys())viewport.setPointerCapture(id);
      pinch = pair();
      lastTap = null;
      const box = viewport.getBoundingClientRect();
      frame.style.transform = "";
      frame.style.transformOrigin = `${pinch.x - box.left}px ${pinch.y - box.top}px`;
    }
  };
  viewport.onpointermove = event => {
    const point = pointers.get(event.pointerId);
    if (!point) return;
    point.x = event.clientX;
    point.y = event.clientY;
    if (!pinch && point.control && Math.hypot(point.x - point.startX, point.y - point.startY) >= 4)
      viewport.setPointerCapture(event.pointerId);
    frame.style.transform = pinch
      ? `scale(${pair().distance / Math.max(1, pinch.distance)})`
      : `translate(${point.x - point.startX}px,${point.y - point.startY}px)`;
  };
  function clearGesture() {
    pointers.clear();
    pinch = null;
    frame.style.transform = "";
    frame.style.transformOrigin = "";
  }
  viewport.onpointerup = event => {
    const point = pointers.get(event.pointerId);
    if (!point) return;
    if (pinch) {
      const anchor = pinch;
      const ratio = pair().distance / Math.max(1, pinch.distance);
      clearGesture();
      if (ratio >= 1.18 || ratio <= .85)changeZoom(ratio > 1 ? 1 : -1, anchor);
      return;
    }
    clearGesture();
    const dx = event.clientX - point.startX;
    const dy = event.clientY - point.startY;
    if (Math.hypot(dx, dy) >= 4) {
      lastTap = null;
      const box = viewport.getBoundingClientRect();
      pan(dx * width / box.width, dy * height / box.height);
      return;
    }
    if (event.pointerType !== "touch" || point.control) return;
    const now = performance.now();
    if (lastTap && now - lastTap.time <= 350 && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) <= 25) {
      lastTap = null;
      changeZoom(1, {x:event.clientX, y:event.clientY});
    } else lastTap = {time:now, x:event.clientX, y:event.clientY};
  };
  viewport.onpointercancel = event => {
    if (pointers.has(event.pointerId))clearGesture();
  };
  viewport.onlostpointercapture = event => {
    if (event.target === viewport && pointers.has(event.pointerId))clearGesture();
  };
  viewport.onkeydown = event => {
    if (event.target !== viewport) return;
    const offset = {ArrowLeft:[80,0], ArrowRight:[-80,0], ArrowUp:[0,80], ArrowDown:[0,-80]}[event.key];
    if (!offset) return;
    event.preventDefault();
    pan(...offset);
  };

  layer.replaceChildren();
  const occupied = [];
  const buttons = [];
  const connectors = [];
  const candidates = [[0, 0], [0, -70], [0, 70], [90, 0], [-90, 0],
    [90, -70], [-90, -70], [90, 70], [-90, 70], [0, -140], [0, 140]];

  function updateDetails() {
    const {selected, route, pending} = view;
    const park = parques[selected];
    picker.value = String(selected);
    buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === selected)));
    const name = document.createElement("strong");
    name.textContent = park.nome;
    const distance = document.createElement("span");
    distance.className = "guia-mapa-distancia";
    distance.textContent = route
      ? distanceLabel({distanciaAPe:route.distance}) + " · cerca de " + Math.max(1, Math.round(route.duration / 60)) + " min"
      : pending ? "Calculando trajeto a pé…" : "Trajeto a pé indisponível";
    const meta = document.createElement("small");
    meta.textContent = [park.regiao, park.entrada ? "Entrada mapeada" : "Ponto aproximado do parque"].filter(Boolean).join(" · ");
    detail.replaceChildren(name, distance, meta);
  }

  async function selectPark(index, recenter = false) {
    view.navigation?.stop();
    view.controller?.abort();
    const controller = new AbortController();
    view.controller = controller;
    const selectionSignal = AbortSignal.any([signal, controller.signal]);
    view.selected = index;
    view.route = view.previewRoute = null;
    view.pending = true;
    if(recenter)redraw();
    view.updateDetails();
    view.repaint();
    const route = await consultarTrajeto(local, parques[index], selectionSignal);
    if (selectionSignal.aborted) return;
    view.pending = false;
    view.previewRoute = route;
    if (!view.position)view.route = route;
    view.updateDetails();
    view.repaint();
  }

  for (const [index, point] of points.entries()) {
    const [x, y] = project(point);
    if (x < 20 || x > width - 20 || y < 20 || y > height - 20) continue;
    const alternatives = candidates.map(([dx, dy]) => [
      Math.max(42, Math.min(width - 42, x + dx)),
      Math.max(34, Math.min(height - 34, y + dy))
    ]);
    const [left, top] = alternatives.find(([a, b]) =>
      occupied.every(([c, d]) => Math.hypot((a - c) / 88, (b - d) / 67) >= 1)
    ) ?? alternatives[0];
    occupied.push([left, top]);
    if (left !== x || top !== y) connectors.push([x, y, left, top]);
    const marker = document.createElement(index ? "button" : "span");
    marker.className = "guia-mapa-marcador";
    marker.style.left = left / width * 100 + "%";
    marker.style.top = top / height * 100 + "%";
    marker.textContent = index || "●";
    if (index) {
      const park = parques[index - 1];
      marker.type = "button";
      marker.setAttribute("aria-label", index + ". " + park.nome + ", " + distanceLabel(park));
      marker.addEventListener("click", () => { if (view.selected !== index - 1) void selectPark(index - 1); });
      buttons[index - 1] = marker;
    } else marker.setAttribute("aria-hidden", "true");
    layer.append(marker);
  }
  view.updateDetails = updateDetails;
  view.repaint = () => {
    ctx.clearRect(0, 0, width, height);
    if (base.hidden) drawBounds();
    const coordinates = view.route?.geometry.coordinates;
    if (coordinates?.length) {
      ctx.beginPath();
      for (const [index, [longitude, latitude]] of coordinates.entries()) {
        const point = project({longitude, latitude});
        if (index) ctx.lineTo(...point);
        else ctx.moveTo(...point);
      }
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.strokeStyle = "#0064a4";
      ctx.lineWidth = 6;
      ctx.stroke();
    }
    ctx.strokeStyle = "#315449";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [x, y, left, top] of connectors) {
      ctx.moveTo(x, y);
      ctx.lineTo(left, top);
    }
    ctx.stroke();
    if (view.position) {
      ctx.beginPath();
      const [x,y] = project(view.position);
      ctx.save();
      ctx.translate(x,y);
      if (Number.isFinite(view.position.heading)) {
        ctx.rotate(view.position.heading*Math.PI/180);
        ctx.moveTo(0,-14);
        ctx.lineTo(10,10);
        ctx.lineTo(0,6);
        ctx.lineTo(-10,10);
        ctx.closePath();
      } else ctx.arc(0,0,9,0,Math.PI*2);
      ctx.fillStyle = "#0064a4";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  };
  function drawBounds() {
    const colors = getComputedStyle(canvas);
    ctx.strokeStyle = colors.getPropertyValue("--mapa-contorno");
    ctx.fillStyle = colors.getPropertyValue("--mapa-regiao");
    ctx.lineWidth = 1.4;
    for (const polygon of limites) {
      ctx.beginPath();
      for (const [index, [longitude, latitude]] of polygon.entries()) {
        const point = project({longitude, latitude});
        if (index) ctx.lineTo(...point);
        else ctx.moveTo(...point);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  updateDetails();
  figure.hidden = false;
  const tiles = [];
  const pending = [];
  for (let row = Math.floor(north / tileSize); row <= Math.floor((north + height - 1) / tileSize); row++) {
    if (row < 0 || row >= tileCount) continue;
    for (let column = Math.floor(west / tileSize); column <= Math.floor((west + width - 1) / tileSize); column++) {
      const image = document.createElement("img");
      image.alt = "";
      image.referrerPolicy = "origin";
      image.style.left = (column * tileSize - west) / width * 100 + "%";
      image.style.top = (row * tileSize - north) / height * 100 + "%";
      image.style.width = tileSize / width * 100 + "%";
      image.style.height = tileSize / height * 100 + "%";
      const x = (column % tileCount + tileCount) % tileCount;
      image.src = `https://tile.openstreetmap.org/${zoom}/${x}/${row}.png`;
      pending.push(image.decode());
      tiles.push(image);
    }
  }
  const batch = document.createElement("div");
  batch.append(...tiles);
  base.replaceChildren(batch);
  base.hidden = true;
  view.repaint();
  if(initial){
    view.navigation = createWalkingNavigation(figure, signal, () => parques[view.selected], (position, route, origin) => {
      const starting = !!position && !view.position;
      const ended = !position && !!view.position;
      view.position = position;
      if (signal.aborted) return;
      if (route){
        view.route = route;
        view.routeOrigin = origin;
        view.updateDetails();
      }
      if(starting){
        view.following = true;
        view.moveCamera(position,true);
        viewport.scrollIntoView({block:"nearest"});
      } else if(ended){
        view.routeOrigin = null;
        view.route = view.previewRoute;
        view.following = false;
        view.zoom = view.center = null;
        view.redraw();
      } else if(position)view.moveCamera(position);
      view.repaint();
    });
    void selectPark(0);
  }
  mapStatus.textContent = "Carregando o mapa de ruas…";
  Promise.all(pending).then(() => {
    if (!batch.isConnected || figure.hidden) return;
    base.hidden = false;
    mapStatus.textContent = "";
    view.repaint();
  }).catch(() => {
    if (batch.isConnected && !figure.hidden)
      mapStatus.textContent = "Mapa de ruas indisponível. Os parques ainda aparecem na visualização simplificada.";
  });
}
