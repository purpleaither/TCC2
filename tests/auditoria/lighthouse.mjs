import { mkdir, writeFile } from 'node:fs/promises';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktop from 'lighthouse/core/config/desktop-config.js';

const base = process.env.TCC_AUDITORIA_URL ?? 'http://127.0.0.1:8765/';
const pasta = process.env.TCC_EVIDENCIAS ?? 'test-results/auditoria';
const chrome = await launch({
  chromePath: process.env.CHROME_PATH,
  chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'],
});
await mkdir(pasta, { recursive: true });

const indicadores = {
  fcp: ['first-contentful-paint', 1800],
  lcp: ['largest-contentful-paint', 2500],
  cls: ['cumulative-layout-shift', 0.1],
  tbt: ['total-blocking-time', 200],
  speedIndex: ['speed-index'],
  bytes: ['total-byte-weight'],
  requisicoes: ['network-requests'],
  carregamento: ['metrics'],
};
const perfis = [];

try {
  for (const perfil of ['mobile', 'desktop']) {
    const dados = { perfil, tentativas: [] };
    perfis.push(dados);
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      const prefixo = pasta + '/lighthouse-' + perfil + '-' + tentativa;
      try {
        const resultado = await lighthouse(base, {
          port: chrome.port,
          output: ['html', 'json'],
          onlyCategories: ['accessibility', 'performance'],
          logLevel: 'error',
          locale: 'pt-BR',
        }, perfil === 'desktop' ? desktop : undefined);
        const { lhr, report } = resultado;
        if (lhr.runtimeError) throw Error(lhr.runtimeError.code);
        await writeFile(prefixo + '.html', report[0]);
        await writeFile(prefixo + '.json', report[1]);
        const acessibilidade = Object.fromEntries(lhr.categories.accessibility.auditRefs.map(({ id }) => {
          const { score, scoreDisplayMode } = lhr.audits[id];
          return [id, { pontuacao: score, estado: scoreDisplayMode }];
        }));
        dados.tentativas.push({
          tentativa,
          versao: lhr.lighthouseVersion,
          navegador: lhr.environment.hostUserAgent,
          configuracao: lhr.configSettings,
          acessibilidade: lhr.categories.accessibility.score,
          auditorias: acessibilidade,
          metricas: Object.fromEntries(Object.entries(indicadores).map(([nome, [id]]) => {
            const auditoria = lhr.audits[id];
            const valor = nome === 'requisicoes' ? auditoria?.details?.items?.length
              : nome === 'carregamento' ? auditoria?.details?.items?.[0]?.observedLoad : auditoria?.numericValue;
            return [nome, Number.isFinite(valor) ? valor : null];
          })),
        });
      } catch (erro) {
        dados.tentativas.push({ tentativa, erro: erro.message });
      }
    }
    dados.estatisticas = Object.fromEntries(Object.entries(indicadores).map(([nome, [, meta]]) => {
      const valores = dados.tentativas.map(t => t.metricas?.[nome]).filter(Number.isFinite).sort((a, b) => a - b);
      const mediana = valores.length === 3 ? valores[1] : null;
      return [nome, { minimo: valores[0], mediana, maximo: valores.at(-1), meta }];
    }));
    const incompleto = dados.tentativas.some(t => t.erro);
    dados.CT34 = incompleto ? 'bloqueado' : dados.tentativas.every(t => t.acessibilidade === 1) ? 'aprovado' : 'reprovado';
    const metas = Object.values(dados.estatisticas).filter(i => i.meta !== undefined);
    dados.CT37 = incompleto || metas.some(i => i.mediana === null) ? 'bloqueado'
      : metas.every(i => i.mediana <= i.meta) ? 'aprovado' : 'reprovado';
  }
} finally {
  await chrome.kill();
  await writeFile(pasta + '/lighthouse-resumo.json', JSON.stringify(perfis, null, 2));
}
if (perfis.some(p => p.CT34 !== 'aprovado' || p.CT37 !== 'aprovado')) process.exitCode = 1;
