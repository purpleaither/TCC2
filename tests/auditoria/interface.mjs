import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const base = process.env.TCC_AUDITORIA_URL ?? 'http://127.0.0.1:8765/';
const pasta = process.env.TCC_EVIDENCIAS ?? 'test-results/auditoria';
await mkdir(pasta, { recursive: true });
const casos = [];
const navegador = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
});
const versao = navegador.version();

async function verificar(id, executar) {
  try {
    const detalhes = await executar();
    casos.push({ id, estado: 'aprovado', detalhes });
  } catch (erro) {
    casos.push({ id, estado: 'reprovado', motivo: erro.message });
  }
}

async function abrir(largura) {
  const contexto = await navegador.newContext({ viewport: { width: largura, height: 900 } });
  const pagina = await contexto.newPage();
  try {
    await pagina.goto(base);
    await pagina.locator('#page-login.active').waitFor({ state: 'visible' });
    await pagina.evaluate(() => document.fonts.ready.then(() => undefined));
    return pagina;
  } catch (erro) {
    await pagina.context().close();
    throw erro;
  }
}

try {
  await verificar('CT33', async () => {
    const pagina = await abrir(1440);
    try {
      const resultado = await new AxeBuilder({ page: pagina })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
        .analyze();
      const resumir = regras => regras.map(({ id, impact, description, helpUrl, tags, nodes }) => ({
        regra: id, gravidade: impact, descricao: description, referencia: helpUrl,
        criterios: tags.filter(tag => /^wcag\d{3,}$/.test(tag)),
        elementos: nodes.map(({ target, failureSummary }) => ({ seletor: target, diagnostico: failureSummary })),
      }));
      const evidencia = {
        pagina: 'login', perfil: 'sem autenticação', versao: resultado.testEngine.version,
        violacoes: resumir(resultado.violations), inspecao: resumir(resultado.incomplete),
        aprovadas: resultado.passes.map(regra => regra.id),
        naoAplicaveis: resultado.inapplicable.map(regra => regra.id),
      };
      await writeFile(pasta + '/axe-login.json', JSON.stringify(evidencia, null, 2));
      assert.equal(evidencia.violacoes.length, 0, 'Regras axe-core com violações');
      return { regrasAprovadas: evidencia.aprovadas.length };
    } finally {
      await pagina.context().close();
    }
  });

  await verificar('CT35', async () => {
    const pagina = await abrir(390);
    try {
      const email = pagina.locator('#loginEmail');
      const assinatura = () => email.evaluate(elemento => {
        const estilo = getComputedStyle(elemento);
        return [estilo.outlineStyle, estilo.outlineColor, estilo.outlineWidth, estilo.boxShadow, estilo.borderColor];
      });
      const semFoco = await assinatura();
      await pagina.keyboard.press('Tab');
      assert.equal(await pagina.locator(':focus').getAttribute('id'), 'abrirAcessibilidade');
      await pagina.keyboard.press('Tab');
      const primeiro = await pagina.locator(':focus').evaluate(el => ({ id: el.id, classe: el.className }));
      assert.equal(primeiro.id, 'loginEmail', JSON.stringify(primeiro));
      assert.notDeepEqual(await assinatura(), semFoco, 'O foco deve alterar o indicador visual');
      await pagina.screenshot({ path: pasta + '/login-foco.png' });
      await pagina.keyboard.press('Tab');
      assert.equal(await pagina.locator(':focus').getAttribute('id'), 'loginSenha');
      await pagina.keyboard.press('Shift+Tab');
      assert.equal(await pagina.locator(':focus').getAttribute('id'), 'loginEmail');
    } finally {
      await pagina.context().close();
    }
  });

  for (const largura of [320, 360, 390, 768, 1024, 1440]) {
    await verificar('CT36-' + largura, async () => {
      const pagina = await abrir(largura);
      try {
        await pagina.screenshot({ path: pasta + '/login-' + largura + '.png', fullPage: true });
        const medidas = await pagina.evaluate(() => ({
          viewport: document.documentElement.clientWidth,
          conteudo: document.documentElement.scrollWidth,
        }));
        assert.ok(medidas.conteudo <= medidas.viewport, 'Rolagem horizontal na largura ' + largura);
        return medidas;
      } finally {
        await pagina.context().close();
      }
    });
  }
} finally {
  await navegador.close();
  await writeFile(pasta + '/interface.json', JSON.stringify({ versao, casos }, null, 2));
}
if (casos.some(caso => caso.estado === 'reprovado')) process.exitCode = 1;
