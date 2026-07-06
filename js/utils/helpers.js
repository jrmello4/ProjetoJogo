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

export function getWeightClassLabel(weight) {
  const labels = {
    'Strawweight': 'Pena (125 lbs)',
    'Flyweight': 'Mosca (125 lbs)',
    'Bantamweight': 'Pena (135 lbs)',
    'Featherweight': 'Galo (145 lbs)',
    'Lightweight': 'Leve (155 lbs)',
    'Welterweight': 'Meio-Médio (170 lbs)',
    'Middleweight': 'Médio (185 lbs)',
    'Light Heavyweight': 'Meio-Pesado (205 lbs)',
    'Heavyweight': 'Pesado (265 lbs)',
  };
  return labels[weight] || weight;
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

export function getWeightClassShort(weight) {
  const shorts = {
    'Strawweight': 'SW',
    'Flyweight': 'FLY',
    'Bantamweight': 'BAN',
    'Featherweight': 'FEA',
    'Lightweight': 'LW',
    'Welterweight': 'WW',
    'Middleweight': 'MW',
    'Light Heavyweight': 'LHW',
    'Heavyweight': 'HW',
  };
  return shorts[weight] || weight;
}
