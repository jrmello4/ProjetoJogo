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
        hint: `Popularidade +${SOCIAL_CONFIG.PROVOKE_POPULARITY}, risco de moral`,
      });
    }

    choices.push({
      key: 'title_shot',
      text: 'Pedir uma chance de título publicamente',
      hint: 'Só rende bem se você já tem crédito para isso',
    });

    choices.push({
      key: 'respond_critics',
      text: 'Responder às críticas',
      hint: 'Pequeno e neutro',
    });

    choices.push({
      key: 'stay_quiet',
      text: 'Manter postura profissional e ficar quieto',
      hint: `Moral +${SOCIAL_CONFIG.STAY_QUIET_MORALE}`,
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
  // persiste. Retorna { effects, provoked } — `provoked` diz ao chamador
  // se precisa publicar careerLog + mexer na rivalidade.
  static applyChoice(fighter, key, { plausibleTitleContender = false } = {}) {
    switch (key) {
      case 'provoke': {
        fighter.updatePopularity(SOCIAL_CONFIG.PROVOKE_POPULARITY);
        fighter.applyMoraleChange(SOCIAL_CONFIG.PROVOKE_MORALE_RISK);
        return {
          provoked: true,
          effects: { popularity: SOCIAL_CONFIG.PROVOKE_POPULARITY, morale: SOCIAL_CONFIG.PROVOKE_MORALE_RISK },
        };
      }
      case 'title_shot': {
        if (plausibleTitleContender) {
          fighter.updatePopularity(SOCIAL_CONFIG.TITLE_SHOT_POPULARITY);
          return { provoked: false, effects: { popularity: SOCIAL_CONFIG.TITLE_SHOT_POPULARITY, morale: 0 } };
        }
        fighter.applyMoraleChange(SOCIAL_CONFIG.TITLE_SHOT_EMBARRASSMENT_MORALE);
        return { provoked: false, effects: { popularity: 0, morale: SOCIAL_CONFIG.TITLE_SHOT_EMBARRASSMENT_MORALE } };
      }
      case 'respond_critics': {
        fighter.updatePopularity(SOCIAL_CONFIG.RESPOND_CRITICS_POPULARITY);
        return { provoked: false, effects: { popularity: SOCIAL_CONFIG.RESPOND_CRITICS_POPULARITY, morale: 0 } };
      }
      case 'stay_quiet':
      default: {
        fighter.applyMoraleChange(SOCIAL_CONFIG.STAY_QUIET_MORALE);
        return { provoked: false, effects: { popularity: 0, morale: SOCIAL_CONFIG.STAY_QUIET_MORALE } };
      }
    }
  }
}
