import assert from 'node:assert/strict';

export async function verificarBiblioteca(pagina, casos) {
  const busca = pagina.locator('#exercisebankRefresh');
  const status = pagina.locator('#exercisebankStatus');
  const itens = pagina.locator('#exercisebankResults .bank-result');
  const nomes = () => itens.locator('h4').allTextContents();
  const rota = '**/api/exercisebank';
  const simular = request => request.fulfill({ status: 503, json: { error: 'Biblioteca temporariamente indisponível' } });
  await pagina.route(rota, simular);
  try {
    await busca.click();
    await status.getByText('Biblioteca temporariamente indisponível', { exact: true }).waitFor();
    assert.equal(await itens.count(), 0);
    await pagina.locator('#page-exercise-bank-prof.active').getByRole('button', { name: 'Voltar' }).click();
    await pagina.getByRole('button', { name: 'Adicionar manualmente', exact: true }).click();
    await pagina.locator('#exerciseConfigRow [name=exercise]').waitFor();
    casos.push({ id: 'CT45-falha-biblioteca', estado: 'aprovado' });
  } catch {
    casos.push({ id: 'CT45-falha-biblioteca', estado: 'reprovado' });
  } finally {
    await pagina.unroute(rota, simular);
  }
  try {
    if (!(await pagina.locator('#page-exercise-bank-prof.active').count())) {
      const voltar = pagina.locator('#page-exercise-config-prof.active').getByRole('button', { name: 'Voltar' });
      await voltar.click({ timeout: 5000 });
      await pagina.getByRole('button', { name: 'Escolher na ExerciseBank', exact: true }).click();
    }
    const retorno = pagina.waitForResponse(r => new URL(r.url()).pathname === '/api/exercisebank' && r.request().method() === 'GET');
    const inicio = performance.now();
    await busca.click();
    const resposta = await retorno;
    const tempo = Math.round(performance.now() - inicio);
    if (!resposta.ok()) {
      casos.push({ id: 'CT46-catalogo-real', estado: 'bloqueado', http: resposta.status(), tempoRespostaMs: tempo });
      return;
    }
    const { items } = await resposta.json();
    await pagina.waitForFunction(() => !document.querySelector('#exercisebankRefresh').disabled);
    const domiciliares = await nomes();
    await pagina.locator('#exercisebankHomeOnly').uncheck();
    await busca.click();
    const todos = await nomes();
    assert.ok(todos.length > 0 && domiciliares.every(nome => todos.includes(nome)));

    const nomesDeReferencia = new Map([
      ['bodyweight squat', 'Agachamento com peso corporal'],
      ['squat', 'Agachamento'],
      ['front squat', 'Agachamento frontal'],
      ['goblet squat', 'Agachamento goblet'],
    ]);
    const equivalencias = items.map(item => nomesDeReferencia.get(item.name.toLowerCase())).filter(Boolean);
    assert.ok(equivalencias.every(nome => todos.includes(nome)));
    casos.push({ id: 'CT46-nomenclatura', estado: equivalencias.length ? 'aprovado' : 'bloqueado', totalReferencias: equivalencias.length });

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
    casos.push({ id: 'CT46-pesquisa-filtros', estado: 'aprovado', total: todos.length, domiciliares: domiciliares.length, ombros: ombros.length });
    await itens.first().getByRole('button', { name: 'Ver vídeo' }).click();
    await pagina.waitForFunction(() => {
      const video = document.querySelector('#exercisebankResults video');
      return video && !video.error && video.currentTime > 0.2;
    }, { timeout: 15000 });
    casos.push({ id: 'CT46-video', estado: 'aprovado' });
  } catch {
    casos.push({ id: 'CT46-fluxo-biblioteca', estado: 'reprovado' });
  }
}
