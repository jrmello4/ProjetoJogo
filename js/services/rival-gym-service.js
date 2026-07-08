import { RivalGym } from '../models/rival-gym.js';
import { Fighter } from '../models/fighter.js';
import { getWeightClassName } from '../utils/helpers.js';
import { GYM_CONFIG, RIVAL_GYM_CONFIG } from '../config/game-config.js';

// Competição do mercado: academias rivais disputam os mesmos agentes livres
// e, ocasionalmente, seduzem atletas insatisfeitos da sua própria equipe.
export class RivalGymService {
  constructor(db, fighterCtrl, notifService, titleService = null, retentionService = null) {
    this.db = db;
    this.fighterCtrl = fighterCtrl;
    this.notifService = notifService;
    this.titleService = titleService;
    this.retentionService = retentionService;
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

    // 2) Épico A — Sondagem: em vez de assédio direto, rivais geram
    //    sondagens que o jogador tem 2 semanas para responder.
    if (this.retentionService && team.length > 0) {
      const activeApproaches = await this.retentionService.generateApproaches(absWeekNow, gym, team);
      if (activeApproaches.length > 0) {
        poached = {
          gymName: activeApproaches[0].rivalGymName,
          fighterName: activeApproaches[0].fighterName,
          isApproach: true,
        };
      }
    }

    return { signings, poached };
  }
}
