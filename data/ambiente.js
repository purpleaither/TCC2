export const coordenadasBrasilia = {latitude:-15.7801, longitude:-47.9292};
export const camposQualidadeAr = ["pm2_5", "pm10", "ozone"];

const rotulos = {pm2_5:"PM₂,₅", pm10:"PM₁₀", ozone:"Ozônio (O₃)"};

export function resumoQualidadeAr(registro) {
  return camposQualidadeAr.filter(campo => Number.isFinite(registro[campo]))
    .map(campo => rotulos[campo] + ": " + registro[campo].toLocaleString("pt-BR") + " µg/m³").join(" · ");
}

export function dicaAmbiente(registro) {
  const {weather_temperature:temperatura, weather_humidity:umidade, pm2_5:particulas} = registro;
  if (temperatura >= 28 || particulas >= 25)
    return "Se o plano permitir, um local interno ventilado e à sombra pode ser mais confortável. Combine com seu fisioterapeuta os horários mais frescos para atividades ao ar livre.";
  if (umidade != null && umidade < 30)
    return "Em dias secos, quando for confortável e estiver de acordo com a técnica orientada, respirar pelo nariz ajuda a umidificar o ar. Hidrate-se antes e depois conforme suas orientações de saúde.";
  if (temperatura != null && umidade != null && particulas != null)
    return "Aproveite as condições amenas para manter o movimento no seu ritmo, seguindo o plano combinado.";
  return "Observe seu conforto e siga o ritmo e as orientações combinadas com seu fisioterapeuta.";
}
