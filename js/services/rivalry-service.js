import { Rivalry } from '../models/rivalry.js';
import { ACADEMIES, RIVALRY_CONFIG } from '../config/game-config.js';

export class RivalryService {
  // careerLogService (opcional/nullable, mesmo padrão de SponsorService) —
  // sem ele, a derivação de tipo 'grudge' (§D.3) simplesmente não dispara,
  // igual ao fail-safe já usado em SponsorService._checkImageClauseBroken.
  constructor(db, careerLogService = null) {
    this.db = db;
    this.careerLogService = careerLogService;
  }

  async getRivalries(fighterId) {
    const all = await this.db.getAll('rivalries');
    return all
      .filter(r => r.active && (r.fighterAId === fighterId || r.fighterBId === fighterId))
      .map(r => new Rivalry(r));
  }

  async getRivalryBetween(fighterAId, fighterBId) {
    const all = await this.db.getAll('rivalries');
    const found = all.find(r =>
      r.active &&
      ((r.fighterAId === fighterAId && r.fighterBId === fighterBId) ||
       (r.fighterAId === fighterBId && r.fighterBId === fighterAId))
    );
    return found ? new Rivalry(found) : null;
  }

  async createRivalry(fighterAId, fighterBId, type = 'competitive') {
    const existing = await this.getRivalryBetween(fighterAId, fighterBId);
    if (existing) return existing;

    const rivalry = new Rivalry({
      id: 'rvl-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      fighterAId,
      fighterBId,
      intensity: 1,
      type,
      history: [{ type: 'created', description: 'Rivalidade formada após luta' }],
    });

    await this.db.put('rivalries', rivalry);
    return rivalry;
  }

  // atAbsWeek (opcional): semana atual, usada só pra janela de busca do
  // careerLog na derivação de tipo 'grudge' (§D.3). Sem ela, a checagem de
  // grudge é pulada (ainda funciona a de 'robbery', que não depende de semana).
  // playerFighterId (opcional): só publica 'rivalry_born' (§F) se a
  // rivalidade recém-criada envolver o lutador do jogador — este método só é
  // chamado hoje com lutas do jogador, mas o parâmetro deixa isso explícito
  // em vez de implícito no call site.
  async checkPostFight(fighterA, fighterB, result, isMainCard, atAbsWeek = null, playerFighterId = null) {
    const existing = await this.getRivalryBetween(fighterA.id, fighterB.id);

    if (existing) {
      // Wrap plain DB object in Rivalry instance
      const rivalry = new Rivalry(existing);
      rivalry.increaseIntensity(1);
      rivalry.addEvent('rematch', `Rematch — ${result.winnerName} venceu`);

      // §D.3 — uma rivalidade que ainda não tem identidade própria
      // ('competitive', o default) pode ganhar uma origem retroativa se
      // ESTE rematch for controverso ou se uma provocação recente colou
      // nela. Nunca rebaixa uma rivalidade já identificada como
      // 'grudge'/'robbery' de volta pra 'competitive'.
      if (rivalry.type === 'competitive') {
        rivalry.type = await this._deriveType(fighterA.id, fighterB.id, result, atAbsWeek, rivalry.type);
      }

      await this.db.put('rivalries', rivalry);
      return rivalry;
    }

    // Criar nova rivalidade se luta foi close ou main card
    const isClose = Math.abs((result.totalScoreA || 0) - (result.totalScoreB || 0)) < 10;
    const shouldCreate = isMainCard || isClose;

    if (shouldCreate) {
      const fallback = isClose ? 'competitive' : 'personal';
      const type = await this._deriveType(fighterA.id, fighterB.id, result, atAbsWeek, fallback);
      const rivalry = await this.createRivalry(fighterA.id, fighterB.id, type);

      if (this.careerLogService && atAbsWeek != null) {
        const isPlayerA = fighterA.id === playerFighterId;
        const isPlayerB = fighterB.id === playerFighterId;
        if (isPlayerA || isPlayerB) {
          const opponentName = isPlayerA ? fighterB.name : fighterA.name;
          await this.careerLogService.publish(playerFighterId, 'rivalry_born', atAbsWeek, 35, { opponentName, type });
        }
      }

      return rivalry;
    }

    return null;
  }

  // §D.3 — deriva a origem/identidade da rivalidade a partir da luta
  // gatilho e do careerLog (§D.1). Prioridade: 'robbery' (decisão
  // controversa nesta luta) > 'grudge' (provocação recente mirando um dos
  // dois) > fallback (comportamento anterior, preservado pra não quebrar a
  // distinção 'competitive'/'personal' que já existia aqui).
  async _deriveType(fighterAId, fighterBId, result, atAbsWeek, fallback = 'competitive') {
    if (this._isRobberyMethod(result?.method)) return 'robbery';
    if (await this._hasRecentGrudgeSpark(fighterAId, fighterBId, atAbsWeek)) return 'grudge';
    return fallback;
  }

  _isRobberyMethod(method) {
    return !!method && (method.startsWith('Decision (Split)') || method.startsWith('Decision (Majority)'));
  }

  // A entrada 'provocation' do careerLog (publicada por
  // GameController.resolveSocialPrompt, §D.2) só guarda `targetFighterId`
  // (quem foi provocado) — não guarda quem provocou, porque hoje só o
  // jogador tem a opção de provocar nas redes. "Referencia os dois
  // lutadores da rivalidade" então quer dizer, na prática: o alvo é um dos
  // dois (o outro é implicitamente quem provocou).
  async _hasRecentGrudgeSpark(fighterAId, fighterBId, atAbsWeek) {
    if (!this.careerLogService || atAbsWeek == null) return false;
    const recent = await this.careerLogService.recentSince(atAbsWeek, RIVALRY_CONFIG.GRUDGE_LOOKBACK_WEEKS);
    return recent.some(e =>
      e.type === 'provocation' &&
      (e.data?.targetFighterId === fighterAId || e.data?.targetFighterId === fighterBId)
    );
  }

  async getAllActive() {
    const all = await this.db.getAll('rivalries');
    return all.filter(r => r.active).map(r => new Rivalry(r));
  }

  // Decaimento periódico — sem isso a rivalidade mais intensa de anos atrás
  // (mesmo que a causa já não exista mais) nunca perde espaço pra uma nova.
  // Chamado do WorldService a cada RIVALRY_CONFIG.DECAY_INTERVAL_WEEKS.
  // Desativa (`active = false`) quem chega a 0 — deixa de monopolizar
  // seleção, mas o histórico continua no banco.
  async decayAll(amount = RIVALRY_CONFIG.DECAY_AMOUNT) {
    const active = await this.getAllActive();
    for (const rivalry of active) {
      rivalry.intensity = Math.max(0, rivalry.intensity - amount);
      if (rivalry.intensity <= 0) rivalry.active = false;
      await this.db.put('rivalries', rivalry);
    }
  }

  // Épico F1: a provocação na coletiva de imprensa esquenta a rivalidade
  // antes da luta acontecer. Quanto maior o hype, maior o heat gerado.
  // Se não existe rivalidade ainda, cria uma com intensity baseada no hype.
  async addPressConferenceHeat(fighterAId, fighterBId, hypeLevel, promotionId = null) {
    const existing = await this.getRivalryBetween(fighterAId, fighterBId);
    const intensityGain = Math.ceil(hypeLevel / 8); // hype 15 → +2, hype 25 → +4

    if (existing) {
      const rivalry = new Rivalry(existing);
      const oldIntensity = rivalry.intensity;
      rivalry.increaseIntensity(intensityGain);
      const heatLabel = rivalry.intensity > oldIntensity ? 'intensificou' : 'permanece';
      rivalry.addEvent('press_conference', `Provocação na coletiva — hype ${hypeLevel} (${heatLabel} para ${rivalry.intensity})`);
      await this.db.put('rivalries', rivalry);
      return rivalry;
    }

    // Hype mínimo para criar rivalidade pré-luta
    if (hypeLevel < 15) return null;

    const rivalry = new Rivalry({
      id: 'rvl-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      fighterAId,
      fighterBId,
      intensity: Math.min(intensityGain, 3),
      type: hypeLevel >= 22 ? 'personal' : 'competitive',
      history: [{ type: 'press_conference', description: `Rivalidade nascida na coletiva — provocação gerou hype ${hypeLevel}` }],
    });

    await this.db.put('rivalries', rivalry);
    return rivalry;
  }

  // Gera prompt semanal de interação com rival. Retorna null se não houver
  // prompt esta semana, ou um objeto { rivalryId, rivalName, rivalPersonality,
  //   rivalPop, choices: [{ key, text }] }.
  // Gatilho: rivalidade ativa intensidade >= 3, chance 30%.
  rollInteraction(fighter, rivalFighter) {
    if (Math.random() > RIVALRY_CONFIG.INTERACTION_WEEKLY_CHANCE) return null;

    const personality = rivalFighter?.academyId
      ? (ACADEMIES.find(a => a.id === rivalFighter.academyId)?.headCoach?.personality || 'cautious')
      : 'cautious';

    return {
      rivalryId: null, // preenchido pelo caller
      rivalName: rivalFighter?.name || 'Rival',
      rivalPersonality: personality,
      rivalPop: rivalFighter?.popularity || 0,
      choices: [
        { key: 'provoke', text: `Provocar ${rivalFighter?.name || 'o rival'} publicamente` },
        { key: 'respect', text: `Respeitar ${rivalFighter?.name || 'o rival'} — "é um guerreiro, mas vou vencer"` },
        { key: 'ignore', text: 'Ignorar — sem comentários' },
      ],
    };
  }
}
