import { Manager } from '../models/manager.js';
import { MANAGERS, MANAGER_CONFIG } from '../config/game-config.js';

// Empresário do lutador — ver spec §C.1. Catálogo fixo (como Academy),
// persistido no store 'organization' com id prefixado 'manager-'.
export class ManagerService {
  constructor(db, notifService, careerLogService = null) {
    this.db = db;
    this.notifService = notifService;
    this.careerLogService = careerLogService;
  }

  async bootstrap() {
    for (const cfg of MANAGERS) {
      const existing = await this.db.get('organization', cfg.id);
      if (!existing) {
        const manager = new Manager({ ...cfg, trust: MANAGER_CONFIG.STARTING_TRUST });
        await this.db.put('organization', manager);
      }
    }
  }

  async getAll() {
    const all = await this.db.getAll('organization');
    return all.filter(o => o.id.startsWith('manager-')).map(o => new Manager(o));
  }

  async getManager(id) {
    if (!id) return null;
    const data = await this.db.get('organization', id);
    return data ? new Manager(data) : null;
  }

  async hire(fighter, managerId, absWeekNow = 0) {
    const manager = await this.getManager(managerId);
    if (!manager) return { ok: false, reason: 'Empresário não encontrado.' };
    if (fighter.managerId === managerId) return { ok: false, reason: 'Já é seu empresário.' };

    fighter.managerId = managerId;
    await this.notifService.add('success', 'Novo Empresário', `${manager.name} agora cuida da sua carreira. Corte: ${Math.round(manager.cut * 100)}%.`);
    if (this.careerLogService) {
      await this.careerLogService.publish(fighter.id, 'manager_switch', absWeekNow, 40, { managerName: manager.name });
    }
    return { ok: true, manager };
  }

  // Rescisão antecipada com multa — espelha ContractService.terminate,
  // mas o valor sai do caixa pessoal do lutador (§A.2).
  async terminate(fighter, absWeekNow, recentPurse) {
    if (!fighter.managerId) return { ok: false, reason: 'Você não tem empresário.' };
    const manager = await this.getManager(fighter.managerId);
    if (!manager) { fighter.managerId = null; return { ok: true }; }

    const fine = Math.round((recentPurse || 5000) * MANAGER_CONFIG.TERMINATE_FINE_RATIO);
    if (fighter.cash < fine) {
      return { ok: false, reason: `Rescindir com ${manager.name} custa $${fine.toLocaleString()}. Saldo insuficiente.` };
    }

    fighter.addTransaction(absWeekNow, `Multa rescisória — ${manager.name}`, -fine);
    fighter.managerId = null;
    manager.updateTrust(-15);
    await this.db.put('organization', manager);

    await this.notifService.add('warning', 'Empresário Dispensado', `Você rescindiu com ${manager.name}. Multa: $${fine.toLocaleString()}.`);
    return { ok: true, fine };
  }

  // Retira o corte do empresário de uma bolsa, ANTES do caixa pessoal.
  // Sem empresário, o lutador fica com 100% (menos purseShare de contrato,
  // já tratado em outro lugar).
  async applyCut(fighter, grossPurse) {
    if (!fighter.managerId) return { managerCut: 0, netPurse: grossPurse, manager: null };
    const manager = await this.getManager(fighter.managerId);
    if (!manager) return { managerCut: 0, netPurse: grossPurse, manager: null };

    const managerCut = Math.round(grossPurse * manager.cut);
    return { managerCut, netPurse: grossPurse - managerCut, manager };
  }

  // Modificadores de negociação de bolsa — consumidos por OfferService.
  // aggressive: barganha mais forte, mas maior chance da promoção cancelar.
  // conservative: barganha mais fraca, quase nunca gera atrito.
  negotiationModifiers(manager) {
    if (!manager) return { leverageBonus: 0, rescindBonus: 0 };
    if (manager.style === 'aggressive') {
      return { leverageBonus: MANAGER_CONFIG.AGGRESSIVE_LEVERAGE_BONUS, rescindBonus: MANAGER_CONFIG.AGGRESSIVE_RESCIND_BONUS };
    }
    if (manager.style === 'conservative') {
      return { leverageBonus: MANAGER_CONFIG.CONSERVATIVE_LEVERAGE_PENALTY, rescindBonus: 0 };
    }
    return { leverageBonus: 0, rescindBonus: 0 }; // loyal: neutro na mesa de negociação
  }

  // §B.1 — empresário com boas conexões acelera auto-descoberta de DNA e
  // dá conhecimento de base sobre adversários (substitui o olheiro comprado
  // do modo academia antigo).
  givesBaselineScouting(manager) {
    return !!manager && manager.connections >= MANAGER_CONFIG.BASELINE_SCOUTING_FROM_CONNECTIONS;
  }
}
