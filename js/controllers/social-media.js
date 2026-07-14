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
