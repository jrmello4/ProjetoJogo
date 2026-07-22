// Traduz um dossiê de scouting (níveis 0-3, névoa de guerra) numa leitura de
// dossiê profissional: quanto você CONHECE vs o que ainda é DESCONHECIDO, as
// AMEAÇAS do adversário e as OPORTUNIDADES contra ele, cada bloco com um grau
// de confiança (a informação nunca é perfeita — em nível baixo pode até estar
// errada). PURO: recebe o dossiê já montado (game.opponentDossier), devolve a
// leitura; não lê DB nem DOM.

// Quanto do adversário está descoberto em cada nível — casado com o que
// readTendencies/blur realmente revelam: L1 abre arquétipo/cardio/IQ/queixo,
// L2 abre poder/quedas/finalização/velocidade/sangue-frio, L3 dá números
// exatos e DNA.
const COVERAGE_PCT = { 0: 0, 1: 45, 2: 80, 3: 100 };

// A informação nunca é perfeita: em nível baixo é indício (pode estar errada),
// no meio é provável, só no topo é confirmada.
const CONFIDENCE = { 0: '—', 1: 'Indício', 2: 'Provável', 3: 'Confirmado' };

function unknownDimensions(level) {
  if (level >= 3) return [];
  if (level === 2) return ['números exatos', 'DNA oculto'];
  if (level === 1) return ['poder', 'quedas', 'finalização', 'velocidade', 'sangue-frio', 'DNA'];
  return ['tudo — estude-o antes de escolher o plano'];
}

// Forças do adversário: o que te machuca se você ignorar.
function buildThreats(t) {
  const out = [];
  if (t.archetype === 'striker') out.push('Trocação perigosa em pé.');
  if (t.archetype === 'grappler') out.push('Jogo de chão dominante.');
  if (t.cardio === 'highCardio') out.push('Cardio de sobra — pressiona os três rounds.');
  if (t.power === 'powerful') out.push('Poder de nocaute real.');
  if (t.takedowns === 'wrestler') out.push('Quedas fortes — vai buscar o chão.');
  if (t.submissionOffense === 'submission') out.push('Ameaça de finalização no solo.');
  if (t.speed === 'fast') out.push('Velocidade acima da média.');
  if (t.composure === 'composed') out.push('Frio nos momentos decisivos.');
  if (typeof t.chin === 'number' && t.chin >= 65) out.push('Queixo de ferro — difícil de nocautear.');
  return out;
}

// Fraquezas do adversário: onde a luta pode ser sua.
function buildOpportunities(t) {
  const out = [];
  if (t.cardio === 'lowCardio') out.push('Cansa nos rounds finais — imponha ritmo.');
  if (t.iq === 'lowIq') out.push('Impulsivo — puna os erros dele.');
  if (t.power === 'weak') out.push('Sem poder de verdade — troque sem medo.');
  if (t.takedowns === 'poorTakedowns') out.push('Defesa de queda fraca — leve pro chão.');
  if (t.composure === 'nervous') out.push('Vacila sob pressão — apareça cedo.');
  if (typeof t.chin === 'number' && t.chin <= 40) out.push('Queixo frágil — busque o nocaute.');
  return out;
}

export function deriveScoutingReads(dossier) {
  const level = Math.max(0, Math.min(3, dossier?.level ?? 0));
  const t = dossier?.tendencies || null;

  const threats = t ? buildThreats(t) : [];
  const opportunities = t ? buildOpportunities(t) : [];

  return {
    level,
    visibility: level >= 3 ? 'revealed' : level > 0 ? 'partial' : 'unknown',
    coveragePct: COVERAGE_PCT[level] ?? 0,
    confidence: CONFIDENCE[level] ?? '—',
    threats,
    opportunities,
    unknown: unknownDimensions(level),
  };
}
