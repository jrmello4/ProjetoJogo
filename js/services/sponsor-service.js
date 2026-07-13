import { generateId } from '../utils/helpers.js';
import { SPONSOR_CONFIG, SPONSOR_BRANDS } from '../config/game-config.js';

// Patrocínios pessoais (§E.2): marcas oferecem renda semanal + bônus por
// meta ("vença N lutas até a semana X"). Dão objetivo de médio prazo às
// semanas entre lutas e escalam com a POPULARIDADE do lutador — antes
// escalava com a reputação da academia, que não existe mais como algo
// que o jogador possui.
//
// Estado persistido no store gameState sob o id 'sponsors':
//   { id: 'sponsors', active: [...contratos], offers: [...propostas] }
export class SponsorService {
  constructor(db, notifService, careerLogService = null) {
    this.db = db;
    this.notifService = notifService;
    this.careerLogService = careerLogService;
  }

  async getState() {
    const raw = await this.db.get('gameState', 'sponsors');
    return { id: 'sponsors', active: raw?.active || [], offers: raw?.offers || [] };
  }

  async _saveState(state) {
    state.id = 'sponsors'; // keyPath do store gameState
    await this.db.put('gameState', state);
  }

  // Tick semanal. Muta o fighter (caixa pessoal) — o chamador persiste.
  async processWeek(absWeekNow, fighter) {
    const state = await this.getState();
    const completed = [];
    const failed = [];

    // 1) Propostas expiram sem resposta
    const beforeOffers = state.offers.length;
    state.offers = state.offers.filter(o => o.expiresAbsWeek > absWeekNow);
    if (state.offers.length < beforeOffers) {
      await this.notifService.add('info', 'Proposta Retirada', 'Uma marca retirou a proposta de patrocínio por falta de resposta.');
    }

    // 2) Pagamento semanal + checagem de metas/cláusula de imagem dos contratos ativos
    const stillActive = [];
    for (const c of state.active) {
      fighter.addTransaction(absWeekNow, `Patrocínio — ${c.brandName}`, c.weekly);

      const clauseBroken = await this._checkImageClauseBroken(c, absWeekNow);
      if (clauseBroken) {
        failed.push(c);
        await this.notifService.add('warning', 'Cláusula de Imagem Quebrada', `${c.brandName} encerrou o contrato — sua postura pública não bateu com a cláusula combinada.`);
        continue;
      }

      const winsSince = fighter.record.wins - c.startWins;
      if (winsSince >= c.goalWins) {
        fighter.addTransaction(absWeekNow, `Bônus de meta — ${c.brandName}`, c.bonus);
        fighter.updatePopularity(SPONSOR_CONFIG.POPULARITY_PER_GOAL_MET);
        completed.push(c);
        await this.notifService.add('achievement', '🤝 Meta de Patrocínio Batida!', `${c.brandName} pagou $${c.bonus.toLocaleString()} de bônus pela meta de ${c.goalWins} vitória${c.goalWins === 1 ? '' : 's'}.`);
      } else if (absWeekNow >= c.deadlineAbsWeek) {
        fighter.updatePopularity(SPONSOR_CONFIG.POPULARITY_PER_GOAL_FAILED);
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
      const eligible = SPONSOR_BRANDS.filter(b => (fighter.popularity || 0) >= b.minPopularity && !takenBrands.has(b.id));
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
          imageClause: brand.imageClause,
          expiresAbsWeek: absWeekNow + SPONSOR_CONFIG.OFFER_EXPIRY_WEEKS,
        };
        state.offers.push(newOffer);
        const clauseText = brand.imageClause === 'clean' ? ' Exige postura pública comedida.' : brand.imageClause === 'villain' ? ' Exige manter o hype de vilão.' : '';
        await this.notifService.add('offer', '🤝 Proposta de Patrocínio', `${brand.name} oferece $${brand.weekly.toLocaleString()}/semana + $${brand.bonus.toLocaleString()} se você vencer ${brand.goalWins} luta${brand.goalWins === 1 ? '' : 's'} em ${brand.goalWeeks} semanas.${clauseText}`);
      }
    }

    await this._saveState(state);
    return { completed, failed, newOffer };
  }

  // §E.2 — cláusula de imagem: consulta o careerLog por provocações
  // públicas recentes (publicadas pelo sistema de redes sociais, §D.2).
  // Sem careerLogService (ainda não implementado) ou sem entradas do
  // tipo, a cláusula nunca quebra — fail-safe até D.2 existir de fato.
  async _checkImageClauseBroken(contract, absWeekNow) {
    if (!contract.imageClause || !this.careerLogService) return false;
    const windowWeeks = contract.goalWeeks || 26;
    const recent = await this.careerLogService.recentSince(absWeekNow, windowWeeks);
    const provocations = recent.filter(e => e.type === 'provocation').length;

    if (contract.imageClause === 'clean') {
      return provocations > SPONSOR_CONFIG.CLEAN_CLAUSE_PROVOCATION_LIMIT;
    }
    if (contract.imageClause === 'villain' && absWeekNow >= contract.deadlineAbsWeek) {
      return provocations < SPONSOR_CONFIG.VILLAIN_CLAUSE_MIN_PROVOCATIONS;
    }
    return false;
  }

  async accept(offerId, absWeekNow, fighterWins) {
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
      startWins: fighterWins,
    };
    state.active.push(contract);
    await this._saveState(state);
    await this.notifService.add('success', 'Patrocínio Fechado!', `${offer.brandName} agora te patrocina: $${offer.weekly.toLocaleString()}/semana.`);
    return { ok: true, contract };
  }

  async decline(offerId) {
    const state = await this.getState();
    state.offers = state.offers.filter(o => o.id !== offerId);
    await this._saveState(state);
    return { ok: true };
  }
}
