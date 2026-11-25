import assert from 'node:assert/strict';
import { test } from 'node:test';
import handler from '../../api/weather.js';

async function consultar(t, fetchSimulado) {
  const headers = {};
  t.mock.method(globalThis, 'fetch', fetchSimulado);
  const resposta = {
    setHeader(nome, valor) { headers[nome] = valor; },
    status(codigo) { this.codigo = codigo; return this; },
    json(corpo) { return { codigo: this.codigo, corpo }; },
  };
  const resultado = await handler({ method: 'GET' }, resposta);
  assert.equal(headers['Cache-Control'], 'no-store');
  assert.equal(fetch.mock.callCount(), 1);
  return resultado;
}

const cenarios = [
  ['conexao', async () => { throw new TypeError('Falha de conexão simulada'); }, 502],
  ['timeout', async () => { throw new DOMException('Tempo limite simulado', 'TimeoutError'); }, 504],
  ...[429, 500, 502, 504].map(codigo => ['http-' + codigo, async () => new Response(null, { status: codigo }), 502]),
  ['json-invalido', async () => new Response('{'), 502],
  ['parametros-ausentes', async () => Response.json({ current: { time: 1700000000 } }), 502],
];

for (const [nome, fetchSimulado, esperado] of cenarios) {
  test('CT38-' + nome + ' (falha simulada)', async t => {
    const { codigo, corpo } = await consultar(t, fetchSimulado);
    assert.equal(codigo, esperado);
    assert.equal(typeof corpo.error, 'string');
    assert.ok(Object.keys(corpo).every(campo => !campo.startsWith('weather_')));
  });
}
