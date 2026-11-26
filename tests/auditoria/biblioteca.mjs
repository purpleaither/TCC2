import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

export async function verificarBiblioteca(pagina, casos) {
  const busca = pagina.locator('#exercisebankRefresh');
  const itens = pagina.locator('#exercisebankResults .bank-result');
  const nomes = () => itens.getByRole('heading').allTextContents();
  const rota = '**/api/exercisebank';
  const simular = request => request.fulfill({ status: 503, json: { error: 'Biblioteca temporariamente indisponível' } });
  await pagina.route(rota, simular);
  try {
    await busca.click();
    await pagina.waitForFunction(() => document.querySelector('#exercisebankStatus').textContent === 'Biblioteca temporariamente indisponível');
    assert.equal(await itens.count(), 0);
    await pagina.locator('#page-exercise-bank-prof.active').getByRole('button', { name: 'Voltar' }).click();
    await pagina.getByRole('button', { name: 'Adicionar manualmente', exact: true }).click();
    await pagina.locator('#exerciseConfigRow [name=customName]').waitFor();
    casos.push({ id: 'CT45-falha-biblioteca', estado: 'aprovado' });
  } catch {
    casos.push({ id: 'CT45-falha-biblioteca', estado: 'reprovado' });
  } finally {
    await pagina.unroute(rota, simular);
  }
  let ponte;
  let origem = 'candidata';
  try {
    if (!(await pagina.locator('#page-exercise-bank-prof.active').count())) {
      const voltar = pagina.locator('#exerciseConfigDialog[open]').getByRole('button', { name: 'Voltar' });
      await voltar.click({ timeout: 5000 });
      await pagina.getByRole('button', { name: 'Escolher na ExerciseBank', exact: true }).click();
    }
    const consultar = async () => {
      const retorno = pagina.waitForResponse(r => new URL(r.url()).pathname === '/api/exercisebank' && r.request().method() === 'GET');
      const inicio = performance.now();
      await busca.click();
      const resposta = await retorno;
      casos.push({ id: 'CT46-catalogo-real', origem, estado: resposta.ok() ? 'aprovado' : 'bloqueado',
        http: resposta.status(), tempoRespostaMs: Math.round(performance.now() - inicio) });
      await pagina.waitForFunction(() => !document.querySelector('#exercisebankRefresh').disabled);
      return resposta;
    };
    let resposta = await consultar();
    if (resposta.status() === 503 && process.env.TCC_BIBLIOTECA_PUBLICADA === '1') {
      origem = 'frontend candidato com rota publicada';
      // A chamada continua usando a conta fictícia e o serviço real da própria aplicação.
      ponte = async interceptacao => {
        try {
          const respostaReal = await interceptacao.fetch({
            url: 'https://tcc2-lime.vercel.app/api/exercisebank',
            maxRedirects: 0, timeout: 15000,
          });
          await interceptacao.fulfill({ response: respostaReal });
        } catch {
          await interceptacao.abort();
        }
      };
      await pagina.route(rota, ponte);
      resposta = await consultar();
    }
    if (!resposta.ok()) return;
    const { items } = await resposta.json();
    await pagina.waitForFunction(() => !document.querySelector('#exercisebankRefresh').disabled);
    const domiciliares = await nomes();
    await pagina.locator('#exercisebankHomeOnly').uncheck();
    await busca.click();
    const todos = await nomes();
    assert.ok(todos.length > 0 && domiciliares.every(nome => todos.includes(nome)));

    const fonte = await readFile(new URL('../../acesso.js', import.meta.url), 'utf8');
    const glossario = JSON.parse(fonte.match(/const EXERCISE_NAMES_PT=(\{[\s\S]*?\n\});/)[1]);
    const normalizar = nome => nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/&/g, ' and ').replace(/[-_/]+/g, ' ')
      .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const referencia = new Map(Object.entries(glossario).map(([nome, traducao]) => [normalizar(nome), traducao]));
    const amostra = items.map(({ id, name }) => {
      const traducao = referencia.get(normalizar(name)) ?? null;
      return { identificador: id, original: name, traducao, situacao: traducao ? 'Conferência terminológica pendente' : 'Sem equivalência cadastrada' };
    });
    const pasta = process.env.TCC_EVIDENCIAS ?? 'test-results/auditoria';
    await mkdir(pasta, { recursive: true });
    await writeFile(pasta + '/nomenclaturas.json', JSON.stringify({ origem, amostra }, null, 2));
    const esperado = amostra.filter(item => item.traducao).map(item => item.traducao);
    assert.deepEqual(todos.slice().sort(), esperado.slice().sort());
    casos.push({ id: 'CT46-nomenclatura', origem, estado: 'aprovado', escopo: 'Consistência com o glossário cadastrado', totalReferencias: esperado.length });

    await pagina.locator('#exercisebankRegion').selectOption('ombros');
    await busca.click();
    const ombros = await nomes();
    assert.ok(ombros.every(nome => todos.includes(nome)));
    await pagina.locator('#exercisebankRegion').selectOption('todas');
    await pagina.locator('#exercisebankQuery').fill('termo inexistente zzct46');
    await busca.click();
    assert.equal(await itens.count(), 0);
    await pagina.locator('#exercisebankQuery').fill(todos[0]);
    await busca.click();
    await itens.getByRole('heading', { name: todos[0], exact: true }).first().waitFor();
    casos.push({ id: 'CT46-pesquisa-filtros', origem, estado: 'aprovado', total: todos.length, domiciliares: domiciliares.length, ombros: ombros.length });
    await itens.first().getByRole('button', { name: 'Ver vídeo' }).click();
    await pagina.waitForFunction(() => {
      const video = document.querySelector('#exercisebankResults video');
      return video && !video.error && video.currentTime > 0.2;
    }, undefined, { timeout: 15000 });
    casos.push({ id: 'CT46-video', origem, estado: 'aprovado' });
  } catch {
    casos.push({ id: 'CT46-fluxo-biblioteca', origem, estado: 'reprovado' });
  } finally {
    if (ponte) await pagina.unroute(rota, ponte);
  }
}
