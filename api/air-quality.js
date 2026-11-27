import {coordenadasBrasilia, camposQualidadeAr} from "../data/ambiente.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Allow", "GET");
  if (req.method !== "GET") return res.status(405).json({error:"Método não permitido"});

  const params = new URLSearchParams({...coordenadasBrasilia, current:camposQualidadeAr.join(",")});
  try {
    const resposta = await fetch("https://air-quality-api.open-meteo.com/v1/air-quality?" + params, {
      signal:AbortSignal.timeout(8000), headers:{Accept:"application/json"}
    });
    if (!resposta.ok) return res.status(502).json({error:"Qualidade do ar indisponível"});
    const {current, current_units} = await resposta.json();
    const dados = Object.fromEntries(camposQualidadeAr
      .filter(campo => (campo==="carbon_dioxide" ? current_units?.[campo]==="ppm" : ["μg/m³", "µg/m³"].includes(current_units?.[campo])) && Number.isFinite(current?.[campo]) && current[campo] >= 0)
      .map(campo => [campo, current[campo]]));
    if (!Object.keys(dados).length) return res.status(502).json({error:"Dados de qualidade do ar indisponíveis"});
    return res.status(200).json(dados);
  } catch (erro) {
    return res.status(erro.name === "TimeoutError" || erro.name === "AbortError" ? 504 : 502)
      .json({error:"Qualidade do ar indisponível"});
  }
}
