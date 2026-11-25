import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { verificarBiblioteca } from './biblioteca.mjs';

const pasta = process.env.TCC_EVIDENCIAS ?? 'test-results/auditoria';
const base = process.env.TCC_BASE_URL ?? 'http://127.0.0.1:8765/';
const modo = process.env.TCC_SNAPSHOT;
const evidencias = modo ? 'lighthouse-autenticado-' + modo : 'axe-autenticado';
const configuracaoReal = 'https://tcc2-lime.vercel.app/api/database-config';
const casos = [];
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

async function auditar(pagina, perfil, tela, abrir) {
  const caso = { id: 'CT42-' + tela, perfil, tela };
  casos.push(caso);
  try {
    const inicio = performance.now();
    if (abrir) await abrir();
    await pagina.locator('#page-' + tela + '.active').waitFor({ state: 'visible', timeout: 8000 });
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
        }
      } else {
        await auditar(pagina, perfil.nome, 'registros-prof', () => navegar(pagina, 'registros-prof'));
        await auditar(pagina, perfil.nome, 'planos-prof', () => navegar(pagina, 'planos-prof'));
        await auditar(pagina, perfil.nome, 'editor-prof', () => pagina.locator('#page-planos-prof').getByRole('button', { name: 'Criar plano terapêutico' }).filter({ visible: true }).first().click({ timeout: 8000 }));
        await auditar(pagina, perfil.nome, 'exercise-config-prof', async () => {
          await pagina.getByRole('button', { name: '+ Adicionar exercícios', exact: true }).click({ timeout: 8000 });
          await pagina.getByRole('button', { name: 'Adicionar manualmente', exact: true }).click({ timeout: 8000 });
        });
        await auditar(pagina, perfil.nome, 'exercise-bank-prof', async () => {
          await navegar(pagina, 'planos-prof');
          await pagina.locator('#page-planos-prof').getByRole('button', { name: 'Criar plano terapêutico' }).filter({ visible: true }).first().click({ timeout: 8000 });
          await pagina.getByRole('button', { name: '+ Adicionar exercícios', exact: true }).click({ timeout: 8000 });
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
  await writeFile(pasta + '/' + evidencias + '.json', JSON.stringify(casos, null, 2));
}
if (casos.some(caso => caso.estado !== 'aprovado')) process.exitCode = 1;
