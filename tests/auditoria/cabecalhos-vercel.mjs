import { mkdir, writeFile } from 'node:fs/promises';

const pasta = process.env.TCC_EVIDENCIAS ?? 'test-results/candidata';
const enderecos = [
  ['produção', 'https://tcc2-lime.vercel.app/'],
  ['prévia', 'https://tcc2-git-verificacao-complementar-tcc-tcc-3.vercel.app/'],
];
const nomes = ['content-security-policy', 'content-security-policy-report-only', 'x-frame-options',
  'x-content-type-options', 'strict-transport-security', 'server', 'x-vercel-id'];
const observacoes = [];
for (const [ambiente, url] of enderecos) {
  for (const recurso of ['', 'style.css', 'app.js', 'acesso.js']) {
    try {
      const resposta = await fetch(new URL(recurso, url), { redirect: 'manual', signal: AbortSignal.timeout(10000) });
      await resposta.body?.cancel();
      observacoes.push({
        ambiente, recurso: recurso || '/', http: resposta.status,
        cabecalhos: Object.fromEntries(nomes.map(nome => [
          nome, nome === 'x-vercel-id' ? resposta.headers.has(nome) : resposta.headers.get(nome),
        ])),
        emitiuCookie: resposta.headers.has('set-cookie'),
      });
    } catch {
      observacoes.push({ ambiente, recurso: recurso || '/', estado: 'bloqueado' });
    }
  }
}
await mkdir(pasta, { recursive: true });
await writeFile(pasta + '/cabecalhos-vercel.json', JSON.stringify({ data: new Date().toISOString(), observacoes }, null, 2));
