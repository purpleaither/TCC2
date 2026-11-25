import assert from 'node:assert/strict';
import { test } from 'node:test';
import handler from '../../api/exercisebank.js';

// Todas as respostas deste arquivo pertencem a cenários simulados.
async function consultar(t, respostaExterna, corpo) {
  const ambiente = {
    SUPABASE_URL: 'https://auditoria-ficticia.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'chave-ficticia',
    EXERCISEBANK_API_KEY: 'chave-ficticia',
  };
  const anteriores = Object.fromEntries(Object.keys(ambiente).map(chave => [chave, process.env[chave]]));
  Object.assign(process.env, ambiente);
  t.after(() => {
    for (const [chave, valor] of Object.entries(anteriores)) {
      if (valor === undefined) delete process.env[chave];
      else process.env[chave] = valor;
    }
  });

  const destinos = [];
  t.mock.method(globalThis, 'fetch', async destino => {
    const url = new URL(destino);
    destinos.push(url.pathname);
    switch (url.pathname) {
      case '/auth/v1/user': return Response.json({ id: 'profissional-ficticio' });
      case '/rest/v1/profiles': return Response.json([{ role: 'fisioterapeuta' }]);
      case '/v1/meta': return Response.json({ sample: ['exemplo'] });
      default: return respostaExterna(url);
    }
  });
  const resposta = {
    setHeader() {},
    status(codigo) { this.codigo = codigo; return this; },
    json(dados) { return { codigo: this.codigo, dados }; },
  };
  const resultado = await handler({
    method: corpo ? 'POST' : 'GET',
    headers: { authorization: 'Bearer sessao-ficticia' },
    body: corpo,
  }, resposta);
  assert.deepEqual(destinos, ['/auth/v1/user', '/rest/v1/profiles', '/v1/meta',
    corpo ? '/v1/media/urls' : '/v1/exercises']);
  return resultado;
}

const falhas = [
  ['indisponivel', async () => new Response(null, { status: 503 }), 502],
  ['conexao', async () => { throw new TypeError('Falha de conexão simulada'); }, 502],
  ['timeout', async () => { throw new DOMException('Tempo limite simulado', 'TimeoutError'); }, 502],
  ['http-429', async () => new Response(null, { status: 429 }), 429],
  ['http-500', async () => new Response(null, { status: 500 }), 502],
  ['resposta-invalida', async () => new Response('{'), 502],
];

for (const [nome, resposta, esperado] of falhas) {
  test('CT39-' + nome, async t => {
    const { codigo, dados } = await consultar(t, resposta);
    assert.equal(codigo, esperado);
    assert.equal(typeof dados.error, 'string');
    assert.equal(dados.items, undefined);
  });
}

for (const [nome, itens] of [['lista-vazia', []], ['sem-video', [{ id: 'exemplo' }]]]) {
  test('CT39-' + nome, async t => {
    const { codigo, dados } = await consultar(t, async () => Response.json({ data: itens }));
    assert.equal(codigo, 200);
    assert.deepEqual(dados.items, []);
    assert.equal(dados.matchedCount, 0);
  });
}

test('CT39-video-indisponivel', async t => {
  const { codigo, dados } = await consultar(t, async () => new Response(null, { status: 503 }), { ids: ['exemplo'] });
  assert.equal(codigo, 502);
  assert.equal(typeof dados.error, 'string');
  assert.equal(dados.data, undefined);
});
