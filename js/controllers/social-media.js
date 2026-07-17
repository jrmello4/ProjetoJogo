import { SOCIAL_CONFIG } from '../config/game-config.js';

// Redes sociais como sistema contínuo — ver spec §D.2. ESTENDE o mesmo
// espírito de `PressConference` (js/controllers/press-conference.js) mas
// roda em semanas LIVRES (sem luta marcada), não na semana de luta. Efeitos
// deliberadamente pequenos e auto-contidos: isto NÃO é `pcHype` (bônus de
// bolsa da coletiva pré-luta) — só popularidade/moral diretos, mais o
// registro de provocação que o SponsorService já espera (careerLog
// type 'provocation', ver `services/sponsor-service.js::_checkImageClauseBroken`).
export class SocialMedia {
  // Monta a lista de escolhas disponíveis nesta rodada. `hasActiveRival`
  // controla se a opção de provocar aparece (§D.2: "só oferecer essa opção
  // se existe uma rivalidade ativa").
  static getChoices({ hasActiveRival, rivalName } = {}) {
    const choices = [];

    if (hasActiveRival) {
      choices.push({
        key: 'provoke',
        text: `Provocar ${rivalName || 'seu rival'} publicamente`,
        hint: 'Pode aumentar sua popularidade, mas é arriscado',
      });
    }

    choices.push({
      key: 'title_shot',
      text: 'Pedir uma chance de título publicamente',
      hint: 'Depende do seu momento na carreira...',
    });

    choices.push({
      key: 'respond_critics',
      text: 'Responder às críticas',
      hint: 'Uma resposta segura, sem grandes riscos',
    });

    choices.push({
      key: 'stay_quiet',
      text: 'Manter postura profissional e ficar quieto',
      hint: 'Postura profissional, sempre uma escolha sólida',
    });

    return choices;
  }

  // §D.2 — se o lutador tem contrato de promoção e um cartel decente, o
  // pedido público de chance de título soa plausível em vez de arrogante.
  static isPlausibleTitleContender(fighter) {
    if (!fighter?.promotionContract) return false;
    const wins = fighter.record?.wins || 0;
    const losses = fighter.record?.losses || 0;
    return wins >= SOCIAL_CONFIG.TITLE_SHOT_MIN_WINS && wins > losses;
  }

  // P6.1: Recupera evento recente do careerLog (se disponível)
  static _getRecentCareerEvent(careerLog) {
    if (!Array.isArray(careerLog) || careerLog.length === 0) return null;
    return careerLog[0]; // mais recente primeiro
  }

  // P6.1: Gera opções baseadas no contexto atual da carreira.
  // Usa dados do fighter (última luta, sequência, ranking) para
  // oferecer escolhas temáticas em vez das 4 estáticas originais.
  static getContextualChoices(fighter, { hasActiveRival, rivalName, careerLog } = {}) {
    const choices = [];
    const lastFight = fighter.fights?.[0];
    const streak = fighter.winStreak || 0;
    const isChampion = fighter.ranking === 1 || (fighter.titlesWon || 0) > 0;
    const recentEvent = this._getRecentCareerEvent(careerLog);

    // APÓS DERROTA
    if (lastFight && lastFight.won === false) {
      choices.push({
        key: 'apologize',
        text: 'Pedir desculpas aos fãs — "Deixei vocês na mão"',
        hint: 'Popularidade pode se recuperar, moral cai um pouco',
        context: 'after_loss',
      });
      choices.push({
        key: 'blame_prep',
        text: ' culpar a preparação — "O camp não funcionou"',
        hint: 'Arriscado: alguns respeitam a honestidade, outros criticam',
        context: 'after_loss',
      });
      choices.push({
        key: 'stay_quiet',
        text: 'Manter postura profissional',
        hint: 'Seguro, sem riscos',
        context: 'default',
      });
      return choices;
    }

    // SEQUÊNCIA DE VITÓRIAS (3+)
    if (streak >= 3) {
      choices.push({
        key: 'call_champ',
        text: 'Desafiar o campeão publicamente',
        hint: isChampion ? 'Defender seu legado' : 'Grande risco, grande recompensa',
        context: 'hot_streak',
      });
      choices.push({
        key: 'celebrate_humble',
        text: 'Comemorar com humildade',
        hint: 'Sólido, constrói base de fãs leais',
        context: 'hot_streak',
      });
      if (streak >= 5) {
        choices.push({
          key: 'trash_talk',
          text: 'Provocar toda a divisão',
          hint: '🔥 Máximo risco, pode viralizar ou destruir sua reputação',
          context: 'hot_streak',
        });
      }
      choices.push({
        key: 'stay_quiet',
        text: 'Foco no próximo desafio',
        hint: 'Profissional, sem exageros',
        context: 'default',
      });
      return choices;
    }

    // APÓS VITÓRIA IMPORTANTE (luta de título ou main event)
    if (lastFight && lastFight.won && (lastFight.cardPosition === 'main_event' || lastFight.isTitleFight)) {
      choices.push({
        key: 'celebrate_hard',
        text: 'Comemorar exageradamente — festa, fotos, status',
        hint: '🔥 Popularidade sobe, mas risco de backlash ou multa do contrato',
        context: 'big_win',
      });
      choices.push({
        key: 'thank_team',
        text: 'Agradecer à equipe — "Sem eles nada disso seria possível"',
        hint: 'Constrói vínculo com a academia, popularidade moderada',
        context: 'big_win',
      });
      choices.push({
        key: 'call_next',
        text: 'Nomear o próximo desafiante — "Quero enfrentar X"',
        hint: 'Cria hype para a próxima luta, irrita o oponente nomeado',
        context: 'big_win',
      });
      return choices;
    }

    // CONTEXTO PADRÃO (semana normal)
    if (hasActiveRival) {
      choices.push({
        key: 'provoke',
        text: `Provocar ${rivalName || 'seu rival'} publicamente`,
        hint: 'Pode aumentar popularidade, mas é arriscado',
        context: 'default',
      });
    }
    choices.push({
      key: 'title_shot',
      text: 'Pedir chance de título',
      hint: 'Depende do seu momento na carreira',
      context: 'default',
    });
    choices.push({
      key: 'training_update',
      text: 'Postar vídeo de treino — "Evolução constante"',
      hint: 'Conteúdo seguro, popularidade modesta',
      context: 'default',
    });
    choices.push({
      key: 'fan_interaction',
      text: 'Responder perguntas de fãs — Q&A ao vivo',
      hint: 'Fortalece base de fãs, constrói lealdade',
      context: 'default',
    });
    choices.push({
      key: 'stay_quiet',
      text: 'Manter postura profissional',
      hint: 'Sempre uma escolha sólida',
      context: 'default',
    });

    return choices;
  }

  // P6.1: Aplica postagem contextual com viral/backfire.
  // Para choices novas, aplica os efeitos diretamente com chance de
  // viralizar (efeito amplificado) ou backfire (efeito negativo).
  // Para choices antigas (provoke, title_shot, respond_critics),
  // delega para applyChoice() e depois aplica viral/backfire em cima.
  // stay_quiet nunca viraliza nem backfire (não é uma postagem).
  static applyContextualChoice(fighter, key, context = {}) {
    const pop = fighter.popularity || 50;
    const viralChance = 0.03 + (pop / 100) * 0.04;    // 3-7% conforme popularidade
    const backfireChance = 0.02 + (1 - pop / 100) * 0.04; // 6-2%

    // Constrói contexto old-style para fallback de choices antigas
    const oldContext = {
      plausibleTitleContender: this.isPlausibleTitleContender(fighter),
      streakActive: (fighter.winStreak || 0) >= 2,
      lostRecent: fighter.fights?.[0]?.won === false,
    };

    const result = { provoked: false, viral: false, backfire: false, effects: {}, rivalResponse: null };

    switch (key) {
      case 'apologize': {
        const popGain = 2 + Math.floor(Math.random() * 5);
        const moraleCost = -(2 + Math.floor(Math.random() * 4));
        fighter.updatePopularity(popGain);
        fighter.applyMoraleChange(moraleCost);
        result.effects = { popularity: popGain, morale: moraleCost };
        break;
      }
      case 'blame_prep': {
        const popGain = Math.floor(Math.random() * 7) - 1; // -1 a 5
        fighter.updatePopularity(popGain);
        fighter.applyMoraleChange(-3);
        result.effects = { popularity: popGain, morale: -3 };
        break;
      }
      case 'call_champ': {
        const basePop = 2 + Math.floor(Math.random() * 6);
        fighter.updatePopularity(basePop);
        if (context?.isChampion) {
          fighter.applyMoraleChange(3);
          result.effects = { popularity: basePop, morale: 3 };
        } else {
          fighter.applyMoraleChange(-2);
          result.effects = { popularity: basePop, morale: -2 };
        }
        break;
      }
      case 'celebrate_humble': {
        const popGain = 1 + Math.floor(Math.random() * 4);
        fighter.updatePopularity(popGain);
        fighter.applyMoraleChange(2);
        result.effects = { popularity: popGain, morale: 2 };
        break;
      }
      case 'trash_talk': {
        const popGain = 3 + Math.floor(Math.random() * 10);
        const moraleCost = -(1 + Math.floor(Math.random() * 5));
        fighter.updatePopularity(popGain);
        fighter.applyMoraleChange(moraleCost);
        result.provoked = true;
        result.effects = { popularity: popGain, morale: moraleCost };
        break;
      }
      case 'celebrate_hard': {
        const popGain = 2 + Math.floor(Math.random() * 8);
        const moraleGain = 3 + Math.floor(Math.random() * 5);
        fighter.updatePopularity(popGain);
        fighter.applyMoraleChange(moraleGain);
        fighter.fatigue = Math.min(100, (fighter.fatigue || 0) + 10);
        result.effects = { popularity: popGain, morale: moraleGain, fatigue: 10 };
        break;
      }
      case 'thank_team': {
        const popGain = 1 + Math.floor(Math.random() * 3);
        fighter.updatePopularity(popGain);
        fighter.applyMoraleChange(3);
        result.effects = { popularity: popGain, morale: 3 };
        break;
      }
      case 'call_next': {
        const popGain = 2 + Math.floor(Math.random() * 5);
        fighter.updatePopularity(popGain);
        result.provoked = true; // o oponente nomeado pode responder
        result.effects = { popularity: popGain, morale: 0 };
        break;
      }
      case 'training_update': {
        const popGain = Math.floor(Math.random() * 3);
        fighter.updatePopularity(popGain);
        result.effects = { popularity: popGain, morale: 0 };
        break;
      }
      case 'fan_interaction': {
        const popGain = 1 + Math.floor(Math.random() * 3);
        fighter.updatePopularity(popGain);
        fighter.applyMoraleChange(2);
        result.effects = { popularity: popGain, morale: 2 };
        break;
      }
      // Choices legadas — delega para applyChoice() e depois aplica
      // viral/backfire em cima (stay_quiet é uma não-postagem, sem viral).
      case 'provoke':
      case 'title_shot':
      case 'respond_critics': {
        const old = this.applyChoice(fighter, key, oldContext);
        Object.assign(result, old);
        break;
      }
      case 'stay_quiet':
      default: {
        const old = this.applyChoice(fighter, key, oldContext);
        Object.assign(result, old);
        return result; // sem viral/backfire — não é uma postagem
      }
    }

    // Viral check — só para postagens reais
    if (Math.random() < viralChance) {
      result.viral = true;
      result.effects.popularity = (result.effects.popularity || 0) + 3;
      fighter.updatePopularity(3);
    }

    // Backfire check
    if (Math.random() < backfireChance) {
      result.backfire = true;
      const penalty = -(1 + Math.floor(Math.random() * 4));
      result.effects.popularity = (result.effects.popularity || 0) + penalty;
      fighter.updatePopularity(penalty);
    }

    return result;
  }

  // Aplica a escolha. Muta `fighter` (popularidade/moral) — o chamador
  // persiste. Retorna { effects, provoked, viral } — `provoked` diz ao
  // chamador se precisa publicar careerLog + mexer na rivalidade; `viral`
  // indica que o post teve alcance excepcional.
  static applyChoice(fighter, key, { plausibleTitleContender = false, streakActive = false, lostRecent = false } = {}) {
    switch (key) {
      case 'provoke': {
        const basePop = 2 + Math.floor(Math.random() * 4);        // 2-5
        const baseMorale = -(1 + Math.floor(Math.random() * 5));  // -1 a -5
        const viral = fighter.popularity > 50 && Math.random() < 0.08;
        const streakBonus = streakActive ? 2 : 0;
        const lossPenalty = lostRecent ? 2 : 0;
        const popGain = basePop + (viral ? 6 : 0) + streakBonus;
        const moraleCost = baseMorale - lossPenalty;
        fighter.updatePopularity(popGain);
        fighter.applyMoraleChange(moraleCost);
        return { provoked: true, viral, effects: { popularity: popGain, morale: moraleCost } };
      }
      case 'title_shot': {
        if (plausibleTitleContender) {
          const pop = 1 + Math.floor(Math.random() * 4); // 1-4
          fighter.updatePopularity(pop);
          return { provoked: false, effects: { popularity: pop, morale: 0 } };
        }
        const moralePenalty = -(2 + Math.floor(Math.random() * 5)); // -2 a -6
        fighter.applyMoraleChange(moralePenalty);
        return { provoked: false, effects: { popularity: 0, morale: moralePenalty } };
      }
      case 'respond_critics': {
        const pop = Math.floor(Math.random() * 3); // 0-2
        fighter.updatePopularity(pop);
        return { provoked: false, effects: { popularity: pop, morale: 0 } };
      }
      case 'stay_quiet':
      default: {
        const morale = 1 + Math.floor(Math.random() * 4); // 1-4
        fighter.applyMoraleChange(morale);
        return { provoked: false, effects: { popularity: 0, morale } };
      }
    }
  }
}
