import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../js/controllers/simulation.js';
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

async function winRate(n, attrsA, attrsB = BASE_ATTRS) {
  let winsA = 0;
  for (let i = 0; i < n; i++) {
    const a = makeFighter({ id: 'a', attributes: attrsA });
    const b = makeFighter({ id: 'b', attributes: attrsB });
    const result = await SimulationEngine.simulateFight(a, b);
    if (!result.isDraw && result.winnerId === a.id) winsA++;
  }
  return winsA / n;
}

// Regressão: sem o fator de "forma" por luta (formA/formB em simulateFight),
// dois lutadores idênticos ainda dão ~50/50, mas uma vantagem de +5 a +10 em
// TODOS os atributos batia 98-100% de vitória em 3000 lutas simuladas —
// qualquer treino vira vitória garantida, sem chance de zebra. Ver
// scripts/balance-harness.mjs pro diagnóstico completo.
describe('Balanceamento do motor de simulação', () => {
  it('lutadores idênticos ficam perto de 50/50 (sem viés estrutural de posição)', async () => {
    const rate = await winRate(600, BASE_ATTRS);
    expect(rate).toBeGreaterThan(0.42);
    expect(rate).toBeLessThan(0.58);
  }, 20000);

  it('vantagem pequena (+5 em tudo) favorece mas não garante vitória', async () => {
    const boosted = Object.fromEntries(Object.entries(BASE_ATTRS).map(([k, v]) => [k, v + 5]));
    const rate = await winRate(600, boosted);
    expect(rate).toBeGreaterThan(0.55); // favorito real
    expect(rate).toBeLessThan(0.92); // mas não determinístico
  }, 20000);

  it('vantagem moderada (+10 em tudo) não satura em 100% garantido', async () => {
    const boosted = Object.fromEntries(Object.entries(BASE_ATTRS).map(([k, v]) => [k, v + 10]));
    const rate = await winRate(600, boosted);
    expect(rate).toBeGreaterThan(0.7);
    expect(rate).toBeLessThan(1); // underdog tem que ter chance, mesmo pequena
  }, 20000);
});
