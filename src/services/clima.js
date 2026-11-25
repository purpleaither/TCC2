async function consultarClimaBrasilia() {
  const response = await fetch("/api/weather", {
    signal: AbortSignal.timeout(12000),
    cache: "no-store"
  });
  if (!response.ok) throw Error("Serviço meteorológico indisponível");
  const clima = await response.json();
  if (!clima || ![clima.weather_temperature, clima.weather_humidity, clima.weather_pressure].every(Number.isFinite) ||
      clima.weather_city !== "Brasília" || !Number.isFinite(Date.parse(clima.weather_observed_at))) {
    throw Error("Dados meteorológicos inválidos");
  }
  return clima;
}

// Tenta novamente se o serviço meteorológico estiver temporariamente indisponível.
export async function obterClimaBrasilia() {
  try {
    return await consultarClimaBrasilia();
  } catch {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return consultarClimaBrasilia();
  }
}

export function isMissingWeatherColumns(error) {
  const code = error && error.code;
  return code === "42703" || code === "PGRST204";
}

export function mapWeather(registro) {
  if (registro.weather_temperature == null || registro.weather_humidity == null || registro.weather_pressure == null) return null;
  return {
    cidade:registro.weather_city || "Brasília",
    temperatura:registro.weather_temperature,
    umidade:registro.weather_humidity,
    pressao:registro.weather_pressure,
    observadoEm:registro.weather_observed_at || registro.recorded_at
  };
}
