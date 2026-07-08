export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDateShort(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(date));
}

export function getNationalityFlag(code) {
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
