import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('CT41, ausência de chaves privilegiadas reconhecíveis nos arquivos do frontend', async () => {
  const raiz = new URL('../../', import.meta.url);
  const arquivosRaiz = await readdir(raiz);
  const arquivosSrc = (await readdir(new URL('src/', raiz), { recursive: true }))
    .map(arquivo => 'src/' + arquivo);
  const arquivos = [...arquivosRaiz, ...arquivosSrc].filter(arquivo => /\.(html|js)$/.test(arquivo));
  assert.ok(arquivos.includes('index.html') && arquivos.includes('acesso.js'));
  const afetados = [];
  for (const arquivo of arquivos) {
    const fonte = await readFile(new URL(arquivo, raiz), 'utf8');
    const chavesJwt = fonte.matchAll(/\beyJ[\w-]+\.([\w-]+)\.[\w-]+\b/g);
    const privilegiada = Array.from(chavesJwt).some(([, carga]) => {
      try {
        return ['service_role', 'supabase_admin'].includes(JSON.parse(Buffer.from(carga, 'base64url')).role);
      } catch {
        return false;
      }
    });
    if (privilegiada || /\bsb_secret_[\w-]{16,}\b/.test(fonte)) afetados.push(arquivo);
  }
  assert.deepEqual(afetados, [], 'Arquivos com possível chave privilegiada');
});
