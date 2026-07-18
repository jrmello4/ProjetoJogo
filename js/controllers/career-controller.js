import { INJURY_CONFIG, INJURY_SEVERITY, absWeek } from '../config/game-config.js';
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
  // Fluxo baseado no processo real (ABC/NSAC/CABMMA): repouso -> reavaliação
  // médica -> retorno gradual -> liberação oficial. Concussão e fratura
  // pedem uma reavaliação mais explícita (o relatório de comissões médicas
  // cita CT/MRI/exame neurológico como pré-requisito de liberação nesses
  // dois casos especificamente).
  async processInjuryStages(fighter, absWeekNow) {
    if (!fighter.injury || !fighter.injury.stage) return;

    const injury = fighter.injury;
    const label = injury.type ? INJURY_SEVERITY[injury.type]?.label : null;
    const needsExam = injury.type === 'concussion' || injury.type === 'fracture';

    if (injury.stage === 'rest' && absWeekNow >= injury.restUntilAbsWeek) {
      // Rest stage complete — move to rehab stage
      injury.stage = 'rehab';
      injury.rehabEndAbsWeek = absWeekNow + INJURY_CONFIG.REHAB_FREE_WEEKS;
      await this.notifService.add('injury', 'Lesão em recuperação',
        `${label ? `Sua ${label.toLowerCase()}` : 'Sua lesão'} entrou na fase de reabilitação.${needsExam ? ' A comissão médica exige reavaliação por imagem/exame neurológico antes da liberação.' : ''} Você pode escolher entre fisioterapia rápida (paga) ou gratuita (mais lenta) no painel principal.`);
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
        'Liberação médica oficial — você está 100% recuperado.');
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

  // Indução forçada (se ainda não existe) + aponta a cerimônia de
  // aposentadoria pra este lutador. Sem isso, gameState.meta.
  // lastRetirementFighterId nunca era setado pra escolhas do próprio
  // jogador (só o sorteio de aposentadoria por idade de NPCs setava, e
  // aquele branch é inalcançável pro jogador — ver world-service.js
  // _processYearEnd, que dá `continue` no lutador do jogador antes de
  // chegar lá) — a cerimônia (RetirementCeremonyView) sempre caía pro Hall
  // da Fama comum, nunca abria de verdade.
  async _markRetirementForCeremony(fighter, reasons) {
    // Hall da Fama só pra quem MERECE (mesmos critérios dos NPCs). A
    // cerimônia, todo aposentado tem — via snapshot guardado no gameState,
    // não via entrada forçada no Hall (o forceInduct antigo enchia o Hall
    // de lutadores sem currículo).
    await HallOfFame.inductIfEligible(this.db, fighter, reasons);
    const state = await this.seasonService.getState();
    state.meta = state.meta || {};
    state.meta.lastRetirementFighterId = fighter.id;
    state.meta.retirementCeremonyEntry = HallOfFame.buildEntry(fighter, reasons);
    await this.db.put('gameState', state);
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
        await this._markRetirementForCeremony(fighter, ['Aposentadoria Digna — Legado Preservado']);
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
        await this._markRetirementForCeremony(fighter, ['Virou Técnico — Legado Repassado']);
        await this.notifService.add('success', '📋 Virou Técnico', 'Uma nova geração precisa de você. Bônus desbloqueado para a próxima carreira!');
        break;

      case 'commentator':
        fighter.status = 'retired';
        fighter.passiveIncome = 500; // $500/week
        fighter.organizationId = null;
        fighter.academyId = null;
        await this._markRetirementForCeremony(fighter, ['Virou Comentarista — Voz do Esporte']);
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
