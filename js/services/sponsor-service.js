import { generateId } from '../utils/helpers.js';
import { SPONSOR_CONFIG, SPONSOR_BRANDS } from '../config/game-config.js';

// Patrocínios da academia: marcas oferecem renda semanal + bônus por meta
// ("vença N lutas até a semana X"). Dão objetivo de médio prazo às semanas
// entre lutas e escalam com a reputação da academia.
//
// Estado persistido no store gameState sob o id 'sponsors':
//   { id: 'sponsors', active: [...contratos], offers: [...propostas] }
export class SponsorService {
  constructor(db, notifService) {
    this.db = db;
    this.notifService = notifService;
  }

  async getState() {
    const raw = await this.db.get('gameState', 'sponsors');
    return { id: 'sponsors', active: raw?.active || [], offers: raw?.offers || [] };
  }

  async _saveState(state) {
    state.id = 'sponsors'; // keyPath do store gameState
    await this.db.put('gameState', state);
  }

  // Tick semanal. Muta o gym (transações/reputação) — o chamador persiste.
  async processWeek(absWeekNow, gym) {
    const state = await this.getState();
    const completed = [];
    const failed = [];

    // 1) Propostas expiram sem resposta
    const beforeOffers = state.offers.length;
    state.offers = state.offers.filter(o => o.expiresAbsWeek > absWeekNow);
    if (state.offers.length < beforeOffers) {
      await this.notifService.add('info', 'Proposta Retirada', 'Uma marca retirou a proposta de patrocínio por falta de resposta.');
    }

    // 2) Pagamento semanal + checagem de metas dos contratos ativos
    const stillActive = [];
    for (const c of state.active) {
      gym.addTransaction(absWeekNow, `Patrocínio — ${c.brandName}`, c.weekly);

      const winsSince = gym.wins - c.startWins;
      if (winsSince >= c.goalWins) {
        gym.addTransaction(absWeekNow, `Bônus de meta — ${c.brandName}`, c.bonus);
        gym.updateReputation(SPONSOR_CONFIG.REP_PER_GOAL_MET);
        completed.push(c);
        await this.notifService.add('achievement', '🤝 Meta de Patrocínio Batida!', `${c.brandName} pagou $${c.bonus.toLocaleString()} de bônus pela meta de ${c.goalWins} vitória${c.goalWins === 1 ? '' : 's'}.`);
      } else if (absWeekNow >= c.deadlineAbsWeek) {
        gym.updateReputation(SPONSOR_CONFIG.REP_PER_GOAL_FAILED);
        failed.push(c);
        await this.notifService.add('warning', 'Patrocínio Encerrado', `${c.brandName} não renovou: a meta de ${c.goalWins} vitória${c.goalWins === 1 ? '' : 's'} não foi batida no prazo.`);
      } else {
        stillActive.push(c);
      }
    }
    state.active = stillActive;

    // 3) Nova proposta pode chegar, respeitando o teto de contratos
    let newOffer = null;
    const pipeline = state.active.length + state.offers.length;
    if (pipeline < SPONSOR_CONFIG.MAX_ACTIVE && Math.random() < SPONSOR_CONFIG.WEEKLY_OFFER_CHANCE) {
      const takenBrands = new Set([...state.active, ...state.offers].map(c => c.brandId));
      const eligible = SPONSOR_BRANDS.filter(b => gym.reputation >= b.minRep && !takenBrands.has(b.id));
      if (eligible.length > 0) {
        // Marcas de tier mais alto (mais exigentes) têm prioridade quando elegíveis
        const brand = eligible.sort((a, b) => a.tier - b.tier)[Math.random() < 0.6 ? 0 : Math.floor(Math.random() * eligible.length)];
        newOffer = {
          id: generateId(),
          brandId: brand.id,
          brandName: brand.name,
          tier: brand.tier,
          weekly: brand.weekly,
          goalWins: brand.goalWins,
          goalWeeks: brand.goalWeeks,
          bonus: brand.bonus,
          expiresAbsWeek: absWeekNow + SPONSOR_CONFIG.OFFER_EXPIRY_WEEKS,
        };
        state.offers.push(newOffer);
        await this.notifService.add('offer', '🤝 Proposta de Patrocínio', `${brand.name} oferece $${brand.weekly.toLocaleString()}/semana + $${brand.bonus.toLocaleString()} se a equipe vencer ${brand.goalWins} luta${brand.goalWins === 1 ? '' : 's'} em ${brand.goalWeeks} semanas.`);
      }
    }

    await this._saveState(state);
    return { completed, failed, newOffer };
  }

  async accept(offerId, absWeekNow, gymWins) {
    const state = await this.getState();
    const idx = state.offers.findIndex(o => o.id === offerId);
    if (idx === -1) return { ok: false, reason: 'Proposta indisponível.' };
    if (state.active.length >= SPONSOR_CONFIG.MAX_ACTIVE) {
      return { ok: false, reason: `Máximo de ${SPONSOR_CONFIG.MAX_ACTIVE} patrocínios simultâneos.` };
    }

    const [offer] = state.offers.splice(idx, 1);
    const contract = {
      ...offer,
      startAbsWeek: absWeekNow,
      deadlineAbsWeek: absWeekNow + offer.goalWeeks,
      startWins: gymWins,
    };
    state.active.push(contract);
    await this._saveState(state);
    await this.notifService.add('success', 'Patrocínio Fechado!', `${offer.brandName} agora banca a academia: $${offer.weekly.toLocaleString()}/semana.`);
    return { ok: true, contract };
  }

  async decline(offerId) {
    const state = await this.getState();
    state.offers = state.offers.filter(o => o.id !== offerId);
    await this._saveState(state);
    return { ok: true };
  }
}
