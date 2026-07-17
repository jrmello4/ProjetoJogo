import { INJURY_CONFIG, absWeek } from '../config/game-config.js';
import { HallOfFame } from '../services/hall-of-fame.js';

// Carreira do lutador: milestones, estágios de lesão, fim de carreira,
// reabilitação. Recebe todas as dependências via construtor.
export class CareerController {
  constructor(db, fighterCtrl, notifService, careerLogService, seasonService, titleService) {
    this.db = db;
    this.fighterCtrl = fighterCtrl;
    this.notifService = notifService;
    this.careerLogService = careerLogService;
    this.seasonService = seasonService;
    this.titleService = titleService;
  }

  async checkMilestones(playerEvents, fighter) {
    const state = await this.db.get('gameState', 'milestones') || {};
    state.id = 'milestones';
    const unlocked = [];
    const bump = (id, value, max) => {
      const prev = state[id] || 0;
      if (prev >= max) return;
      state[id] = value;
      if (value >= max) unlocked.push(id);
    };

    for (const evt of playerEvents) {
      for (const r of evt.playerResults) {
        const playerIsA = evt.playerFighterIds.has(r.fighterAId);
        const playerId = playerIsA ? r.fighterAId : r.fighterBId;
        const won = r.winnerId === playerId;
        const isFinish = r.method && !r.method.startsWith('Decision');

        bump('firstFight', 1, 1);
        if (won) {
          bump('firstWin', 1, 1);
          if (isFinish) bump('firstFinish', 1, 1);
        }
        if (evt.event.tier === 2) bump('firstTier2', 1, 1);
        if (evt.event.tier === 1) bump('firstTier1', 1, 1);

        if (r.isTitleFight) {
          bump('firstTitleShot', 1, 1);
          if (won) {
            if (r.titleRetained) bump('firstDefense', 1, 1);
            else bump('firstBelt', 1, 1);
            if (evt.event.tier === 1) bump('worldChampion', 1, 1);
          }
        }
      }
    }

    bump('fiveWins', Math.min(fighter.record.wins, 5), 5);
    bump('tenWins', Math.min(fighter.record.wins, 10), 10);
    bump('popularity50', Math.min(fighter.popularity, 50), 50);
    bump('popularity80', Math.min(fighter.popularity, 80), 80);

    await this.db.put('gameState', state);
    return unlocked;
  }

  // ===== P2.2: Staged injury recovery =====
  async processInjuryStages(fighter, absWeekNow) {
    if (!fighter.injury || !fighter.injury.stage) return;

    const injury = fighter.injury;

    if (injury.stage === 'rest' && absWeekNow >= injury.restUntilAbsWeek) {
      // Rest stage complete — move to rehab stage
      injury.stage = 'rehab';
      injury.rehabEndAbsWeek = absWeekNow + INJURY_CONFIG.REHAB_FREE_WEEKS;
      await this.notifService.add('injury', 'Lesão em recuperação',
        'Sua lesão entrou na fase de reabilitação. Você pode escolher entre fisioterapia rápida (paga) ou gratuita (mais lenta) no painel principal.');
    }

    if (injury.stage === 'rehab' && injury.rehabChosen && absWeekNow >= injury.rehabEndAbsWeek) {
      // Rehab complete — move to return stage
      injury.stage = 'return';
      injury.restUntilAbsWeek = absWeekNow + INJURY_CONFIG.RETURN_WEEKS;
      fighter.status = 'active';
      await this.notifService.add('injury', 'Retorno gradual',
        'Você está liberado para treinar, mas com intensidade reduzida.');
    }

    if (injury.stage === 'return' && absWeekNow >= (injury.restUntilAbsWeek || 0)) {
      // Fully healed
      fighter.injury = null;
      fighter.status = 'active';
      await this.notifService.add('info', 'Recuperado',
        'Você está 100% recuperado da lesão.');
    }
  }

  // ===== P2.2: Resolve rehab choice =====
  async resolveRehabChoice(choiceKey, fighterId) {
    const fighter = await this.fighterCtrl.getFighter(fighterId);
    if (!fighter?.injury || fighter.injury.stage !== 'rehab' || fighter.injury.rehabChosen) {
      return { ok: false, reason: 'Nenhuma escolha de reabilitação pendente.' };
    }

    const state = await this.seasonService.getState();
    const now = absWeek(state);

    if (choiceKey === 'fast') {
      const cost = INJURY_CONFIG.REHAB_FAST_COST * INJURY_CONFIG.REHAB_FAST_WEEKS;
      if (fighter.cash < cost) {
        return { ok: false, reason: `Você precisa de $${cost} para fisioterapia rápida.` };
      }
      fighter.cash -= cost;
      fighter.injury.rehabEndAbsWeek = now + INJURY_CONFIG.REHAB_FAST_WEEKS;
      fighter.injury.rehabCost = cost;
      fighter.addTransaction(now, 'Fisioterapia rápida', -cost);
    } else {
      // Free rehab — already set in processInjuryStages
      fighter.injury.rehabEndAbsWeek = fighter.injury.rehabEndAbsWeek || (now + INJURY_CONFIG.REHAB_FREE_WEEKS);
    }

    fighter.injury.rehabChosen = true;
    await this.fighterCtrl.updateFighter(fighter);
    // Clear pending signal
    try { await this.db.delete('gameState', 'rehabChoicePrompt'); } catch { /* ok */ }

    const weeks = choiceKey === 'fast' ? INJURY_CONFIG.REHAB_FAST_WEEKS : INJURY_CONFIG.REHAB_FREE_WEEKS;
    return {
      ok: true,
      choice: choiceKey,
      rehabWeeks: weeks,
      cost: choiceKey === 'fast' ? INJURY_CONFIG.REHAB_FAST_COST * INJURY_CONFIG.REHAB_FAST_WEEKS : 0,
    };
  }

  // P5.3: Resolve a escolha de fim de carreira do jogador
  async resolveEndCareer(fighterId, choiceKey) {
    const fighter = await this.fighterCtrl.getFighter(fighterId);
    const state = await this.seasonService.getState();
    const absWeekNow = absWeek(state);

    switch (choiceKey) {
      case 'dignified':
        fighter.status = 'retired';
        fighter.updatePopularity(15);
        // Force Hall of Fame induction
        await HallOfFame.forceInduct(this.db, fighter, ['Aposentadoria Digna — Legado Preservado']);
        await this.notifService.add('success', '👑 Aposentadoria Digna', 'Você pendurou as luvas no auge. A torcida aplaude de pé.');
        break;

      case 'last_fight':
        // Allow one more fight, then force retirement
        fighter.lastFightPending = true;
        fighter.lastFightBonus = 2.0; // 2x purse
        await this.notifService.add('info', '🥊 Última Luta', 'Só mais uma. Você sabe que é arriscado, mas a bolsa é tentadora.');
        break;

      case 'fight_til_end':
        fighter.fightTilEnd = true;
        fighter.retirementWindow = 999; // effectively indefinite
        await this.notifService.add('warning', '🔥 Até o Fim', 'Você vai sair quando QUISER. Mas seu corpo já não é o mesmo.');
        break;

      case 'become_coach':
        fighter.status = 'retired';
        // Store as coach for New Game+ bonus
        localStorage.setItem('mma_coach_legacy', JSON.stringify({
          coachName: fighter.name,
          bonusType: 'attribute_cap',
          bonusValue: 5,
          retiredAtAbsWeek: absWeekNow,
        }));
        await this.notifService.add('success', '📋 Virou Técnico', 'Uma nova geração precisa de você. Bônus desbloqueado para a próxima carreira!');
        break;

      case 'commentator':
        fighter.status = 'retired';
        fighter.passiveIncome = 500; // $500/week
        fighter.organizationId = null;
        fighter.academyId = null;
        await this.notifService.add('success', '🎙️ Comentarista', 'Sua voz vale ouro. Renda passiva de $500/semana garantida.');
        break;

      default:
        return { ok: false, reason: 'Escolha inválida.' };
    }

    // Publish to career log
    if (this.careerLogService) {
      await this.careerLogService.publish(fighter.id, 'end_career_choice', absWeekNow, 90, { choice: choiceKey });
    }

    // Clear the prompt
    const state2 = await this.seasonService.getState();
    state2.endCareerPrompt = false;
    await this.db.put('gameState', state2);
    await this.fighterCtrl.updateFighter(fighter);

    return { ok: true, choice: choiceKey };
  }
}
