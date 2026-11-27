import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { verificarTeclado } from './teclado.mjs';
import { verificarBiblioteca } from './biblioteca.mjs';

const pasta = process.env.TCC_EVIDENCIAS ?? 'test-results/auditoria';
const base = process.env.TCC_BASE_URL ?? 'http://127.0.0.1:8765/';
const modo = process.env.TCC_SNAPSHOT;
const tema = process.env.TCC_TEMA;
const evidencias = (modo ? 'lighthouse-autenticado-' + modo : 'axe-autenticado') + (tema ? '-' + tema : '');
const configuracaoReal = 'https://tcc2-lime.vercel.app/api/database-config';
const casos = [];
const politica = [];
const regras = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];
let chrome;
let puppeteer;
let iniciarFluxo;
let configuracao;
if (modo) {
  const { launch } = await import('chrome-launcher');
  const { connect } = await import('puppeteer-core');
  ({ startFlow: iniciarFluxo } = await import('lighthouse'));
  if (modo === 'desktop') configuracao = (await import('lighthouse/core/config/desktop-config.js')).default;
  chrome = await launch({ chromePath: process.env.CHROME_PATH, chromeFlags: ['--headless', '--no-sandbox'] });
  puppeteer = await connect({ browserURL: 'http://127.0.0.1:' + chrome.port });
}
const navegador = modo ? await chromium.connectOverCDP('http://127.0.0.1:' + chrome.port)
  : await chromium.launch({ executablePath: process.env.CHROME_PATH });
await mkdir(pasta, { recursive: true });

const perfis = [
  { nome: 'paciente', credencial: 'PACIENTE', inicio: 'inicio' },
  { nome: 'fisioterapeuta', credencial: 'FISIO', inicio: 'profissional' },
];

async function auditar(pagina, perfil, tela, abrir, seletor = "#page-" + tela + ".active") {
  const caso = { id: 'CT42-' + tela, perfil, tela };
  casos.push(caso);
  try {
    const inicio = performance.now();
    if (abrir) await abrir();
    await pagina.locator(seletor).waitFor({ state: 'visible', timeout: 8000 });
    if (abrir) caso.tempoInterfaceMs = Math.round(performance.now() - inicio);
    if (modo) {
      const alvo = (await puppeteer.pages()).find(p => p.url() === pagina.url());
      if (!alvo) throw Error('Página autenticada não localizada');
      const fluxo = await iniciarFluxo(alvo, {
        config: configuracao, flags: { onlyCategories: ['accessibility'], logLevel: 'silent' },
      });
      await fluxo.snapshot({ stepName: tela });
      const { steps } = await fluxo.createFlowResult();
      const lhr = steps[0].lhr;
      if (lhr.runtimeError) throw Error(lhr.runtimeError.code);
      caso.versao = lhr.lighthouseVersion;
      caso.pontuacao = lhr.categories.accessibility.score;
      caso.auditorias = Object.fromEntries(lhr.categories.accessibility.auditRefs.map(({ id }) => {
        const { score, scoreDisplayMode } = lhr.audits[id];
        return [id, { pontuacao: score, estado: scoreDisplayMode }];
      }));
      caso.estado = caso.pontuacao === 1 ? 'aprovado' : 'reprovado';
      return;
    }
    const resultado = await new AxeBuilder({ page: pagina }).withTags(regras).analyze();
    caso.estado = resultado.violations.length ? 'reprovado' : 'aprovado';
    caso.versao = resultado.testEngine.version;
    caso.violacoes = resultado.violations.map(({ id, impact, helpUrl, tags, nodes }) => ({
      regra: id, gravidade: impact, referencia: helpUrl,
      criterios: tags.filter(tag => /^wcag\d{3,}$/.test(tag)),
      elementos: nodes.map(({ target }) => target.map(seletor => seletor.replace(/\[[^\]]+\]/g, '[atributo]'))),
    }));
    caso.inspecao = resultado.incomplete.map(regra => regra.id);
  } catch {
    caso.estado = 'bloqueado';
    caso.motivo = 'O estado esperado não ficou disponível ou o motor de auditoria não concluiu.';
  }
}

async function navegar(pagina, tela) {
  await pagina.locator('#menuBtn').click();
  await pagina.locator('#menuDrawer.open').locator(`[onclick="navegarPara('${tela}')"]`).click();
}

try {
  for (const perfil of perfis) {
    const contexto = await navegador.newContext({ viewport: modo === 'mobile' ? { width: 412, height: 823 } : { width: 1350, height: 940 } });
    const pagina = await contexto.newPage();
    if (!modo) {
      await pagina.exposeFunction('registrarPolitica', evento => politica.push({ perfil: perfil.nome, ...evento }));
      await pagina.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', evento => {
          let origem = 'inline ou recurso interno';
          try { origem = new URL(evento.blockedURI).origin; } catch {}
          window.registrarPolitica({ diretiva: evento.effectiveDirective, regime: evento.disposition, origem });
        });
      });
    }
    try {
      const email = process.env['TEST_' + perfil.credencial + '_EMAIL'];
      const senha = process.env['TEST_' + perfil.credencial + '_PASSWORD'];
      if (!email || !senha) throw Error('Conta fictícia indisponível');
      // A ponte usa a configuração pública da Vercel para autenticar no Supabase real.
      if (!process.env.TCC_BASE_URL) await contexto.route(base + 'api/database-config', async rota => {
        const resposta = await contexto.request.get(configuracaoReal, { timeout: 12000 });
        await rota.fulfill({ response: resposta });
      });
      await pagina.goto(base);
      if (tema) {
        await pagina.locator('#abrirAcessibilidade').click();
        await pagina.locator('#preferenciaTema').selectOption(tema);
        await pagina.locator('#abrirAcessibilidade').click();
      }
      await pagina.locator('#loginEmail').fill(email);
      await pagina.locator('#loginSenha').fill(senha);
      const inicioLogin = performance.now();
      await pagina.locator('#loginSubmit').click({ timeout: 25000 });
      await pagina.locator('#page-' + perfil.inicio + '.active').waitFor({ timeout: 25000 });
      const tempoLoginMs = Math.round(performance.now() - inicioLogin);
      await auditar(pagina, perfil.nome, perfil.inicio);
      casos.at(-1).tempoLoginMs = tempoLoginMs;
      if (perfil.nome === 'paciente') {
        for (const tela of ['sintomas', 'exercicios', 'historico', 'orientacoes', 'contatos']) {
          await auditar(pagina, perfil.nome, tela, () => navegar(pagina, tela));
          if (tela === 'sintomas') {
            const avancar = () => pagina.locator('#diarioProximo').click();
            await auditar(pagina, perfil.nome, 'sintomas-sensacoes', avancar, '#descricaoRigidez');
            await auditar(pagina, perfil.nome, 'sintomas-sinais', async () => {
              await pagina.locator('#rigidezOptions button').first().click();
              await pagina.locator('#fadigaOptions button').first().click();
              await pagina.locator('#humorOptions button').first().click();
              await pagina.locator('#atividadeOptions button').first().click();
              await avancar();
            }, '#diarioSinaisTitulo');
          }
        }
        if (!modo && process.env.TCC_BIBLIOTECA === '1') {
          try {
            casos.push({ id: 'CT47-teclado-escala', estado: 'aprovado', ...await verificarTeclado(pagina, pasta) });
          } catch {
            casos.push({ id: 'CT47-teclado-escala', estado: 'reprovado' });
          }
          try {
            await pagina.setViewportSize({ width: 320, height: 760 });
            await pagina.locator('#abrirAcessibilidade').click();
            await pagina.locator('#preferenciaTexto').selectOption('200');
            await pagina.getByRole('checkbox', { name: 'Maior espaçamento no texto' }).check();
            await pagina.locator('#abrirAcessibilidade').click();
            const diario = pagina.locator('#page-sintomas.active');
            await diario.locator('#diarioProximo').click();
            const rigidez = diario.locator('#descricaoRigidez');
            await rigidez.waitFor({ state: 'visible', timeout: 5000 });
            await diario.locator('#descricaoCansaco').waitFor({ state: 'visible', timeout: 5000 });
            const cabe = await pagina.evaluate(() => document.querySelector('.app').scrollWidth <= innerWidth);
            await rigidez.screenshot({ path: pasta + '/explicacao-rigidez.png' });
            casos.push({ id: 'CT53-ajuda-mobile', estado: cabe ? 'aprovado' : 'reprovado' });
          } catch {
            casos.push({ id: 'CT53-ajuda-mobile', estado: 'reprovado' });
          }
        }
      } else {
        await pagina.locator('#pacienteProf').selectOption({ index: 1 });
        await auditar(pagina, perfil.nome, 'registros-prof', () => navegar(pagina, 'registros-prof'));
        await auditar(pagina, perfil.nome, 'planos-prof', () => navegar(pagina, 'planos-prof'));
        await auditar(pagina, perfil.nome, 'editor-prof', () => pagina.locator('#page-planos-prof').locator('#createPlanEntry').click({ timeout: 8000 }));
        await auditar(pagina, perfil.nome, 'exercise-config-prof', async () => {
          await pagina.locator('#nomePlanoProf').fill('Plano fictício de auditoria');
          await pagina.locator('#avancarPlanoProf').click();
          if(await pagina.locator('#etapaCategoriaPlano').isVisible())await pagina.getByRole('button',{name:'Ortopédico',exact:true}).click();
          await pagina.getByRole('button', { name: 'Adicionar manualmente', exact: true }).click({ timeout: 8000 });
        }, '#exerciseConfigDialog[open]');
        await auditar(pagina, perfil.nome, 'exercise-bank-prof', async () => {
          await pagina.locator('#exerciseConfigDialog').getByRole('button', { name: 'Voltar' }).click();
          await navegar(pagina, 'planos-prof');
          await pagina.locator('#page-planos-prof').locator('#createPlanEntry').click({ timeout: 8000 });
          await pagina.locator('#nomePlanoProf').fill('Plano fictício de auditoria');
          await pagina.locator('#avancarPlanoProf').click();
          if(await pagina.locator('#etapaCategoriaPlano').isVisible())await pagina.getByRole('button',{name:'Ortopédico',exact:true}).click();
          await pagina.getByRole('button', { name: 'Escolher na ExerciseBank', exact: true }).click({ timeout: 8000 });
        });
        if (process.env.TCC_BIBLIOTECA === '1') await verificarBiblioteca(pagina, casos);
      }
    } catch {
      casos.push({ id: 'CT42-sessao-' + perfil.nome, perfil: perfil.nome, estado: 'bloqueado', motivo: 'Sessão fictícia indisponível.' });
    } finally {
      await contexto.close();
    }
  }
} finally {
  await navegador.close();
  if (puppeteer) puppeteer.disconnect();
  if (chrome) await chrome.kill();
  if (!modo) await writeFile(pasta + '/csp-navegador' + (tema ? '-' + tema : '') + '.json', JSON.stringify(politica, null, 2));
  await writeFile(pasta + '/' + evidencias + '.json', JSON.stringify(casos, null, 2));
}
if (casos.some(caso => caso.estado !== 'aprovado')) process.exitCode = 1;
