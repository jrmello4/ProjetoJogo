import { generateId } from '../utils/helpers.js';
import { SOCIAL_CONFIG } from '../config/game-config.js';

// Redes sociais como sistema contínuo — ver spec §D.2. Mesmo padrão de
// estado "proposta pendente" já usado por `SponsorService`: um documento
// singleton no store gameState, sob o id 'socialMedia':
//   { id: 'socialMedia', pending: null | {
//       id, createdAbsWeek, expiresAbsWeek,
//       rivalryId, rivalFighterId, rivalName, // null se não há rival ativo
//   } }
//
// Quem decide SE existe rival ativo (e quem é ele) é o chamador
// (GameController já tem RivalryService/FighterController) — este serviço
// só guarda o resultado e rola a chance semanal.
export class SocialMediaService {
  constructor(db, notifService) {
    this.db = db;
    this.notifService = notifService;
  }

  async getState() {
    const raw = await this.db.get('gameState', 'socialMedia');
    return { id: 'socialMedia', pending: raw?.pending || null };
  }

  async _saveState(state) {
    state.id = 'socialMedia'; // keyPath do store gameState
    await this.db.put('gameState', state);
  }

  // Tick semanal. NÃO muta o fighter — este sistema só decide SE/O QUE
  // surge; os efeitos de popularidade/moral só acontecem quando o jogador
  // responde (ver GameController.resolveSocialPrompt).
  // `rivalInfo` é `null` ou `{ rivalryId, fighterId, name }` do rival ativo
  // mais intenso (já resolvido pelo chamador).
  async processWeek(absWeekNow, hasAcceptedBooking, rivalInfo = null) {
    const state = await this.getState();

    if (state.pending && state.pending.expiresAbsWeek <= absWeekNow) {
      state.pending = null;
    }

    if (!state.pending && !hasAcceptedBooking && Math.random() < SOCIAL_CONFIG.WEEKLY_CHANCE) {
      state.pending = {
        id: generateId(),
        createdAbsWeek: absWeekNow,
        expiresAbsWeek: absWeekNow + SOCIAL_CONFIG.PROMPT_EXPIRY_WEEKS,
        rivalryId: rivalInfo?.rivalryId || null,
        rivalFighterId: rivalInfo?.fighterId || null,
        rivalName: rivalInfo?.name || null,
      };
      await this.notifService.add('offer', '📱 Momento nas Redes', 'Você tem a atenção da mídia social esta semana — como vai se posicionar?');
    }

    await this._saveState(state);
    return state.pending;
  }

  async clearPending() {
    const state = await this.getState();
    state.pending = null;
    await this._saveState(state);
  }
}
