import { describe, it, expect } from 'vitest';
import { computeFightStakes } from '../js/services/fight-stakes.js';
import { TITLE_ROLE } from '../js/config/game-config.js';

const baseFighter = (over = {}) => ({
  overallRating: 60,
  winStreak: 0,
  injury: null,
  fatigue: 0,
  morale: 75,
  fights: [],
  ...over,
});

const baseOffer = (over = {}) => ({
  opponentOverall: 60,
  isTitleFight: false,
  titleRole: null,
  isShortNotice: false,
  opponentWeightBully: false,
  ...over,
});

const texts = (list) => list.map(i => i.text);

describe('computeFightStakes', () => {
  it('adversário ranqueado à frente e jogador fora do Top 10: recompensa fala em Top 10', () => {
    const s = computeFightStakes(baseFighter(), baseOffer(), { playerRank: 14, oppRank: 8, divisionSize: 20 });
    expect(texts(s.reward).some(t => t.includes('Top 10'))).toBe(true);
  });

  it('adversário atrás no ranking: recompensa não promete salto no ranking', () => {
    const s = computeFightStakes(baseFighter(), baseOffer(), { playerRank: 5, oppRank: 12, divisionSize: 20 });
    expect(texts(s.reward).some(t => t.includes('ranking') || t.includes('Top'))).toBe(false);
  });

  it('defesa de cinturão: recompensa e consequência citam o cinturão', () => {
    const offer = baseOffer({ isTitleFight: true, titleRole: TITLE_ROLE.DEFENSE });
    const s = computeFightStakes(baseFighter(), offer, { playerRank: 1, oppRank: 2, divisionSize: 20 });
    expect(texts(s.reward).some(t => t.toLowerCase().includes('defender o cinturão'))).toBe(true);
    expect(texts(s.consequence).some(t => t.toLowerCase().includes('perder o cinturão'))).toBe(true);
  });

  it('lesão vira o primeiro risco', () => {
    const f = baseFighter({ injury: { description: 'Corte no supercílio' }, fatigue: 90 });
    const s = computeFightStakes(f, baseOffer(), {});
    expect(s.risk[0].text).toContain('lesão');
  });

  it('sem lesão mas fadiga alta: risco cita fadiga', () => {
    const s = computeFightStakes(baseFighter({ fatigue: 55 }), baseOffer(), {});
    expect(texts(s.risk).some(t => t.includes('Fadiga'))).toBe(true);
  });

  it('vindo de derrota entra como risco', () => {
    const s = computeFightStakes(baseFighter({ fights: [{ won: false }] }), baseOffer(), {});
    expect(texts(s.risk).some(t => t.includes('derrota'))).toBe(true);
  });

  it('sem contexto ruim: risco cai no fallback de "entra inteiro"', () => {
    const s = computeFightStakes(baseFighter(), baseOffer(), { playerRank: 5, oppRank: 6, divisionSize: 20 });
    expect(s.risk).toHaveLength(1);
    expect(s.risk[0].text).toContain('inteiro');
  });

  it('nunca passa de 3 itens por coluna', () => {
    const f = baseFighter({ injury: { description: 'x' }, morale: 20, fights: [{ won: false }], winStreak: 4 });
    const offer = baseOffer({ isShortNotice: true, opponentWeightBully: true, opponentOverall: 80, isTitleFight: true, titleRole: TITLE_ROLE.DEFENSE });
    const s = computeFightStakes(f, offer, { playerRank: 3, oppRank: 1, divisionSize: 20 });
    expect(s.reward.length).toBeLessThanOrEqual(3);
    expect(s.risk.length).toBeLessThanOrEqual(3);
    expect(s.consequence.length).toBeLessThanOrEqual(3);
  });
});
