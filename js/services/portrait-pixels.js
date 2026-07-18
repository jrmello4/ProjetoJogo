// ============================================================
// PIXEL PORTRAIT — motor de pixel art dos retratos
// ============================================================
// Busto 40×48 células, pintado num buffer com overwrite + máscara
// por material e compilado em UM path SVG por cor (runs horizontais).
//
// Por que buffer e não paths soltos (o sistema anterior):
//  - Máscara por material: tatuagem só pinta onde JÁ existe pele —
//    "tatuagem por cima da jaqueta" vira impossível por construção,
//    sem lista manual de quais roupas cobrem o peito.
//  - Contorno único: passe final desenha rim de 1px em volta da
//    silhueta inteira — cabelo, pele e roupa dividem o MESMO contorno,
//    linguagem de pixel art coesa em vez de elementos empilhados.
//  - Overwrite em ordem de pintura = z-order real: o que pinta depois
//    está na frente, sem regra de clipping ad-hoc.
//
// Grid fixo: alterar W/H quebra TODOS os pintores — não mexa.
const W = 40;
const H = 48;
const CX = 20; // eixo central

// ---- helpers de cor (sombras derivadas → iluminação consistente) ----

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const rgbToHex = ([r, g, b]) =>
  '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const shadeHex = (hex, f) => rgbToHex(hexToRgb(hex).map(v => v * f));
export const mixHex = (a, b, t) => {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
};

const OUTLINE = '#1b120b';
const SCLERA = '#efe9df';
const PUPIL = '#100b07';

// ---- buffer ----

class Px {
  constructor() { this.g = new Array(W * H).fill(null); }
  get(x, y) { return (x >= 0 && x < W && y >= 0 && y < H) ? this.g[y * W + x] : null; }
  set(x, y, c) { if (x >= 0 && x < W && y >= 0 && y < H && c) this.g[y * W + x] = c; }
  // pinta só onde o buffer já contém uma das cores de `mask` (Set) — o
  // mecanismo que faz tatuagem respeitar pele e barba respeitar rosto
  setOn(x, y, c, mask) {
    const cur = this.get(x, y);
    if (cur && mask.has(cur)) this.set(x, y, c);
  }
  row(y, x0, x1, c) { for (let x = x0; x <= x1; x++) this.set(x, y, c); }
  rect(x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) this.row(y, x0, x1, c); }
  rowOn(y, x0, x1, c, mask) { for (let x = x0; x <= x1; x++) this.setOn(x, y, c, mask); }
  rectOn(x0, y0, x1, y1, c, mask) { for (let y = y0; y <= y1; y++) this.rowOn(y, x0, x1, c, mask); }
  spans(list, c) { for (const [y, x0, x1] of list) this.row(y, x0, x1, c); }
  // rim de 1px na vizinhança vazia da silhueta — o contorno único
  outline(color) {
    const add = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x + 1, y) || this.get(x - 1, y) || this.get(x, y + 1) || this.get(x, y - 1)) {
          add.push([x, y]);
        }
      }
    }
    for (const [x, y] of add) this.set(x, y, color);
  }
}

// ---- anatomia base ----

// Cabeça por formato: spans [y, x0, x1]. Queixo ~y21; testa y6.
const HEAD_SHAPES = [
  // 0 oval
  [[5, 15, 24], [6, 13, 26], [7, 12, 27], [8, 12, 27], [9, 11, 28], [10, 11, 28], [11, 11, 28], [12, 11, 28], [13, 11, 28], [14, 11, 28], [15, 12, 27], [16, 12, 27], [17, 13, 26], [18, 13, 26], [19, 14, 25], [20, 15, 24], [21, 17, 22]],
  // 1 quadrado — mandíbula larga
  [[5, 14, 25], [6, 12, 27], [7, 12, 27], [8, 11, 28], [9, 11, 28], [10, 11, 28], [11, 11, 28], [12, 11, 28], [13, 11, 28], [14, 11, 28], [15, 11, 28], [16, 11, 28], [17, 12, 27], [18, 12, 27], [19, 13, 26], [20, 14, 25], [21, 16, 23]],
  // 2 redondo
  [[5, 14, 25], [6, 12, 27], [7, 11, 28], [8, 10, 29], [9, 10, 29], [10, 10, 29], [11, 10, 29], [12, 10, 29], [13, 10, 29], [14, 10, 29], [15, 11, 28], [16, 11, 28], [17, 12, 27], [18, 13, 26], [19, 14, 25], [20, 15, 24], [21, 17, 22]],
  // 3 alongado
  [[4, 15, 24], [5, 14, 25], [6, 13, 26], [7, 12, 27], [8, 12, 27], [9, 12, 27], [10, 12, 27], [11, 12, 27], [12, 12, 27], [13, 12, 27], [14, 12, 27], [15, 12, 27], [16, 13, 26], [17, 13, 26], [18, 14, 25], [19, 14, 25], [20, 15, 24], [21, 16, 23], [22, 17, 22]],
  // 4 angular — maçãs marcadas
  [[5, 14, 25], [6, 13, 26], [7, 12, 27], [8, 11, 28], [9, 11, 28], [10, 11, 28], [11, 10, 29], [12, 10, 29], [13, 11, 28], [14, 11, 28], [15, 12, 27], [16, 12, 27], [17, 13, 26], [18, 13, 26], [19, 14, 25], [20, 15, 24], [21, 17, 22]],
  // 5 diamante — queixo fino
  [[5, 15, 24], [6, 13, 26], [7, 12, 27], [8, 11, 28], [9, 11, 28], [10, 10, 29], [11, 10, 29], [12, 11, 28], [13, 11, 28], [14, 12, 27], [15, 12, 27], [16, 13, 26], [17, 14, 25], [18, 14, 25], [19, 15, 24], [20, 16, 23], [21, 18, 21]],
];

// Meia-largura do ombro por físico (BODY_TYPES na mesma ordem do catálogo)
const SHOULDER_HALF = [12, 14, 16, 15, 17, 11];

// ---- pintores ----

function paintHairBack(p, style, hair, hairSh) {
  // Pintado ANTES do torso/cabeça — fica naturalmente atrás.
  if (style === 8 || style === 21 || style === 23) { // longo / mullet / rabo
    const yEnd = style === 21 ? 30 : 34;
    p.rect(9, 8, 12, yEnd, hair);
    p.rect(27, 8, 30, yEnd, hair);
    p.rect(10, yEnd + 1, 11, yEnd + 2, hairSh);
    p.rect(28, yEnd + 1, 29, yEnd + 2, hairSh);
    if (style === 23) { p.rect(18, 22, 21, 33, hair); p.rect(19, 34, 20, 36, hairSh); } // cauda
  }
  if (style === 7) { // dreads
    for (const x of [10, 13, 16, 21, 24, 27]) p.rect(x, 8, x + 1, 26 + (x % 3), hair);
  }
  if (style === 13) { // tranças
    for (const x of [11, 15, 19, 23, 27]) p.rect(x, 8, x, 28, hair);
  }
  if (style === 15) { // cacheado — volume atrás
    p.rect(9, 7, 11, 16, hair);
    p.rect(28, 7, 30, 16, hair);
  }
  if (style === 5) { // black power — auréola atrás
    p.rect(8, 2, 31, 12, hair);
  }
}

function paintTorso(p, skin, skinSh, half) {
  const L = CX - half, R = CX - 1 + half;
  p.spans([[25, CX - half + 3, CX + half + 2 - 3]], skin);
  p.spans([[26, L + 1, R - 1]], skin);
  for (let y = 27; y < H; y++) p.row(y, L, R, skin);
  // sombra lateral direita + linha de peitoral
  for (let y = 28; y < H; y++) p.row(y, R - 2, R, skinSh);
  p.row(31, CX - 6, CX - 2, skinSh);
  p.row(31, CX + 1, CX + 5, skinSh);
  p.rect(CX - 1, 33, CX, 42, skinSh); // linha central
}

function paintNeck(p, skin, skinSh) {
  p.rect(16, 21, 23, 26, skin);
  p.row(21, 16, 23, skinSh);
  p.row(22, 16, 23, skinSh); // sombra do queixo
}

function paintHead(p, faceShape, skin, skinSh) {
  const spans = HEAD_SHAPES[faceShape] || HEAD_SHAPES[0];
  p.spans(spans, skin);
  // sombra do lado direito do rosto
  for (const [y, , x1] of spans) {
    if (y >= 8 && y <= 20) { p.set(x1, y, skinSh); p.set(x1 - 1, y, skinSh); }
  }
}

function paintEars(p, style, skin, skinSh) {
  if (style === 2) { // pequenas
    p.rect(10, 12, 10, 14, skin); p.rect(29, 12, 29, 14, skin);
    p.set(10, 13, skinSh); p.set(29, 13, skinSh);
    return;
  }
  if (style === 3) { // proeminentes
    p.rect(8, 11, 10, 15, skin); p.rect(29, 11, 31, 15, skin);
    p.rect(9, 12, 9, 14, skinSh); p.rect(30, 12, 30, 14, skinSh);
    return;
  }
  p.rect(9, 11, 10, 15, skin); p.rect(29, 11, 30, 15, skin);
  if (style === 1) { // couve-flor — miolo irregular escuro
    p.set(9, 12, skinSh); p.set(10, 13, skinSh); p.set(9, 14, skinSh);
    p.set(30, 12, skinSh); p.set(29, 13, skinSh); p.set(30, 14, skinSh);
  } else {
    p.set(10, 13, skinSh); p.set(29, 13, skinSh);
  }
}

function paintBrows(p, style, hairSh) {
  if (style === 1) { // angulada
    p.row(10, 13, 15, hairSh); p.row(9, 16, 17, hairSh);
    p.row(9, 22, 23, hairSh); p.row(10, 24, 26, hairSh);
    return;
  }
  if (style === 2) { // grossa
    p.rect(13, 9, 17, 10, hairSh); p.rect(22, 9, 26, 10, hairSh);
    return;
  }
  if (style === 3) { // arqueada
    p.row(9, 14, 16, hairSh); p.set(13, 10, hairSh); p.set(17, 10, hairSh);
    p.row(9, 23, 25, hairSh); p.set(22, 10, hairSh); p.set(26, 10, hairSh);
    return;
  }
  if (style === 4) { // rala
    p.set(13, 10, hairSh); p.set(15, 10, hairSh); p.set(17, 10, hairSh);
    p.set(22, 10, hairSh); p.set(24, 10, hairSh); p.set(26, 10, hairSh);
    return;
  }
  if (style === 5) { // monobloc
    p.row(10, 13, 26, hairSh);
    return;
  }
  p.row(10, 13, 17, hairSh); p.row(10, 22, 26, hairSh); // reta
}

function paintEyes(p, shape, eye) {
  const L = 14, Rr = 22; // x inicial de cada olho
  const iris = (x) => { p.set(x + 1, 12, eye); p.set(x + 2, 12, PUPIL); };
  if (shape === 1) { // focado — fresta
    p.row(12, L, L + 3, SCLERA); p.row(12, Rr, Rr + 3, SCLERA);
    iris(L); iris(Rr);
    return;
  }
  if (shape === 2) { // caído — canto externo 1 abaixo
    p.row(12, L + 1, L + 3, SCLERA); p.set(L, 13, SCLERA);
    p.row(12, Rr, Rr + 2, SCLERA); p.set(Rr + 3, 13, SCLERA);
    iris(L); iris(Rr);
    return;
  }
  if (shape === 3) { // amendoado — canto externo afilado com cílio
    p.row(12, L, L + 3, SCLERA); p.row(13, L + 1, L + 2, SCLERA);
    p.row(12, Rr, Rr + 3, SCLERA); p.row(13, Rr + 1, Rr + 2, SCLERA);
    p.set(L, 11, OUTLINE); p.set(Rr + 3, 11, OUTLINE);
    iris(L); iris(Rr);
    return;
  }
  if (shape === 4) { // largo
    p.rect(L, 12, L + 3, 13, SCLERA); p.rect(Rr, 12, Rr + 3, 13, SCLERA);
    p.set(L + 1, 12, eye); p.set(L + 2, 12, eye); p.set(L + 2, 13, PUPIL);
    p.set(Rr + 1, 12, eye); p.set(Rr + 2, 12, eye); p.set(Rr + 1, 13, PUPIL);
    return;
  }
  if (shape === 5) { // estreito — linha
    p.row(12, L, L + 3, PUPIL); p.row(12, Rr, Rr + 3, PUPIL);
    p.set(L + 2, 12, eye); p.set(Rr + 1, 12, eye);
    return;
  }
  if (shape === 6) { // intenso — pupila grande, sobrancelha baixa
    p.row(12, L, L + 3, SCLERA); p.row(12, Rr, Rr + 3, SCLERA);
    p.set(L + 1, 12, PUPIL); p.set(L + 2, 12, PUPIL);
    p.set(Rr + 1, 12, PUPIL); p.set(Rr + 2, 12, PUPIL);
    p.row(11, L, L + 3, OUTLINE); p.row(11, Rr, Rr + 3, OUTLINE);
    return;
  }
  // 0 neutro
  p.row(12, L, L + 3, SCLERA); p.row(13, L + 1, L + 2, SCLERA);
  p.row(12, Rr, Rr + 3, SCLERA); p.row(13, Rr + 1, Rr + 2, SCLERA);
  p.set(L + 1, 12, eye); p.set(L + 2, 12, PUPIL);
  p.set(Rr + 1, 12, eye); p.set(Rr + 2, 12, PUPIL);
}

// Layout facial no grid: ponte do nariz y13-14, narinas y15, bigode y16,
// boca y17-19 — cada faixa tem dona única, variantes nunca se engolem.
function paintNose(p, style, skinSh) {
  if (style === 1) { // largo
    p.set(19, 14, skinSh); p.set(20, 14, skinSh);
    p.row(15, 17, 22, skinSh);
    return;
  }
  if (style === 2) { // amassado — ponte torta
    p.set(19, 13, skinSh); p.set(21, 14, skinSh);
    p.row(15, 18, 21, skinSh);
    return;
  }
  if (style === 3) { // fino
    p.set(20, 13, skinSh); p.set(20, 14, skinSh);
    p.set(19, 15, skinSh); p.set(21, 15, skinSh);
    return;
  }
  if (style === 4) { // arrebitado
    p.set(18, 14, skinSh); p.set(19, 14, skinSh);
    p.set(18, 15, skinSh); p.set(20, 15, skinSh);
    return;
  }
  if (style === 5) { // aquilino — bossa
    p.set(20, 13, skinSh); p.set(21, 13, skinSh); p.set(20, 14, skinSh);
    p.row(15, 18, 21, skinSh);
    return;
  }
  // 0 reto
  p.set(20, 13, skinSh); p.set(20, 14, skinSh);
  p.row(15, 18, 21, skinSh);
}

function paintMouth(p, style, skinSh) {
  if (style === 1) { p.row(18, 16, 23, OUTLINE); return; } // séria
  if (style === 2) { p.row(18, 16, 22, OUTLINE); p.set(23, 17, OUTLINE); return; } // meio sorriso
  if (style === 3) { // confiante
    p.row(18, 16, 23, OUTLINE); p.set(15, 17, OUTLINE); p.set(24, 17, OUTLINE);
    p.row(19, 17, 22, skinSh);
    return;
  }
  if (style === 4) { p.row(18, 17, 22, OUTLINE); return; } // apertada
  if (style === 5) { p.row(18, 18, 22, OUTLINE); p.set(23, 17, OUTLINE); return; } // sorrisinho
  if (style === 6) { // carrancuda
    p.row(17, 17, 22, OUTLINE); p.set(16, 18, OUTLINE); p.set(23, 18, OUTLINE);
    return;
  }
  p.row(18, 16, 23, OUTLINE); p.row(19, 17, 22, skinSh); // neutra + lábio
}

// Barba — pinta SÓ sobre pele (máscara), então nunca engole boca já
// desenhada em OUTLINE nem vaza pra fora do rosto.
function paintBeard(p, style, hair, hairSh, skinMask) {
  if (style === 0) return;
  const jaw = (c, denser) => {
    for (let y = 14; y <= 21; y++) {
      for (let x = 11; x <= 28; x++) {
        const onEdge = x <= 13 || x >= 26 || y >= 19;
        if (!onEdge) continue;
        if (denser || (x + y) % 2 === 0) p.setOn(x, y, c, skinMask);
      }
    }
  };
  if (style === 1) { jaw(hairSh, false); return; } // sombra
  if (style === 2) { // cavanhaque
    p.rectOn(17, 19, 22, 21, hair, skinMask);
    p.rowOn(16, 16, 17, hair, skinMask); p.rowOn(16, 22, 23, hair, skinMask);
    return;
  }
  if (style === 3) { // bigode — 1 linha + pontas caídas
    p.rowOn(16, 15, 24, hair, skinMask);
    p.setOn(15, 17, hair, skinMask); p.setOn(24, 17, hair, skinMask);
    return;
  }
  if (style === 4) { // cheia — bigode em y16, boca (y17-18) fica visível
    jaw(hair, true);
    p.rowOn(16, 14, 25, hair, skinMask);
    p.rectOn(14, 19, 25, 21, hair, skinMask);
    return;
  }
  if (style === 5) { // longa — desce abaixo do queixo (sem máscara no pescoço)
    jaw(hair, true);
    p.rowOn(16, 14, 25, hair, skinMask);
    p.rectOn(14, 19, 25, 21, hair, skinMask);
    p.rect(15, 22, 24, 27, hair);
    p.rect(16, 28, 23, 29, hairSh);
    return;
  }
  if (style === 6) { // desenhada — linha fina
    for (let y = 16; y <= 20; y++) { p.setOn(12, y, hair, skinMask); p.setOn(27, y, hair, skinMask); }
    p.rowOn(21, 14, 25, hair, skinMask);
    p.rowOn(16, 16, 23, hair, skinMask);
    return;
  }
  if (style === 7) { // bigode + cavanhaque
    p.rowOn(16, 15, 24, hair, skinMask);
    p.rectOn(17, 19, 22, 21, hair, skinMask);
    return;
  }
  if (style === 8) { // costeletas
    p.rectOn(11, 10, 13, 17, hair, skinMask);
    p.rectOn(26, 10, 28, 17, hair, skinMask);
    return;
  }
  if (style === 9) { // chin strap
    for (let y = 14; y <= 19; y++) { p.setOn(11, y, hair, skinMask); p.setOn(12, y, hair, skinMask); p.setOn(27, y, hair, skinMask); p.setOn(28, y, hair, skinMask); }
    p.rowOn(20, 13, 26, hair, skinMask); p.rowOn(21, 15, 24, hair, skinMask);
    return;
  }
  if (style === 10) { jaw(hair, false); p.rowOn(16, 15, 24, hairSh, skinMask); return; } // sombra pesada
  if (style === 11) { // 3 dias — bem rala
    for (let y = 16; y <= 20; y++) for (let x = 12; x <= 27; x++) {
      if ((x * 3 + y * 5) % 7 === 0) p.setOn(x, y, hairSh, skinMask);
    }
    return;
  }
  // 12 Van Dyke
  p.rowOn(16, 16, 23, hair, skinMask);
  p.rectOn(18, 20, 21, 21, hair, skinMask);
}

function paintHairFront(p, style, hair, hairSh) {
  const cap = (yTop) => {
    p.spans([[yTop, 14, 25], [yTop + 1, 12, 27], [yTop + 2, 11, 28], [yTop + 3, 11, 28]], hair);
    p.row(8, 11, 12, hair); p.row(8, 27, 28, hair);
    p.row(9, 11, 11, hair); p.row(9, 28, 28, hair);
  };
  switch (style) {
    case 0: return; // careca
    case 1: // raspado — sombra de couro
      for (let x = 12; x <= 27; x++) if (x % 2 === 0) p.set(x, 5 + (x % 3 === 0 ? 1 : 0), hairSh);
      p.row(5, 14, 25, hairSh);
      return;
    case 2: cap(4); return; // buzz
    case 3: // moicano
      p.rect(18, 1, 21, 8, hair); p.rect(19, 0, 20, 0, hair);
      p.row(5, 14, 25, hairSh);
      return;
    case 4: // coque samurai
      cap(4); p.rect(17, 1, 22, 3, hair); p.row(0, 18, 21, hairSh);
      return;
    case 5: // black power — massa frontal
      p.spans([[1, 13, 26], [2, 10, 29], [3, 9, 30], [4, 8, 31], [5, 8, 31], [6, 8, 31], [7, 9, 30], [8, 9, 30], [9, 10, 29]], hair);
      p.row(2, 12, 15, hairSh);
      return;
    case 6: // médio
      cap(3); p.row(7, 11, 13, hair); p.row(7, 26, 28, hair);
      p.set(14, 7, hair); p.set(25, 7, hair);
      return;
    case 7: cap(4); p.row(4, 13, 26, hairSh); return; // dreads — coroa
    case 8: // longo — franja + coroa
      cap(3); p.rect(11, 7, 13, 12, hair); p.rect(26, 7, 28, 12, hair);
      return;
    case 9: // militar — flat top
      p.rect(12, 2, 27, 6, hair); p.row(2, 12, 27, hairSh);
      return;
    case 10: // undercut — topo cheio, lados raspados
      p.rect(13, 2, 26, 6, hair);
      for (let x = 11; x <= 12; x++) p.set(x, 8, hairSh);
      for (let x = 27; x <= 28; x++) p.set(x, 8, hairSh);
      return;
    case 11: // franja
      cap(4); p.row(8, 12, 27, hair); p.row(9, 13, 26, hair);
      return;
    case 12: // side part
      cap(4); p.rect(21, 4, 22, 5, hairSh); // risca
      p.row(8, 24, 27, hair);
      return;
    case 13: // tranças — coroa com linhas
      cap(4);
      for (const x of [13, 17, 21, 25]) { p.set(x, 5, hairSh); p.set(x, 6, hairSh); }
      return;
    case 14: // afro curto
      p.spans([[2, 13, 26], [3, 11, 28], [4, 10, 29], [5, 10, 29], [6, 10, 29], [7, 10, 29], [8, 11, 28]], hair);
      p.row(3, 13, 16, hairSh);
      return;
    case 15: // cacheado — topo irregular
      cap(4);
      for (const [x, y] of [[13, 3], [16, 2], [19, 3], [22, 2], [25, 3]]) { p.set(x, y, hair); p.set(x + 1, y, hair); }
      return;
    case 16: // bagunçado — espetos
      cap(4);
      for (const [x, y] of [[12, 3], [15, 2], [18, 3], [21, 1], [24, 2], [27, 3]]) p.set(x, y, hair);
      return;
    case 17: // penteado atrás
      cap(3); p.row(4, 13, 26, hairSh); p.row(6, 12, 27, hairSh);
      return;
    case 18: // entradas — M recuado
      p.spans([[5, 17, 22], [6, 13, 26], [7, 11, 28], [8, 11, 28]], hair);
      p.set(13, 5, hair); p.set(26, 5, hair);
      p.row(9, 11, 11, hair); p.row(9, 28, 28, hair);
      return;
    case 19: // top knot
      p.rect(18, 0, 21, 2, hair);
      p.row(5, 13, 26, hairSh);
      return;
    case 20: // cornrows — linhas frontais
      cap(4);
      for (const x of [13, 16, 19, 22, 25]) { p.set(x, 4, hairSh); p.set(x, 5, hairSh); p.set(x, 6, hairSh); }
      return;
    case 21: cap(4); p.row(8, 11, 13, hair); p.row(8, 26, 28, hair); return; // mullet — frente normal
    case 22: // pompadour — topete alto
      p.spans([[1, 14, 23], [2, 13, 25], [3, 12, 26], [4, 12, 27], [5, 11, 28], [6, 11, 28]], hair);
      p.row(2, 14, 17, hairSh);
      return;
    case 23: cap(4); return; // rabo de cavalo — frente presa
    default: return;
  }
}

function paintScars(p, style, scar) {
  if (style === 0) return;
  const brow = () => { p.set(24, 9, scar); p.set(25, 10, scar); };
  const cheek = () => { p.set(13, 15, scar); p.set(14, 16, scar); };
  const nose = () => { p.set(21, 14, scar); };
  const lip = () => { p.set(22, 19, scar); };
  const forehead = () => { p.row(8, 17, 19, scar); };
  const brow2 = () => { p.set(14, 9, scar); p.set(15, 10, scar); };
  if (style === 1) return brow();
  if (style === 2) return cheek();
  if (style === 3) { brow(); cheek(); return; }
  if (style === 4) return nose();
  if (style === 5) return lip();
  if (style === 6) return forehead();
  brow(); cheek(); nose(); brow2(); forehead(); // veterano
}

function paintFaceMarks(p, style, skinSh) {
  if (style === 0) return;
  if (style === 1) { // sardas
    for (const [x, y] of [[13, 14], [15, 15], [17, 14], [22, 14], [24, 15], [26, 14]]) p.set(x, y, skinSh);
    return;
  }
  if (style === 2) { // olheiras
    p.row(14, 14, 17, skinSh); p.row(14, 22, 25, skinSh);
    return;
  }
  if (style === 3) { // pele marcada
    for (const [x, y] of [[12, 16], [27, 15], [14, 18], [25, 18]]) p.set(x, y, skinSh);
    return;
  }
  if (style === 4) { // rubor
    p.row(15, 12, 14, '#c06868'); p.row(15, 25, 27, '#c06868');
    return;
  }
  // pintas
  p.set(16, 15, OUTLINE); p.set(24, 16, OUTLINE);
}

// Tatuagem — máscara de pele: se a roupa cobriu o peito, o pixel não é
// mais pele e a tinta simplesmente não pinta. Zero regra por outfit.
function paintTattoos(p, style, ink, skinMask, half) {
  if (style === 0) return;
  const chest = () => {
    p.rowOn(30, CX - 7, CX + 6, ink, skinMask);
    p.rowOn(31, CX - 5, CX + 4, ink, skinMask);
    p.rowOn(32, CX - 3, CX - 1, ink, skinMask); p.rowOn(32, CX, CX + 2, ink, skinMask);
  };
  const armL = CX - half;
  const arm = () => {
    p.rectOn(armL, 30, armL + 2, 31, ink, skinMask);
    p.rectOn(armL, 34, armL + 2, 35, ink, skinMask);
    p.rectOn(armL, 38, armL + 2, 39, ink, skinMask);
  };
  const sleeve = () => { p.rectOn(armL, 28, armL + 3, 42, ink, skinMask); };
  const neck = () => { p.rectOn(22, 22, 23, 25, ink, skinMask); };
  const temple = () => { p.rectOn(26, 8, 27, 10, ink, skinMask); };
  if (style === 1) return chest();
  if (style === 2) return arm();
  if (style === 3) return neck();
  if (style === 4) { chest(); arm(); return; }
  if (style === 5) return sleeve();
  if (style === 6) return temple();
  chest(); sleeve(); neck(); temple(); // full body
}

function paintOutfit(p, outfit, colors, half) {
  const { cloth, clothSh, accent, skin, skinSh } = colors;
  const L = CX - half, R = CX - 1 + half;
  const fill = (c, cSh, yTop = 25) => {
    p.spans([[yTop, CX - half + 3, CX + half + 2 - 3]], c);
    p.spans([[26, L + 1, R - 1]], c);
    for (let y = 27; y < H; y++) p.row(y, L, R, c);
    for (let y = 28; y < H; y++) p.row(y, R - 2, R, cSh);
  };
  const waistband = () => {
    p.rect(L, 44, R, 47, cloth);
    p.row(44, L, R, clothSh);
    p.rect(CX - 2, 45, CX + 1, 46, accent);
  };

  switch (outfit) {
    case 0: waistband(); return; // octógono — peito nu (torso já é pele)
    case 1: // rashguard
      fill(cloth, clothSh);
      p.rect(16, 23, 23, 26, cloth); // gola alta
      p.row(30, L + 1, R - 1, accent);
      waistband(); return;
    case 2: // regata
      fill(cloth, clothSh);
      p.rect(L, 25, L + 4, 31, skin); p.rect(R - 4, 25, R, 31, skinSh); // ombros de fora
      p.rect(L + 5, 25, L + 6, 28, cloth); p.rect(R - 6, 25, R - 5, 28, cloth); // alças
      waistband(); return;
    case 3: // camiseta
      fill(cloth, clothSh);
      p.row(26, 17, 22, skin); // gola careca
      p.rect(CX - 2, 32, CX + 1, 34, accent); // logo
      waistband(); return;
    case 4: // hoodie
      fill(cloth, clothSh);
      p.rect(13, 22, 26, 26, cloth); // capuz atrás do pescoço
      p.rect(15, 23, 24, 25, clothSh);
      p.set(18, 28, accent); p.set(18, 29, accent); p.set(21, 28, accent); p.set(21, 29, accent); // cordões
      p.row(40, CX - 5, CX + 4, clothSh); // bolso
      return;
    case 5: { // gi
      const GI = '#e8e4dc', GI_SH = '#c9c4b8';
      fill(GI, GI_SH);
      // lapelas em V
      for (let i = 0; i < 9; i++) { p.set(CX - 6 + i, 26 + i, GI_SH); p.set(CX + 5 - i, 26 + i, GI_SH); }
      p.rect(L, 38, R, 40, cloth); // faixa
      p.rect(CX - 1, 38, CX + 1, 40, accent); // nó
      return;
    }
    case 6: // colete
      p.rect(L + 4, 25, R - 4, 47, cloth);
      p.rect(L + 4, 25, L + 5, 47, clothSh); p.rect(R - 5, 25, R - 4, 47, clothSh);
      p.rect(CX - 5, 33, CX - 5, 40, accent); p.rect(CX + 4, 33, CX + 4, 40, accent);
      waistband(); return;
    case 7: // jaqueta
      fill(cloth, clothSh);
      p.rect(CX - 1, 27, CX, 47, OUTLINE); // zíper
      p.set(CX + 3, 32, accent); p.set(CX + 3, 36, accent); p.set(CX + 3, 40, accent);
      p.rect(L, 26, L + 2, 28, clothSh); p.rect(R - 2, 26, R, 28, clothSh); // gola
      return;
    case 8: // camisa social
      fill(cloth, clothSh);
      p.row(26, 17, 22, '#efe9df'); p.set(19, 27, '#efe9df'); p.set(20, 27, '#efe9df'); // colarinho
      p.set(CX, 30, OUTLINE); p.set(CX, 34, OUTLINE); p.set(CX, 38, OUTLINE); // botões
      return;
    case 9: // track jacket
      fill(cloth, clothSh);
      p.rect(L + 1, 27, L + 2, 47, accent); p.rect(R - 2, 27, R - 1, 47, accent); // listras
      p.rect(CX - 1, 27, CX, 45, clothSh);
      return;
    case 10: // jeans + regata
      fill(cloth, clothSh);
      p.rect(L, 25, L + 4, 31, skin); p.rect(R - 4, 25, R, 31, skinSh);
      p.rect(L + 5, 25, L + 6, 28, cloth); p.rect(R - 6, 25, R - 5, 28, cloth);
      p.rect(L, 40, R, 47, '#3a4a68'); // denim
      p.rect(CX - 1, 40, CX, 47, '#2a3548');
      p.row(40, L, R, accent);
      return;
    case 11: { // jaqueta de couro
      const LE = '#241a12', LE_SH = '#16100a';
      fill(LE, LE_SH);
      p.rect(CX - 1, 27, CX, 47, OUTLINE);
      p.rect(L, 26, L + 3, 29, LE_SH); p.rect(R - 3, 26, R, 29, LE_SH); // lapelas
      p.row(33, L + 2, L + 5, accent);
      return;
    }
    case 12: { // terno
      const SU = '#20242e', SU_SH = '#141820';
      fill(SU, SU_SH);
      // camisa + gravata
      p.rect(CX - 3, 26, CX + 2, 33, '#efe9df');
      for (let i = 0; i < 4; i++) { p.set(CX - 3 + i, 26 + i, SU); p.set(CX + 2 - i, 26 + i, SU); }
      p.rect(CX - 1, 28, CX, 35, cloth); // gravata na cor escolhida
      return;
    }
    case 13: // blazer celebridade
      fill(cloth, clothSh);
      p.rect(CX - 3, 26, CX + 2, 31, skin); // decote em V
      for (let i = 0; i < 3; i++) { p.set(CX - 3 + i, 29 + i, cloth); p.set(CX + 2 - i, 29 + i, cloth); }
      p.set(CX + 4, 34, accent); p.set(CX + 4, 38, accent);
      p.set(L + 3, 30, accent); // lenço
      return;
    case 14: // polo coach
      fill(cloth, clothSh);
      p.row(26, 17, 22, clothSh); p.set(19, 27, clothSh); p.set(20, 27, clothSh);
      p.rect(CX + 4, 31, CX + 5, 32, accent); // logozinho
      return;
    case 15: // moletom de treino
      fill(cloth, clothSh);
      p.rect(13, 22, 26, 26, cloth);
      p.rect(15, 23, 24, 25, clothSh);
      p.row(38, CX - 4, CX + 3, accent);
      return;
    case 16: // roupa simples — camiseta gasta
      fill(mixHex(cloth, '#8e857c', 0.35), mixHex(clothSh, '#6a645c', 0.35));
      p.row(26, 17, 22, skin);
      p.row(36, CX - 3, CX - 1, clothSh); p.row(41, CX + 1, CX + 3, clothSh); // remendos
      return;
    case 17: // extravagante — bicolor diagonal
      fill(cloth, clothSh);
      for (let y = 25; y < H; y++) for (let x = CX; x <= R; x++) {
        if (p.get(x, y)) p.set(x, y, accent);
      }
      p.set(CX - 4, 30, '#efe9df'); p.set(CX + 5, 36, '#efe9df'); p.set(CX - 2, 41, '#efe9df'); // brilhos
      return;
    case 18: // faixa de herança — peito nu + banda
      for (let i = 0; i < 12; i++) {
        p.row(27 + i, CX - 7 + i, CX - 5 + i, accent);
      }
      waistband(); return;
    default: fill(cloth, clothSh); return;
  }
}

function paintAccessory(p, style, colors, half) {
  const { cloth, accent } = colors;
  const L = CX - half, R = CX - 1 + half;
  switch (style) {
    case 0: return;
    case 1: // bandana
      p.rect(11, 7, 28, 8, cloth); p.row(7, 11, 28, accent);
      p.rect(29, 9, 30, 11, cloth); // ponta
      return;
    case 2: // boné
      p.spans([[2, 14, 25], [3, 12, 27], [4, 11, 28], [5, 11, 28], [6, 11, 28]], cloth);
      p.row(7, 11, 32, cloth); p.row(7, 29, 32, shadeHex(cloth, 0.7)); // aba
      p.row(2, 14, 25, shadeHex(cloth, 0.7));
      p.set(19, 4, accent); p.set(20, 4, accent);
      return;
    case 3: // corrente
      p.row(27, 16, 23, accent); p.set(15, 26, accent); p.set(24, 26, accent);
      p.rect(19, 28, 20, 29, accent);
      return;
    case 4: // fita de mão
      p.rect(L, 42, L + 3, 46, accent); p.rect(R - 3, 42, R, 46, accent);
      p.row(44, L, L + 3, shadeHex(accent, 0.7)); p.row(44, R - 3, R, shadeHex(accent, 0.7));
      return;
    case 5: // óculos
      p.rect(13, 11, 17, 13, OUTLINE); p.rect(22, 11, 26, 13, OUTLINE);
      p.rect(14, 12, 16, 12, SCLERA); p.rect(23, 12, 25, 12, SCLERA);
      p.row(11, 18, 21, OUTLINE);
      p.set(12, 11, OUTLINE); p.set(27, 11, OUTLINE);
      return;
    case 6: // gorro
      p.spans([[2, 14, 25], [3, 12, 27], [4, 11, 28], [5, 11, 28], [6, 11, 28], [7, 11, 28], [8, 11, 28]], cloth);
      p.row(8, 11, 28, shadeHex(cloth, 0.7)); // dobra
      p.set(19, 1, accent); p.set(20, 1, accent); // pompom
      return;
    case 7: // faixa de suor
      p.rect(11, 7, 28, 8, cloth); p.row(8, 11, 28, shadeHex(cloth, 0.7));
      return;
    case 8: // corrente grossa
      p.rect(15, 26, 24, 27, accent); p.rect(17, 28, 22, 29, accent);
      p.rect(19, 30, 20, 31, shadeHex(accent, 0.7));
      return;
    case 9: // óculos de sol
      p.rect(13, 11, 17, 13, OUTLINE); p.rect(22, 11, 26, 13, OUTLINE);
      p.rect(14, 12, 16, 13, '#0e0a06'); p.rect(23, 12, 25, 13, '#0e0a06');
      p.row(11, 18, 21, OUTLINE);
      p.set(14, 12, '#4a4038'); p.set(23, 12, '#4a4038'); // reflexo
      return;
    case 10: // brinco
      p.set(9, 15, accent); p.set(9, 16, shadeHex(accent, 0.7));
      return;
    case 11: // piercing
      p.set(21, 16, accent); p.set(25, 10, accent);
      return;
    case 12: // relógio
      p.rect(R - 3, 42, R, 44, OUTLINE); p.rect(R - 2, 43, R - 1, 43, accent);
      return;
    case 13: // anel
      p.set(L + 2, 44, accent);
      return;
    case 14: // chapéu
      p.spans([[1, 13, 26], [2, 12, 27], [3, 12, 27], [4, 12, 27], [5, 12, 27]], cloth);
      p.row(6, 8, 31, cloth); p.row(7, 8, 31, shadeHex(cloth, 0.7)); // aba larga
      p.row(4, 12, 27, accent); // fita
      return;
    case 15: // alça de mochila
      p.rect(L + 2, 26, L + 3, 42, OUTLINE); p.rect(R - 3, 26, R - 2, 42, OUTLINE);
      return;
    case 16: // corrente de título
      p.row(26, 15, 24, accent); p.set(14, 25, accent); p.set(25, 25, accent);
      p.rect(17, 27, 22, 31, accent);
      p.rect(19, 28, 20, 30, shadeHex(accent, 0.6)); // placa
      p.set(19, 29, '#efe9df'); // brilho
      return;
    case 17: // apito de coach
      p.set(23, 27, accent); p.set(24, 28, accent); p.rect(24, 29, 25, 30, accent);
      return;
    case 18: // pulseira de origem
      p.rect(L, 42, L + 3, 43, accent); p.row(43, L, L + 3, cloth);
      return;
    default: return;
  }
}

// ---- compilação: buffer → 1 path por cor ----

function compile(p) {
  const byColor = new Map();
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      const c = p.get(x, y);
      if (!c) { x++; continue; }
      let x2 = x;
      while (x2 + 1 < W && p.get(x2 + 1, y) === c) x2++;
      const d = byColor.get(c) || [];
      d.push(`M${x} ${y}h${x2 - x + 1}v1h${-(x2 - x + 1)}z`);
      byColor.set(c, d);
      x = x2 + 1;
    }
  }
  let out = '';
  for (const [color, ds] of byColor) {
    out += `<path d="${ds.join('')}" fill="${color}"/>`;
  }
  return out;
}

/**
 * Pinta o busto completo e devolve o conteúdo interno do SVG (paths).
 * `a` já normalizada; `colors` resolvidas pelo PortraitService.
 */
export function paintPortrait(a, colors) {
  return compile(paintBuffer(a, colors));
}

// Buffer cru — usado por testes/debug pra inspecionar a composição
// pixel a pixel sem parsear SVG.
export function paintBuffer(a, colors) {
  const p = new Px();
  const { skin, skinSh, hair, cloth } = colors;
  const hairSh = shadeHex(hair, 0.72);
  const clothSh = shadeHex(cloth, 0.72);
  const ink = shadeHex(skinSh, 0.5);
  const scar = mixHex(skin, '#f0e8dc', 0.55);
  const half = SHOULDER_HALF[a.bodyType] ?? 14;
  const skinMask = new Set([skin, skinSh]);
  const painterColors = { ...colors, hairSh, clothSh };

  paintHairBack(p, a.hairBackStyle ?? a.hairStyle, hair, hairSh);
  paintTorso(p, skin, skinSh, half);
  paintOutfit(p, a.outfitStyle, painterColors, half);
  paintNeck(p, skin, skinSh);
  paintHead(p, a.faceShape, skin, skinSh);
  paintEars(p, a.earStyle, skin, skinSh);
  // Tatuagem depois de TODA a pele existir — a máscara por material faz o
  // resto: só pinta onde ainda é pele (roupa já cobriu o que cobre).
  paintTattoos(p, a.tattooStyle, ink, skinMask, half);
  paintFaceMarks(p, a.faceMarks, skinSh);
  paintBrows(p, a.browStyle, hairSh);
  paintEyes(p, a.eyeShape, colors.eye);
  paintNose(p, a.noseStyle, skinSh);
  // Barba ANTES da boca: a boca desenha por cima e fica sempre legível
  // dentro da barba cheia — barba nunca engole o lábio.
  paintBeard(p, a.beardStyle, hair, hairSh, skinMask);
  paintMouth(p, a.mouthStyle, skinSh);
  paintHairFront(p, a.hairFrontStyle ?? a.hairStyle, hair, hairSh);
  paintScars(p, a.scarStyle, scar);
  paintAccessory(p, a.accessory, painterColors, half);

  p.outline(OUTLINE);
  return p;
}

export const PIXEL_GRID = { W, H };
