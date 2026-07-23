import { cp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join, relative } from 'node:path';
import { build } from 'vite';

const DIST = 'dist';

async function filesIn(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  }));
  return nested.flat();
}

function serviceWorkerSource(files, version) {
  const assets = files
    .filter(file => !file.endsWith('sw.js'))
    .map(file => relative(DIST, file).replaceAll('\\', '/'))
    .filter(file => {
      const extension = extname(file).toLowerCase();
      return file === 'index.html'
        || ['.js', '.css', '.webmanifest', '.ttf', '.woff', '.woff2', '.svg'].includes(extension)
        || /^assets\/career-arena-[^/]+\.png$/.test(file);
    })
    .map(file => `./${file}`);
  return `const CACHE = 'mma-manager-offline-${version}';
const ASSETS = ${JSON.stringify(assets, null, 2)};
self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
));
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('mma-manager-offline-') && key !== CACHE)
    .map(key => caches.delete(key))
  )).then(() => self.clients.claim())
));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request)
    .then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
      return response;
    })
    .catch(() => event.request.mode === 'navigate'
      ? caches.match('./index.html')
      : new Response('Offline', { status: 503, statusText: 'Offline' }))));
});
`;
}

await rm(DIST, { recursive: true, force: true });
await build();
// Estes recursos têm caminhos montados em runtime e, por isso, o Vite não
// consegue descobri-los pelo grafo de imports. Cenas e fontes referenciadas
// pelo CSS já saem com hash e não devem ser copiadas de novo.
const runtimeAssets = [
  ['assets/icon.svg', join(DIST, 'assets/icon.svg')],
  ['assets/cards', join(DIST, 'assets/cards')],
  ['assets/cinematics', join(DIST, 'assets/cinematics')],
  ['assets/combat/fighters', join(DIST, 'assets/combat/fighters')],
  ['assets/pixel/ui-icons.svg', join(DIST, 'assets/pixel/ui-icons.svg')],
  ['assets/pixel/status-icons.svg', join(DIST, 'assets/pixel/status-icons.svg')],
  ['assets/pixel/manifest.json', join(DIST, 'assets/pixel/manifest.json')],
];
await Promise.all(runtimeAssets.map(([source, target]) => cp(source, target, { recursive: true })));
const builtFiles = await filesIn(DIST);
const contentHash = createHash('sha256');
for (const file of builtFiles) contentHash.update(await readFile(file));
const version = contentHash.digest('hex').slice(0, 12);
await writeFile(join(DIST, 'sw.js'), serviceWorkerSource(builtFiles, version));
