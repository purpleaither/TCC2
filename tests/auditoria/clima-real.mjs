import assert from 'node:assert/strict';
import handler from '../../api/weather.js';

const resposta = {
  setHeader() {},
  status(codigo) { this.codigo = codigo; return this; },
  json(dados) { return { codigo: this.codigo, dados }; },
};

const { codigo, dados } = await handler({ method: 'GET', query:{cidade:'São Paulo',uf:'SP'} }, resposta);
if (codigo !== 200) {
  console.log(JSON.stringify({ id: 'CT40', estado: 'bloqueado', http: codigo, externo: dados.upstreamStatus }));
  process.exitCode = 1;
} else {
  assert.equal(dados.weather_city, 'São Paulo - SP');
  assert.ok(Number.isFinite(dados.weather_temperature));
  assert.ok(Number.isFinite(dados.weather_humidity) && dados.weather_humidity >= 0 && dados.weather_humidity <= 100);
  assert.ok(Number.isFinite(dados.weather_pressure) && dados.weather_pressure > 0);
  assert.ok(Number.isFinite(Date.parse(dados.weather_observed_at)));
  console.log(JSON.stringify({ id: 'CT40', estado: 'aprovado', fonte: 'Open-Meteo', dados }));
}
