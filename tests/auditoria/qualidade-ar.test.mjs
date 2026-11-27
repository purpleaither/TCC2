import assert from "node:assert/strict";
import {test} from "node:test";
import handler from "../../api/air-quality.js";
import {coordenadasBrasilia, dicaAmbiente, resumoQualidadeAr} from "../../data/ambiente.js";

async function consultar(t, respostaExterna) {
  t.mock.method(globalThis, "fetch", async (url, opcoes) => {
    const consulta = new URL(url);
    assert.equal(consulta.origin, "https://air-quality-api.open-meteo.com");
    assert.equal(consulta.searchParams.get("latitude"), String(coordenadasBrasilia.latitude));
    assert.equal(consulta.searchParams.get("longitude"), String(coordenadasBrasilia.longitude));
    assert.equal(consulta.searchParams.get("current"), "pm2_5,pm10,ozone,carbon_dioxide");
    assert.ok(opcoes.signal);
    return respostaExterna();
  });
  const res = {
    setHeader() {},
    status(codigo) { this.codigo = codigo; return this; },
    json(corpo) { return {codigo:this.codigo, corpo}; }
  };
  return handler({method:"GET"}, res);
}

test("qualidade do ar conserva valores válidos, inclusive zero", async t => {
  const resultado = await consultar(t, () => Response.json({
    current_units:{pm2_5:"μg/m³",pm10:"μg/m³",ozone:"μg/m³",carbon_dioxide:"ppm"},
    current:{pm2_5:0,pm10:12,ozone:34,carbon_dioxide:451}
  }));
  assert.deepEqual(resultado, {codigo:200,corpo:{pm2_5:0,pm10:12,ozone:34,carbon_dioxide:451}});
  assert.match(resumoQualidadeAr(resultado.corpo), /PM₂,₅: 0 µg\/m³/);
  assert.match(resumoQualidadeAr(resultado.corpo), /CO₂: 451 ppm/);
});

test("HTTP 502 do provedor não gera valores ambientais", async t => {
  const resultado = await consultar(t, () => new Response(null,{status:502}));
  assert.equal(resultado.codigo, 502);
  assert.equal(resumoQualidadeAr(resultado.corpo), "");
});

test("dados com unidade incorreta não são usados", async t => {
  const resultado = await consultar(t, () => Response.json({
    current_units:{pm10:"ppm",pm2_5:"μg/m³"},current:{pm10:12,pm2_5:-2}
  }));
  assert.equal(resultado.codigo, 502);
});

test("orientação ambiental distingue tempo seco, calor ou partículas e lacunas", () => {
  assert.match(dicaAmbiente({weather_temperature:24,weather_humidity:29,pm2_5:14}), /dias secos/);
  assert.match(dicaAmbiente({weather_temperature:28,weather_humidity:40}), /local interno/);
  assert.match(dicaAmbiente({pm2_5:25}), /local interno/);
  assert.match(dicaAmbiente({weather_temperature:22,weather_humidity:40,pm2_5:10}), /condições amenas/);
  assert.match(dicaAmbiente({weather_temperature:22,weather_humidity:40}), /Observe seu conforto/);
});
