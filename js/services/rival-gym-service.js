import { RivalGym } from '../models/rival-gym.js';
import { Fighter } from '../models/fighter.js';
import { GYM_CONFIG, RIVAL_GYM_CONFIG } from '../config/game-config.js';

// Competição do mercado: academias rivais disputam os mesmos agentes livres
// e, ocasionalmente, seduzem atletas insatisfeitos da sua própria equipe.
export class RivalGymService {
  constructor(db, fighterCtrl, notifService) {
    this.db = db;
    this.fighterCtrl = fighterCtrl;
    this.notifService = notifService;
  }

  async getAll() {
    const all = await this.db.getAll('organization');
    return all
      .filter(o => o.id.startsWith('rivalgym-'))
      .map(o => new RivalGym(o))
      .sort((a, b) => b.reputation - a.reputation);
  }

  // Retorna { signings: [{gymName, fighterName, overall}], poached: {gymName, fighterName} | null }
  async processWeek(absWeekNow, gym, team) {
    const rivalGyms = await this.getAll();
    const signings = [];
    let poached = null;

    // 1) Academias rivais recrutam agentes livres — reduz o que sobra pra você
    for (const rival of rivalGyms) {
      if (Math.random() > RIVAL_GYM_CONFIG.RECRUIT_CHANCE_PER_GYM) continue;

      const freeAgents = await this.fighterCtrl.getFreeAgents();
      if (freeAgents.length === 0) continue;

      // Prioriza prospectos de nível mais alto — competição de verdade
      const sorted = [...freeAgents].sort((a, b) => b.overallRating - a.overallRating);
      const pool = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.3)));
      const target = pool[Math.floor(Math.random() * pool.length)];

      target.status = 'rival';
      target.gymId = rival.id;
      await this.fighterCtrl.updateFighter(target);

      rival.signings++;
      rival.updateReputation(RIVAL_GYM_CONFIG.REP_PER_SIGNING);
      await this.db.put('organization', rival);

      signings.push({ gymName: rival.name, fighterName: target.name, overall: target.overallRating });
    }

    if (signings.length > 0) {
      const headline = signings[0];
      await this.notifService.add('info', 'Mercado Concorrido', `${headline.gymName} contratou ${headline.fighterName} (OVR ${headline.overall}) — ${signings.length > 1 ? `e mais ${signings.length - 1} agente${signings.length - 1 === 1 ? '' : 's'} livre${signings.length - 1 === 1 ? '' : 's'}` : 'de olho nos mesmos prospectos que você'}.`);
    }

    // 2) Assédio a atletas da sua equipe — só UM rival tenta por atleta por
    // semana (não soma chance de todas as academias), respeitando carência
    // de tenure e limitando a no máximo 1 sucesso por semana no total.
    if (rivalGyms.length > 0) {
      const order = [...team].sort(() => Math.random() - 0.5);
      let poachCount = 0;

      for (const fighter of order) {
        if (poachCount >= RIVAL_GYM_CONFIG.MAX_POACH_PER_WEEK) break;
        if (fighter.status === 'injured' || fighter.status === 'retired') continue;

        const tenureWeeks = absWeekNow - (fighter.gymJoinedAbsWeek || absWeekNow);
        if (tenureWeeks < RIVAL_GYM_CONFIG.MIN_TENURE_WEEKS) continue;

        const rival = rivalGyms[Math.floor(Math.random() * rivalGyms.length)];
        const repEdge = Math.min(RIVAL_GYM_CONFIG.POACH_REP_EDGE_CAP, Math.max(0, rival.reputation - gym.reputation));
        const chance = RIVAL_GYM_CONFIG.POACH_BASE_CHANCE
          + ((100 - fighter.morale) / 100) * RIVAL_GYM_CONFIG.POACH_MORALE_WEIGHT
          + (repEdge / 100) * RIVAL_GYM_CONFIG.POACH_REP_WEIGHT;

        if (Math.random() >= chance) continue;

        fighter.status = 'rival';
        fighter.gymId = rival.id;
        await this.fighterCtrl.updateFighter(fighter);

        rival.poachedFromPlayer++;
        rival.updateReputation(RIVAL_GYM_CONFIG.REP_PER_POACH);
        await this.db.put('organization', rival);

        gym.updateReputation(-1);

        poached = { gymName: rival.name, fighterName: fighter.name };
        await this.notifService.add('warning', '💔 Atleta Perdido', `${fighter.name} foi seduzido pela ${rival.name} — moral baixa e uma proposta irrecusável selaram a saída.`);

        poachCount++;
      }
    }

    return { signings, poached };
  }
}
