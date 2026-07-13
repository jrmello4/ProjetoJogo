// build-itch.js - Cria build limpo para itch.io
// Uso: node build-itch.js
const fs = require('fs');
const path = require('path');

const DIST = 'dist';
const INCLUDE = [
  'index.html',
  'landing.html',
  'manifest.webmanifest',
  'sw.js',
  'README.md',
  'assets/',
  'css/',
  'js/',
];

// Limpa dist
if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, { recursive: true });
}
fs.mkdirSync(DIST);

// Copia arquivos
for (const file of INCLUDE) {
  const src = path.join(__dirname, file);
  const dest = path.join(__dirname, DIST, file);
  if (fs.existsSync(src)) {
    copyRecursive(src, dest);
  }
}

console.log(`Build completo: ${countFiles(DIST)} arquivos em ${DIST}/`);

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function countFiles(dir) {
  let count = 0;
  for (const file of fs.readdirSync(dir, { recursive: true })) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isFile()) count++;
  }
  return count;
}
