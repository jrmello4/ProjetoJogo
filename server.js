const http = require('http');
const fs = require('fs');
const path = require('path');

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.riv': 'application/octet-stream'
};

// Sem Cache-Control, o `python -m http.server` deixa o navegador cachear
// módulos ES por heurística (baseado no Last-Modified do arquivo) — um
// reload normal serve JS antigo sem erro visível. Em dev, isso é pior que
// qualquer custo de performance: `no-store` força o navegador a sempre
// buscar o arquivo atual do disco.
const NO_CACHE_HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';

  const filePath = path.join(__dirname, url);
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, NO_CACHE_HEADERS);
      res.end('Not Found');
      return;
    }
    if (stats.isDirectory()) {
      fs.readFile(path.join(filePath, 'index.html'), (e, d) => {
        if (e) { res.writeHead(404, NO_CACHE_HEADERS); res.end('Not Found'); }
        else { res.writeHead(200, { 'Content-Type': 'text/html', ...NO_CACHE_HEADERS }); res.end(d); }
      });
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(500, NO_CACHE_HEADERS); res.end('Error'); return; }
      res.writeHead(200, { 'Content-Type': contentType, ...NO_CACHE_HEADERS });
      res.end(data);
    });
  });
});

const PORT = parseInt(process.argv[2] || process.env.PORT, 10) || 8000;
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT} (sem cache — sempre serve o arquivo atual)`);
});