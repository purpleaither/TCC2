import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import banco from '../../api/database-config.js';
import clima from '../../api/weather.js';
import qualidadeAr from '../../api/air-quality.js';
import wger from '../../api/wger.js';
import biblioteca from '../../api/exercisebank.js';

const origem = 'https://tcc2-lime.vercel.app/api/database-config';
const resposta = await fetch(origem, { signal: AbortSignal.timeout(12000) });
if (!resposta.ok) throw Error('Configuração pública indisponível');
const config = await resposta.json();
if (!config.configured || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url) ||
    !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey)) {
  throw Error('Configuração pública inesperada');
}
process.env.SUPABASE_URL = config.url;
process.env.SUPABASE_PUBLISHABLE_KEY = config.publishableKey;

const { headers: [{ headers }] } = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'));
const rotas = new Map([
  ['/api/database-config', banco], ['/api/weather', clima], ['/api/air-quality', qualidadeAr], ['/api/exercisebank', biblioteca], ['/api/wger', wger],
]);
const tipos = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};
const raiz = resolve(process.cwd());

createServer(async (req, res) => {
  for (const { key, value } of headers) res.setHeader(key, value);
  try {
    const rota = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const handler = rotas.get(rota);
    if (handler) {
      req.query = Object.fromEntries(new URL(req.url, 'http://127.0.0.1').searchParams);
      res.status = status => { res.statusCode = status; return res; };
      res.json = dados => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(dados));
      };
      if (req.method === 'POST') {
        let texto = '';
        for await (const dados of req) {
          texto += dados;
          if (texto.length > 16384) return res.status(413).json({ error: 'Requisição muito grande' });
        }
        req.body = JSON.parse(texto);
      }
      await handler(req, res);
      return;
    }

    const arquivo = resolve(raiz, '.' + (rota === '/' ? '/index.html' : rota));
    const tipo = tipos[extname(arquivo)];
    if (!tipo || (extname(arquivo) === '.json' && !rota.startsWith('/data/')) || !arquivo.startsWith(raiz + sep) ||
        /^\/(?:\.|tests\/|database\/)/.test(rota) || !(await stat(arquivo)).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader('Content-Type', tipo);
    createReadStream(arquivo).pipe(res);
  } catch {
    if (!res.headersSent) res.writeHead(404);
    res.end();
  }
}).listen(8766, '127.0.0.1');
