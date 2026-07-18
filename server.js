import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.riv': 'application/octet-stream',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.map': 'application/json',
};

// Sem Cache-Control, o navegador cacheia módulos ES e um reload normal
// pode servir JS antigo sem erro visível.
const BASE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  // App 100% client-side + static — reforça a política no browser.
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'no-referrer',
};

/**
 * Resolve o path do request de forma segura dentro de ROOT.
 * Estratégia: NUNCA confiar em path.normalize com `..` (no Windows
 * `/../../etc/passwd` vira `\etc\passwd` e cai DENTRO da raiz).
 * Em vez disso, quebra em segmentos e rejeita qualquer `.` / `..` / null byte.
 * @returns {string|null} absolute path ou null se inválido
 */
function resolveSafePath(requestUrl) {
  if (typeof requestUrl !== 'string' || !requestUrl) return null;
  if (requestUrl.includes('\0')) return null;

  let pathname;
  try {
    pathname = new URL(requestUrl, 'http://localhost').pathname;
  } catch {
    return null;
  }

  if (pathname === '/' || pathname === '') {
    return path.join(ROOT, 'index.html');
  }

  const segments = [];
  for (const raw of pathname.split('/')) {
    if (!raw) continue;
    let seg;
    try {
      seg = decodeURIComponent(raw);
    } catch {
      return null;
    }
    if (seg.includes('\0')) return null;
    if (seg === '.' || seg === '..') return null;
    // Rejeita segmentos com separador de path embutido (Windows `\`)
    if (seg.includes('/') || seg.includes('\\')) return null;
    segments.push(seg);
  }

  if (segments.length === 0) return path.join(ROOT, 'index.html');

  const full = path.resolve(ROOT, ...segments);
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (full !== ROOT && !full.startsWith(rootWithSep)) return null;

  return full;
}

const server = http.createServer((req, res) => {
  // Só leitura estática — nada de POST/PUT com body
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...BASE_HEADERS, Allow: 'GET, HEAD' });
    res.end('Method Not Allowed');
    return;
  }

  const filePath = resolveSafePath(req.url || '/');
  if (!filePath) {
    res.writeHead(403, BASE_HEADERS);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Diretório ou inexistente — não lista dir
      res.writeHead(404, BASE_HEADERS);
      res.end('Not Found');
      return;
    }

    if (req.method === 'HEAD') {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size,
        ...BASE_HEADERS,
      });
      res.end();
      return;
    }

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500, BASE_HEADERS);
        res.end('Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType, ...BASE_HEADERS });
      res.end(data);
    });
  });
});

export { resolveSafePath, ROOT, server };

// Só sobe o listener quando o arquivo é executado direto (`node server.js`),
// não quando importado nos testes (senão o vitest fica com handle aberto).
const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const PORT = parseInt(process.argv[2] || process.env.PORT, 10) || 8000;
  server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT} (sem cache — path traversal bloqueado)`);
  });
}
