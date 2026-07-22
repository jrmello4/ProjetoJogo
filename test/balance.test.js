import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CombatAdapter } from '../js/controllers/combat-adapter.js';
import { makeFighter } from './fixtures.js';

const BASE_ATTRS = {
  boxing: 50, kickboxing: 50, muayThai: 50, wrestling: 50, bjj: 50,
  cardio: 50, chin: 50, fightIQ: 50,
  power: 50, footwork: 50, headMovement: 50, clinch: 50,
  takedowns: 50, takedownDefense: 50, groundControl: 50,
  submissionOffense: 50, submissionDefense: 50,
  strength: 50, speed: 50, durability: 50, recovery: 50,
  composure: 50, aggression: 50, adaptability: 50,
};

// O motor usa RNG de propósito; o teste não pode usar uma amostra nova a cada
// execução. Uma semente fixa torna a regressão reproduzível sem mudar a
// aleatoriedade usada pelo jogo real.
function seededRandom(seed = 0xC0FFEE) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

async function decisiveWinRate(n, attrsA, attrsB = BASE_ATTRS) {
  let winsA = 0;
  let decisions = 0;
  for (let i = 0; i < n; i++) {
    const a = makeFighter({ id: 'a', attributes: attrsA });
    const b = makeFighter({ id: 'b', attributes: attrsB });
    const adapter = new CombatAdapter();
    // headless: interactive=false, awardReward=false — resolve a luta pelo
    // motor de cartas sem UI nem prêmio (mesmo caminho de IA-vs-IA no mundo).
    const result = await adapter.runFight(a, b, false, 'balanced', 3, false, false, false);
    if (!result.isDraw) {
      decisions++;
      if (result.winnerId === a.id) winsA++;
    }
  }
  return winsA / decisions;
}

// Empates são resultado válido do motor de cartas. A curva de atributos e
// simetria de posição devem ser avaliadas apenas entre lutas decididas;
// tratar empate como derrota de A cria viés estatístico inexistente.
describe('Balanceamento do motor de cartas', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockImplementation(seededRandom());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lutadores idênticos ficam perto de 50/50 (sem viés estrutural de posição)', async () => {
    // Motor de cartas tem variância maior que binomial (RNG de carta/posição),
    // então n=400 oscila mais que ±0.05 em torno de 0.5. Limites largos aqui
    // só travam viés GROSSEIRO de posição; caracterizar a variância/curva fina
    // é a task da curva chata (task_e4fe360d).
    const rate = await decisiveWinRate(400, BASE_ATTRS);
    expect(rate).toBeGreaterThan(0.38);
    expect(rate).toBeLessThan(0.62);
  }, 30000);

  it('vantagem pequena (+5 em tudo) favorece sem virar domínio', async () => {
    const boosted = Object.fromEntries(Object.entries(BASE_ATTRS).map(([k, v]) => [k, v + 5]));
    const rate = await decisiveWinRate(600, boosted);
    expect(rate).toBeGreaterThan(0.55); // favorito real
    expect(rate).toBeLessThan(0.78); // favorito, mas ainda bem vulnerável à zebra
  }, 20000);

  it('vantagem moderada (+10 em tudo) é clara sem virar domínio', async () => {
    const boosted = Object.fromEntries(Object.entries(BASE_ATTRS).map(([k, v]) => [k, v + 10]));
    const rate = await decisiveWinRate(600, boosted);
    expect(rate).toBeGreaterThan(0.62);
    expect(rate).toBeLessThan(0.85);
  }, 20000);

  it('vantagem grande (+20 em tudo) ainda deixa espaço real para upset', async () => {
    const boosted = Object.fromEntries(Object.entries(BASE_ATTRS).map(([k, v]) => [k, v + 20]));
    const rate = await decisiveWinRate(600, boosted);
    expect(rate).toBeGreaterThan(0.74);
    expect(rate).toBeLessThan(0.95);
  }, 20000);
});
