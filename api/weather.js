import {coordenadasBrasilia} from "../data/ambiente.js";

// Consulta apenas o clima de Brasília, sem receber dados do paciente.
const params = new URLSearchParams({...coordenadasBrasilia,
  current:"temperature_2m,relative_humidity_2m,surface_pressure", timeformat:"unixtime", timezone:"GMT"});
const endpoint = "https://api.open-meteo.com/v1/forecast?" + params;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Allow", "GET");
  if (req.method !== "GET") return res.status(405).json({error:"Método não permitido"});
  try {
    const response = await fetch(endpoint, {signal:AbortSignal.timeout(8000), headers:{Accept:"application/json"}});
    if (!response.ok) return res.status(502).json({error:"Serviço meteorológico indisponível", upstreamStatus:response.status});
    const {current} = await response.json();
    if (!current || ![current.temperature_2m,current.relative_humidity_2m,current.surface_pressure,current.time].every(Number.isFinite)) {
      return res.status(502).json({error:"Dados meteorológicos inválidos"});
    }
    return res.status(200).json({
      weather_city:"Brasília",
      weather_temperature:current.temperature_2m,
      weather_humidity:Math.round(current.relative_humidity_2m),
      weather_pressure:current.surface_pressure,
      weather_observed_at:new Date(current.time * 1000).toISOString()
    });
  } catch (erro) {
    return res.status(erro.name === "TimeoutError" || erro.name === "AbortError" ? 504 : 502).json({error:"Não foi possível consultar o clima"});
  }
}
