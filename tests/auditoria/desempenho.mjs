import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const pasta = process.env.TCC_EVIDENCIAS;
const operacoes = [
  ['criar-plano', 'persistence', 'playwright-persistence', 'CT20-21', 'duracaoMs', 3000],
  ['editar-plano', 'persistence', 'playwright-persistence', 'CT29', 'duracaoMs', 6000],
  ['sintoma-clima', 'sintomas-clima', 'ci05-sintomas-clima', 'CT25', 'tempoRegistroMs', 3000],
  ['sintoma-falha', 'sintomas-clima', 'clima-falha-interface', 'CT44-persistencia', 'tempoRegistroMs', 3500, true],
  ['concluir-exercicio', 'treino-historico', 'ci06-treino-historico', 'CT27', 'duracaoMs', 3000],
  ['consultar-historico', 'treino-historico', 'ci06-treino-historico', 'CT28', 'duracaoMs', 3000],
];
const casos = operacoes.map(([nome,,,,,limite]) => ({ nome, limite, medicoes: [] }));
const navegador = await chromium.launch();
const versao = navegador.version();
await navegador.close();
for (let rodada = 1; rodada <= 3; rodada++) {
  const executados = new Set();
  for (const [indice, [, script, arquivo, id, campo,, falha]] of operacoes.entries()) {
    if (!executados.has(arquivo)) {
      await writeFile('test-results/' + arquivo + '.json', '{}');
      spawnSync(process.execPath, ['tests/playwright-' + script + '.cjs'], {
        env: { ...process.env, TCC_SERIE_DESEMPENHO: '1', TCC_CLIMA_FALHA: falha ? '1' : '0' },
        stdio: 'ignore', timeout: 120000,
      });
      executados.add(arquivo);
    }
    const bruto = JSON.parse(await readFile('test-results/' + arquivo + '.json', 'utf8'));
    const report = bruto.report ?? (Array.isArray(bruto) ? bruto : []);
    const caso = report.find(x => x.id === id && x.status === 'passed');
    const integracaoValida = indice !== 2 && indice !== 3 ||
      report.some(x => x.id === (falha ? 'CT44-falha-clima' : 'CT26') && x.status === 'passed');
    casos[indice].medicoes.push({ rodada, data: new Date().toISOString(), ms: integracaoValida ? caso?.[campo] ?? null : null });
  }
}
for (const c of casos) {
  const valores = c.medicoes.map(x => x.ms).filter(Number.isFinite).sort((a,b) => a-b);
  c.minimo = valores[0] ?? null;
  c.maximo = valores.at(-1) ?? null;
  c.mediana = valores.length ? (valores[Math.floor((valores.length-1)/2)] + valores[Math.floor(valores.length/2)]) / 2 : null;
  c.estado = valores.length < 3 ? 'bloqueado' : c.mediana <= c.limite ? 'aprovado' : 'reprovado';
}
await writeFile(pasta + '/desempenho-operacoes.json', JSON.stringify({
  commit: await readFile(pasta + '/commit.txt', 'utf8').then(x => x.trim()),
  navegador: versao, ambiente: 'Ubuntu 24.04, loopback e APIs reais', rede: 'Runner GitHub sem throttling',
  cache: 'Novo Chromium por script, cache padrão dentro da operação', casos,
}, null, 2));
if (casos.some(c => c.estado !== 'aprovado')) process.exitCode = 1;
