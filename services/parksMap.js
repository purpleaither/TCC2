const km = new Intl.NumberFormat("pt-BR", {maximumFractionDigits: 1});
const access = {
  yes: "Acesso por cadeira de rodas informado",
  limited: "Acesso por cadeira de rodas limitado",
  no: "Sem acesso por cadeira de rodas informado"
};

export function desenharMapa(figure, local, parques, limites) {
  const canvas = figure.querySelector("canvas");
  const layer = figure.querySelector("[data-mapa-marcadores]");
  const detail = figure.querySelector("[data-mapa-detalhe]");
  const ctx = canvas.getContext("2d");
  const {width, height} = canvas;
  const base = figure.querySelector("[data-mapa-ruas]");
  const mapStatus = figure.querySelector("[data-mapa-status]");
  const points = [local, ...parques];
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
  const zoom = Math.min(16, Math.max(0, Math.floor(Math.log2(Math.min(
    (width - 120) / Math.max(.000002, horizontal[1] - horizontal[0]),
    (height - 120) / Math.max(.000002, vertical[1] - vertical[0])
  ) / tileSize))));
  const tileCount = 2 ** zoom;
  const scale = tileSize * tileCount;
  const [west, north] = [horizontal, vertical].map(([lower, upper], axis) =>
    (lower + upper) / 2 * scale - [width, height][axis] / 2
  );
  const project = point => world(point).map((value, axis) => value * scale - [west, north][axis]);
  ctx.clearRect(0, 0, width, height);
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

  layer.replaceChildren();
  const occupied = [];
  const buttons = [];
  const connectors = [];
  const candidates = [[0, 0], [0, -70], [0, 70], [90, 0], [-90, 0],
    [90, -70], [-90, -70], [90, 70], [-90, 70], [0, -140], [0, 140]];

  function activate(index) {
    const park = parques[index];
    buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
    const name = document.createElement("strong");
    name.textContent = park.nome;
    const distance = document.createElement("span");
    distance.className = "guia-mapa-distancia";
    distance.textContent = km.format(park.distancia) + " km em linha reta";
    const meta = document.createElement("small");
    meta.textContent = [park.regiao, park.categoria, access[park.acessibilidade],
      park.piso && "Piso: " + park.piso, park.fonte].filter(Boolean).join(" · ");
    detail.replaceChildren(name, distance, meta);
  }

  for (const [index, point] of points.entries()) {
    const [x, y] = project(point);
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
      marker.setAttribute("aria-label", index + ". " + park.nome + ", " + km.format(park.distancia) + " km");
      marker.addEventListener("click", () => activate(index - 1));
      buttons.push(marker);
    } else marker.setAttribute("aria-hidden", "true");
    layer.append(marker);
  }
  function drawConnectors() {
    ctx.strokeStyle = "#315449";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for(const [x, y, left, top] of connectors) {
      ctx.moveTo(x, y);
      ctx.lineTo(left, top);
    }
    ctx.stroke();
  }
  drawConnectors();
  activate(0);
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
  mapStatus.textContent = "Carregando o mapa de ruas…";
  Promise.all(pending).then(() => {
    if (!batch.isConnected || figure.hidden) return;
    base.hidden = false;
    mapStatus.textContent = "";
    ctx.clearRect(0, 0, width, height);
    drawConnectors();
  }).catch(() => {
    if (batch.isConnected && !figure.hidden)
      mapStatus.textContent = "Mapa de ruas indisponível. Os parques ainda aparecem na visualização simplificada.";
  });
}
