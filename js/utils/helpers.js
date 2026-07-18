export function formatWeeks(weeks) {
  return `${weeks} semana${weeks === 1 ? '' : 's'}`;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function formatDateShort(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(d);
}

// Escapa texto antes de interpolar em HTML (views usam innerHTML em massa).
// Nome do jogador, mensagens de notificação e career log podem carregar
// strings arbitrárias — sem isto, `<img onerror=...>` no rename vira XSS.
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Atalho curto pra views (`${e(fighter.name)}`). */
export const e = escapeHtml;

/**
 * Template tag que escapa TODO valor interpolado.
 * HTML fixo fica nas strings; dados dinâmicos vão nos ${}.
 *   html`<div>${fighter.name}</div>`  → seguro
 * Não use se o valor JÁ for HTML confiável (marque com html.raw).
 */
export function html(strings, ...values) {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < values.length) {
      const v = values[i];
      out += v && v.__html === true ? String(v.value ?? '') : escapeHtml(v);
    }
  }
  return out;
}
html.raw = (value) => ({ __html: true, value });

// Nome de lutador controlado pelo jogador: só letras/números/espaço/hífen/apóstrofo.
// Remove tags (e o miolo de <script>…</script>), control chars e corta.
export function sanitizePlayerName(raw, { maxLen = 30, fallback = 'Lutador Anônimo' } = {}) {
  let s = String(raw ?? '')
    // Remoção intencional de caracteres de controle do input — não um regex acidentalmente perigoso.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    // allowlist: letras unicode, números, espaço, hífen, apóstrofo, ponto
    .replace(/[^\p{L}\p{N}\s\-'.]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return fallback;
  if (s.length > maxLen) s = s.slice(0, maxLen).trim();
  return s || fallback;
}

// Escolhe o item de maior valor em `keyFn`, sorteando entre empatados. Sem
// isso, `arr.sort((a,b)=>b.x-a.x)[0]` é determinístico em empate — a ordem
// de chegada do array vence pra sempre (Array.sort é estável), então quem
// entrou primeiro (ex: sua primeira rivalidade, todas nascendo em
// intensidade 1) nunca perde o topo. Usado onde "o mais X" deveria variar
// quando há mais de um "mais X".
export function pickTopRandom(arr, keyFn) {
  if (arr.length === 0) return null;
  let best = keyFn(arr[0]);
  for (const item of arr) {
    const v = keyFn(item);
    if (v > best) best = v;
  }
  const tied = arr.filter(item => keyFn(item) === best);
  return tied[Math.floor(Math.random() * tied.length)];
}

export function getNationalityFlag(code) {
  if (!code || code.length !== 2) return '';
  const segments = code.toUpperCase().split('');
  return segments.map(c => String.fromCodePoint(0x1F1E6 + (c.charCodeAt(0) - 'A'.charCodeAt(0)))).join('');
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function round(value, decimals = 1) {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Épico E1: navegação entre divisões de peso
const WEIGHT_CLASS_ORDER = [
  'Strawweight', 'Flyweight', 'Bantamweight', 'Featherweight',
  'Lightweight', 'Welterweight', 'Middleweight',
  'Light Heavyweight', 'Heavyweight',
];

export function getAdjacentWeightClasses(current) {
  const idx = WEIGHT_CLASS_ORDER.indexOf(current);
  if (idx === -1) return { up: null, down: null };
  return {
    up: idx > 0 ? WEIGHT_CLASS_ORDER[idx - 1] : null,     // subir de divisão (menos peso)
    down: idx < WEIGHT_CLASS_ORDER.length - 1 ? WEIGHT_CLASS_ORDER[idx + 1] : null, // descer
  };
}

// Nomenclatura oficial das divisões em português (padrão UFC Brasil)
export function getWeightClassLabel(weight) {
  const labels = {
    'Strawweight': 'Peso-Palha (115 lbs)',
    'Flyweight': 'Peso-Mosca (125 lbs)',
    'Bantamweight': 'Peso-Galo (135 lbs)',
    'Featherweight': 'Peso-Pena (145 lbs)',
    'Lightweight': 'Peso-Leve (155 lbs)',
    'Welterweight': 'Peso-Meio-Médio (170 lbs)',
    'Middleweight': 'Peso-Médio (185 lbs)',
    'Light Heavyweight': 'Peso-Meio-Pesado (205 lbs)',
    'Heavyweight': 'Peso-Pesado (265 lbs)',
  };
  return labels[weight] || weight;
}

// Nome curto da divisão sem o peso — para textos corridos
export function getWeightClassName(weight) {
  const names = {
    'Strawweight': 'Palha',
    'Flyweight': 'Mosca',
    'Bantamweight': 'Galo',
    'Featherweight': 'Pena',
    'Lightweight': 'Leve',
    'Welterweight': 'Meio-Médio',
    'Middleweight': 'Médio',
    'Light Heavyweight': 'Meio-Pesado',
    'Heavyweight': 'Pesado',
  };
  return names[weight] || weight;
}

// Nível de um atributo (0-99) — usado para colorir barras de progresso
export function attributeTier(value) {
  return value >= 70 ? 'high' : value >= 40 ? 'medium' : 'low';
}

// Barra de atributo rotulada — clareza > tabela crua de abreviações
export function renderAttrBar(label, value) {
  return `
    <div class="attr-item">
      <div class="attr-label">
        <span>${label}</span>
        <span class="attr-value">${Math.round(value)}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill ${attributeTier(value)}" style="width:${Math.max(0, Math.min(100, value))}%"></div>
      </div>
    </div>
  `;
}

// Atributo sob névoa: você não sabe o número, sabe a faixa. A barra mostra
// um trecho entre o mínimo e o máximo — quanto mais você estuda o adversário,
// mais estreito ele fica, até virar um número exato.
export function renderAttrRange(label, blurred) {
  if (blurred.exact) return renderAttrBar(label, blurred.value);

  const width = Math.max(3, blurred.max - blurred.min);
  return `
    <div class="attr-item">
      <div class="attr-label">
        <span>${label}</span>
        <span class="attr-value attr-value--fuzzy">${blurred.min}–${blurred.max}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fuzzy" style="left:${blurred.min}%;width:${width}%"></div>
      </div>
    </div>
  `;
}

// Abreviação em português para badges compactos
export function getWeightClassShort(weight) {
  const shorts = {
    'Strawweight': 'PALHA',
    'Flyweight': 'MOSCA',
    'Bantamweight': 'GALO',
    'Featherweight': 'PENA',
    'Lightweight': 'LEVE',
    'Welterweight': 'M-MÉDIO',
    'Middleweight': 'MÉDIO',
    'Light Heavyweight': 'M-PESADO',
    'Heavyweight': 'PESADO',
  };
  return shorts[weight] || weight;
}
