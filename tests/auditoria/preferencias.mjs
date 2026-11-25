import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const base = process.env.TCC_BASE_URL ?? 'http://127.0.0.1:8765/';
const pasta = process.env.TCC_EVIDENCIAS ?? 'test-results/auditoria';
await mkdir(pasta, { recursive: true });
const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const contexto = await navegador.newContext({ viewport: { width: 320, height: 760 }, colorScheme: 'light' });
const pagina = await contexto.newPage();
const casos = [];
const painel = pagina.locator('#painelAcessibilidade');
const abrir = pagina.locator('#abrirAcessibilidade');
const tema = pagina.getByLabel('Aparência');
const texto = pagina.getByLabel('Tamanho do texto');
const raiz = pagina.locator('html');

async function verificar(id, executar) {
  try {
    casos.push({ id, estado: 'aprovado', ...await executar() });
  } catch (erro) {
    casos.push({ id, estado: 'reprovado', motivo: erro.message.split('\n')[0] });
  }
}

try {
  await pagina.goto(base);
  await verificar('CT48-teclado', async () => {
    assert.equal(await abrir.innerText(), 'Abrir acessibilidade');
    await pagina.keyboard.press('Tab');
    assert.equal(await abrir.evaluate(el => el === document.activeElement), true);
    await pagina.keyboard.press('Enter');
    assert.equal(await painel.evaluate(el => el.open), true);
    assert.equal(await abrir.innerText(), 'Fechar acessibilidade');
    await pagina.keyboard.press('Tab');
    assert.equal(await texto.evaluate(el => el === document.activeElement), true);
    await pagina.keyboard.press('Escape');
    assert.equal(await painel.evaluate(el => el.open), false);
    assert.equal(await abrir.evaluate(el => el === document.activeElement), true);
    await pagina.keyboard.press('Space');
    assert.equal(await painel.evaluate(el => el.open), true);
  });
  if (!(await painel.evaluate(el => el.open))) await abrir.click();

  for (const escolha of ['claro', 'escuro', 'contraste']) {
    await verificar('CT49-' + escolha, async () => {
      if (escolha === 'contraste') await pagina.getByRole('checkbox', { name: 'Alto contraste' }).check();
      else await tema.selectOption(escolha);
      const resultado = await new AxeBuilder({ page: pagina })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']).analyze();
      await writeFile(pasta + '/axe-painel-' + escolha + '.json', JSON.stringify({
        versao: resultado.testEngine.version,
        violacoes: resultado.violations.map(v => ({ regra: v.id, elementos: v.nodes.map(n => n.target) })),
        inspecao: resultado.incomplete.map(v => v.id),
      }, null, 2));
      await pagina.screenshot({ path: pasta + '/painel-' + escolha + '.png', fullPage: true });
      assert.equal(resultado.violations.length, 0, 'Violações axe-core em ' + escolha);
    });
  }
  await pagina.getByRole('checkbox', { name: 'Maior espaçamento no texto' }).check();
  await pagina.getByRole('checkbox', { name: 'Reduzir animações' }).check();
  for (const tamanho of [100, 125, 150, 200]) {
    await verificar('CT50-' + tamanho, async () => {
      await texto.selectOption(String(tamanho));
      const medidas = await pagina.evaluate(() => {
        const elemento = document.querySelector('#loginEmail');
        const estilo = getComputedStyle(elemento);
        return { raiz: parseFloat(getComputedStyle(document.documentElement).fontSize),
          largura: document.querySelector('.app').scrollWidth, viewport: innerWidth,
          letra: parseFloat(estilo.letterSpacing), transicao: estilo.transitionDuration,
          campo: elemento.getBoundingClientRect().right };
      });
      assert.equal(medidas.raiz, 16 * tamanho / 100);
      assert.ok(medidas.letra > 0 && medidas.transicao === '0s');
      assert.ok(medidas.largura <= medidas.viewport && medidas.campo <= medidas.viewport);
      if (tamanho === 200) await pagina.screenshot({ path: pasta + '/painel-200.png', fullPage: true });
      return medidas;
    });
  }
  await verificar('CT51-recarregar-e-restaurar', async () => {
    await pagina.reload();
    await abrir.click();
    assert.equal(await texto.inputValue(), '200');
    assert.equal(await tema.inputValue(), 'escuro');
    for (const nome of ['contraste', 'espacamento', 'movimento']) assert.equal(await raiz.getAttribute('data-' + nome), '');
    await pagina.getByRole('button', { name: 'Restaurar configurações padrão' }).click();
    assert.equal(await texto.inputValue(), '100');
    assert.equal(await tema.inputValue(), 'sistema');
    await pagina.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await pagina.waitForFunction(() => getComputedStyle(document.documentElement).colorScheme === 'dark');
    await pagina.emulateMedia({ colorScheme: 'light' });
    await pagina.waitForFunction(() => getComputedStyle(document.documentElement).colorScheme === 'light');
    assert.equal(await pagina.locator('#loginEmail').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    for (const nome of ['contraste', 'espacamento', 'movimento']) assert.equal(await raiz.getAttribute('data-' + nome), null);
  });
} finally {
  await navegador.close();
  await writeFile(pasta + '/preferencias.json', JSON.stringify(casos, null, 2));
}
if (casos.some(caso => caso.estado !== 'aprovado')) process.exitCode = 1;
