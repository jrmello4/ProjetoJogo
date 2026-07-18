import { COSMETIC_ITEMS, MONETIZATION_CONFIG } from '../config/game-config.js';

// Loja de cosméticos + apoio ao jogo. Não confundir com SponsorService —
// aquele é a ficção interna de patrocínio do lutador (economia do jogo);
// este é o dinheiro real do jogo em si (ver comentário em MONETIZATION_CONFIG,
// game-config.js).
//
// Estado persistido no store gameState sob o id 'monetization':
//   { id: 'monetization', isSupporter, ownedItems: [...ids], equipped: {slot: id} }
//
// Nota de segurança: redeemSupporterCode compara hash SHA-256, não o
// código em texto puro — então quem ler o bundle JS não vê o código válido
// direto. Isso NÃO é segurança de verdade (dá pra inspecionar a chamada e
// flipar isSupporter via DevTools de qualquer forma). Como os itens são
// cosméticos e nunca afetam a economia do jogo, essa limitação nunca
// importa de fato — o gate aqui é social (boa-fé), não técnico.
export class MonetizationService {
  constructor(db) {
    this.db = db;
  }

  async getState() {
    const raw = await this.db.get('gameState', 'monetization');
    return {
      id: 'monetization',
      isSupporter: raw?.isSupporter || false,
      ownedItems: raw?.ownedItems || [],
      equipped: raw?.equipped || {},
    };
  }

  async _saveState(state) {
    state.id = 'monetization';
    await this.db.put('gameState', state);
  }

  async redeemSupporterCode(code) {
    const normalized = (code || '').trim().toUpperCase();
    if (!normalized) return { ok: false, reason: 'Digite um código.' };

    const state = await this.getState();
    if (state.isSupporter) return { ok: false, reason: 'Código de apoiador já resgatado.' };

    const hash = await MonetizationService._sha256Hex(normalized);
    if (hash !== MONETIZATION_CONFIG.SUPPORTER_CODE_HASH) {
      return { ok: false, reason: 'Código inválido.' };
    }

    state.isSupporter = true;
    state.ownedItems = [...new Set([...state.ownedItems, ...COSMETIC_ITEMS.map(i => i.id)])];
    await this._saveState(state);
    return { ok: true, state };
  }

  async setEquipped(slot, itemId) {
    const state = await this.getState();
    if (itemId && !state.ownedItems.includes(itemId)) {
      return { ok: false, reason: 'Item ainda não desbloqueado.' };
    }
    state.equipped = { ...state.equipped, [slot]: itemId || null };
    await this._saveState(state);
    return { ok: true, state };
  }

  static async _sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
