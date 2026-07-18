/**
 * Codemod: wrap dynamic string interpolations in views with e(...).
 * Only touches ${obj.field} patterns for text-like field names.
 * Skips values already wrapped in e() / escapeHtml().
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const viewsDir = path.join(__dirname, '..', 'js', 'views');
const appPath = path.join(__dirname, '..', 'js', 'app.js');

const TEXT_FIELDS = [
  'name', 'Name', 'title', 'message', 'prompt', 'text', 'description',
  'opponent', 'opponentName', 'promotionName', 'philosophy', 'question',
  'label', 'shortLabel', 'short', 'headline', 'teaser', 'chant', 'body',
  'from', 'style', 'fightingStyle', 'method', 'result', 'hint', 'desc',
  'bondLabel', 'opponentStyle', 'opponentLabel', 'intensityLabel',
];

// ${something.field} or ${something.field || 'x'} — not already e(
const fieldAlt = TEXT_FIELDS.join('|');
const re = new RegExp(
  String.raw`\$\{(?!e\()(?!escapeHtml\()([A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*\.(?:${fieldAlt})(?:\s*\|\|\s*(?:'[^']*'|"[^"]*"|[^}?]+))?)\}`,
  'g'
);

// Also ${getFighterName(...)} style calls that return names
const callRe = /\$\{(?!e\()(?!escapeHtml\()((?:getFighterName|humanizeType|describeMoment|weekLabel)\([^)]*\))\}/g;

function ensureImport(src, fromPath = '../utils/helpers.js') {
  if (/\be\b/.test(src.match(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*helpers\.js['"]/)?.[0] || '')) {
    return src;
  }
  if (/from\s*['"][^'"]*helpers\.js['"]/.test(src)) {
    return src.replace(
      /import\s*\{([^}]*)\}\s*from\s*(['"][^'"]*helpers\.js['"])/,
      (m, inner, from) => {
        if (/\be\b/.test(inner)) return m;
        const trimmed = inner.trim().replace(/,\s*$/, '');
        return `import { ${trimmed}${trimmed ? ', ' : ''}e } from ${from}`;
      }
    );
  }
  // No helpers import — add one after leading comments
  if (src.trimStart().startsWith('/*')) {
    const end = src.indexOf('*/');
    return src.slice(0, end + 2) + `\nimport { e } from '${fromPath}';\n` + src.slice(end + 2);
  }
  const lines = src.split('\n');
  let i = 0;
  while (i < lines.length && (lines[i].startsWith('//') || lines[i].trim() === '')) i++;
  lines.splice(i, 0, `import { e } from '${fromPath}';`);
  return lines.join('\n');
}

function processSource(src, helpersFrom) {
  let n = 0;
  let out = src.replace(re, (_, expr) => {
    n++;
    return `\${e(${expr})}`;
  });
  out = out.replace(callRe, (_, expr) => {
    n++;
    return `\${e(${expr})}`;
  });
  // collapse accidental double wrap
  out = out.replace(/\$\{e\(e\(([\s\S]*?)\)\)\}/g, (_, inner) => `\${e(${inner})}`);
  if (n > 0) out = ensureImport(out, helpersFrom);
  return { out, n };
}

let total = 0;
for (const file of fs.readdirSync(viewsDir).filter(f => f.endsWith('.js'))) {
  const fp = path.join(viewsDir, file);
  const src = fs.readFileSync(fp, 'utf8');
  const { out, n } = processSource(src, '../utils/helpers.js');
  if (n > 0) {
    fs.writeFileSync(fp, out);
    console.log(`${file}: ${n}`);
    total += n;
  } else {
    console.log(`${file}: 0`);
  }
}

// app.js — only a few dangerous interpolations in modals; still run codemod
{
  const src = fs.readFileSync(appPath, 'utf8');
  const { out, n } = processSource(src, './utils/helpers.js');
  if (n > 0) {
    fs.writeFileSync(appPath, out);
    console.log(`app.js: ${n}`);
    total += n;
  } else {
    console.log('app.js: 0');
  }
}

console.log('TOTAL', total);
