import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { GameController } from '../js/controllers/game-controller.js';
import { RankingService } from '../js/services/ranking.js';

// P8.3 — integration smoke test: cria uma carreira do zero e roda várias
// semanas via o mesmo caminho de "Simular Período" (fast-forward real, não
// um mock), verificando invariantes que bugs de integração costumam quebrar
// silenciosamente: caixa mudou, luta foi registrada em 'fights', rankings
// incluem o lutador. Usa fake-indexeddb porque db.js fala com IndexedDB de
// verdade — sem isso não dá pra exercitar GameController fora do browser.
describe('GameController.simulateWeeks — invariantes de integração', () => {
  it('roda 60 semanas de carreira sem lançar e mantém o estado consistente', async () => {
    const game = new GameController();
    await game.init();

    const fighter = await game.createPlayerFighter({
      name: 'Integration Tester',
      weightClass: 'Lightweight',
      archetype: 'generalist',
      origin: null,
      difficultyId: 'normal',
      academyId: 'academy-blacktiger',
      managerId: null,
    });
    expect(fighter).toBeTruthy();

    // 60 semanas (não 30): oferta aceita pode ser cancelada se o adversário
    // ficar indisponível sem substituto (comportamento real do mundo, não
    // bug) — uma janela curta demais some flakeando esse teste quando isso
    // acontece na 1ª tentativa. 60 dá margem de sobra pra uma 2ª oferta
    // completar mesmo depois de um cancelamento.
    const result = await game.simulateWeeks(60);

    expect(result.weeksSimulated).toBe(60);
    expect(result.offersAccepted).toBeGreaterThanOrEqual(1);

    const endFighter = await game.getPlayerFighter();
    expect(endFighter.cash).not.toBe(fighter.cash);

    const fights = await game.db.getIndex('fights', 'fighterId', endFighter.id);
    expect(fights.length).toBeGreaterThanOrEqual(1);
    expect(result.winsDelta + result.lossesDelta).toBeGreaterThanOrEqual(1);

    const allFighters = await game.fighterCtrl.getAllFighters();
    const rankings = RankingService.calculateRankings(allFighters.filter(f => f.status !== 'retired'));
    expect(rankings).toBeTruthy();
  }, 20000);

  // P9.x — regressão: Flyweight e Light Heavyweight eram selecionáveis na
  // criação de personagem mas ficavam de fora de CORE_WEIGHT_CLASSES, então
  // nenhum lutador de IA nascia nessas divisões — roster inicial, agente
  // livre e draft anual liam só a lista antiga. Escolher qualquer uma das
  // duas travava o jogador numa divisão vazia para sempre (nunca recebia
  // 1 oferta sequer). Testa as duas divisões que eram órfãs.
  it.each(['Flyweight', 'Light Heavyweight'])('divisão %s tem adversários de IA e gera pelo menos 1 oferta em 20 semanas', async (weightClass) => {
    const game = new GameController();
    await game.init();

    await game.createPlayerFighter({
      name: 'Division Tester',
      weightClass,
      archetype: 'generalist',
      origin: null,
      difficultyId: 'normal',
      academyId: 'academy-blacktiger',
      managerId: null,
    });

    const result = await game.simulateWeeks(20);
    expect(result.offersAccepted).toBeGreaterThanOrEqual(1);
  }, 20000);
});
