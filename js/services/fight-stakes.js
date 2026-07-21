import { TITLE_ROLE } from '../config/game-config.js';

// "O que está em jogo" — traduz o estado do jogo numa leitura de decisão
// (princípio central de UX: SITUAÇÃO -> DECISÃO -> RISCO -> RECOMPENSA ->
// CONSEQUÊNCIA). Função PURA: recebe o lutador, a oferta e o contexto de
// ranking já calculado; devolve três listas curtas de itens {icon, text}.
// Não lê DB, não renderiza — a view só desenha o que sai daqui, e o teste
// exercita a lógica sem DOM.

const MAX_PER_COLUMN = 3;

// Divisão pequena não tem "Top 10" que signifique algo — só falamos em Top 10
// quando a divisão é grande o bastante pra que estar dentro dele seja mérito.
const TOP_TIER_CUTOFF = 10;

function take(list, n = MAX_PER_COLUMN) {
  return list.filter(Boolean).slice(0, n);
}

// A recompensa de vencer: cinturão, salto no ranking, escalpo de favorito,
// ou manter uma sequência viva. Ordenada por peso — o item mais forte primeiro.
function buildReward(fighter, offer, { playerRank, oppRank, divisionSize }) {
  const out = [];

  if (offer.isTitleFight) {
    out.push(offer.titleRole === TITLE_ROLE.DEFENSE
      ? { icon: '🏆', text: 'Defender o cinturão e somar mais uma defesa ao seu legado.' }
      : { icon: '🏆', text: 'Conquistar o cinturão — o topo da divisão.' });
  }

  const ovrGap = (offer.opponentOverall ?? 0) - (fighter.overallRating ?? 0);
  const opponentAhead = playerRank != null && oppRank != null && oppRank < playerRank;

  if (opponentAhead) {
    const entersTop = divisionSize >= TOP_TIER_CUTOFF && oppRank <= TOP_TIER_CUTOFF && playerRank > TOP_TIER_CUTOFF;
    out.push(entersTop
      ? { icon: '📈', text: `Passar o #${oppRank} pode te colocar no Top ${TOP_TIER_CUTOFF} da divisão.` }
      : { icon: '📈', text: `Vitória sobre o #${oppRank} te puxa para cima no ranking.` });
  } else if (ovrGap >= 5) {
    out.push({ icon: '📈', text: 'Vencer um favorito no papel vale muito para a sua reputação.' });
  }

  const streak = fighter.winStreak || 0;
  if (streak >= 2) {
    out.push({ icon: '🔥', text: `Estender a sua sequência de ${streak} vitórias.` });
  }

  if (out.length === 0) {
    out.push({ icon: '💵', text: 'Bolsa garantida e o bônus de vitória em jogo.' });
  }

  return take(out);
}

// O risco de contexto: o estado com que VOCÊ entra no octógono. Lesão e
// "vindo de derrota" primeiro — são os que mais mudam a decisão de aceitar.
function buildRisk(fighter, offer) {
  const out = [];

  if (fighter.injury) {
    out.push({ icon: '🩹', text: `Você ainda carrega uma lesão (${fighter.injury.description || 'lesionado'}) — chegar 100% é dúvida.` });
  } else if ((fighter.fatigue ?? 0) >= 40) {
    out.push({ icon: '⚡', text: `Fadiga acumulada alta (${fighter.fatigue}) — o corpo não está fresco.` });
  }

  const last = (fighter.fights || [])[0];
  if (last && last.won === false) {
    out.push({ icon: '📉', text: 'Você vem de derrota — o mundo quer ver reação.' });
  }

  if ((fighter.morale ?? 100) <= 40) {
    out.push({ icon: '🧠', text: `Confiança baixa (moral ${fighter.morale}) pesa nos momentos apertados.` });
  }

  if (offer.isShortNotice) {
    out.push({ icon: '🔥', text: 'Short notice: camp curto, preparo incompleto.' });
  }

  const ovrGap = (offer.opponentOverall ?? 0) - (fighter.overallRating ?? 0);
  if (ovrGap >= 5) {
    out.push({ icon: '⚔️', text: `Adversário mais forte no papel (OVR ${offer.opponentOverall} vs ${fighter.overallRating}).` });
  }

  if (offer.opponentWeightBully) {
    out.push({ icon: '⚠️', text: 'Ele corta muito peso — chega bem maior no dia da luta.' });
  }

  if (out.length === 0) {
    out.push({ icon: '✅', text: 'Você entra inteiro e sem desvantagem óbvia.' });
  }

  return take(out);
}

// A consequência de perder: o que a derrota tira. Ranking, sequência,
// confiança, e o cinturão quando é uma defesa.
function buildConsequence(fighter, offer, { playerRank }) {
  const out = [];

  if (offer.isTitleFight && offer.titleRole === TITLE_ROLE.DEFENSE) {
    out.push({ icon: '🏆', text: 'Perder aqui é perder o cinturão.' });
  }

  const inTop = playerRank != null && playerRank <= TOP_TIER_CUTOFF;
  out.push(inTop
    ? { icon: '📉', text: `Derrota ameaça sua posição no Top ${TOP_TIER_CUTOFF} (#${playerRank} hoje).` }
    : { icon: '📉', text: 'Derrota recua você no ranking da divisão.' });

  const streak = fighter.winStreak || 0;
  if (streak >= 2) {
    out.push({ icon: '🔥', text: `Quebra a sua sequência de ${streak} vitórias.` });
  }

  out.push({ icon: '🧠', text: 'Confiança abalada — reflete no próximo camp.' });

  return take(out);
}

export function computeFightStakes(fighter, offer, ctx = {}) {
  const context = {
    playerRank: ctx.playerRank ?? null,
    oppRank: ctx.oppRank ?? null,
    divisionSize: ctx.divisionSize ?? 0,
  };
  return {
    reward: buildReward(fighter, offer, context),
    risk: buildRisk(fighter, offer),
    consequence: buildConsequence(fighter, offer, context),
  };
}
