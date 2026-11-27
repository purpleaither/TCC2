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
  const longitudeScale = Math.cos(local.latitude * Math.PI / 180);
  const relative = ({latitude, longitude}) => [
    (longitude - local.longitude) * longitudeScale, local.latitude - latitude
  ];
  const points = [local, ...parques].map(relative);
  const ranges = [0, 1].map(axis => points.map(point => point[axis]));
  const bounds = ranges.map(values => [Math.min(...values), Math.max(...values)]);
  const [horizontal, vertical] = bounds;
  const scale = Math.min(
    (width - 160) / Math.max(.009, horizontal[1] - horizontal[0]),
    (height - 128) / Math.max(.009, vertical[1] - vertical[0])
  );
  const project = point => relative(point).map((value, axis) =>
    (value - (bounds[axis][0] + bounds[axis][1]) / 2) * scale + [width, height][axis] / 2
  );
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "#5b766d";
  ctx.lineWidth = 1.4;
  for (const polygon of limites) {
    ctx.beginPath();
    for (const [index, [longitude, latitude]] of polygon.entries()) {
      const point = project({longitude, latitude});
      if (index) ctx.lineTo(...point);
      else ctx.moveTo(...point);
    }
    ctx.closePath();
    ctx.stroke();
  }

  layer.replaceChildren();
  const occupied = [];
  const buttons = [];
  const candidates = [[0, 0], [0, -70], [0, 70], [90, 0], [-90, 0],
    [90, -70], [-90, -70], [90, 70], [-90, 70], [0, -140], [0, 140]];

  function activate(index) {
    const park = parques[index];
    buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
    detail.textContent = [park.nome, km.format(park.distancia) + " km em linha reta",
      park.regiao, park.categoria, access[park.acessibilidade],
      park.piso && "Piso: " + park.piso, park.fonte].filter(Boolean).join(" · ");
  }

  for (const [index, point] of [local, ...parques].entries()) {
    const [x, y] = project(point);
    const alternatives = candidates.map(([dx, dy]) => [
      Math.max(42, Math.min(width - 42, x + dx)),
      Math.max(34, Math.min(height - 34, y + dy))
    ]);
    const [left, top] = alternatives.find(([a, b]) =>
      occupied.every(([c, d]) => Math.hypot((a - c) / 88, (b - d) / 67) >= 1)
    ) ?? alternatives[0];
    occupied.push([left, top]);
    if (left !== x || top !== y) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(left, top);
      ctx.stroke();
    }
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
  activate(0);
  figure.hidden = false;
}
