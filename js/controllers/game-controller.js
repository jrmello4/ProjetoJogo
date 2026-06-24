import { Organization } from '../models/organization.js';
import { Fighter } from '../models/fighter.js';
import { Event } from '../models/event.js';
import { DB } from '../services/db.js';
import { DataGenerator } from '../services/data-generator.js';
import { RankingService } from '../services/ranking.js';
import { SimulationEngine } from './simulation.js';
import { FighterController } from './fighter-controller.js';
import { EventController } from './event-controller.js';
import { SeasonService } from '../services/season-service.js';
import { NotificationService } from '../services/notification-service.js';
import { generateId } from '../utils/helpers.js';

export class GameController {
  constructor() {
    this.db = new DB();
    this.organization = null;
    this.fighterCtrl = null;
    this.eventCtrl = null;
    this.seasonService = null;
    this.notifService = null;
  }

  async init() {
    await this.db.init();

    this.fighterCtrl = new FighterController(this.db);
    this.eventCtrl = new EventController(this.db);
    this.seasonService = new SeasonService(this.db);
    this.notifService = new NotificationService(this.db);

    await this.seasonService.initSeason();
    await this._ensureOrganization();
    await this._ensureInitialData();

    return this.organization;
  }

  async _ensureOrganization() {
    let org = await this.db.get('organization', 'org-001');
    if (!org) {
      org = new Organization({
        id: 'org-001',
        name: 'Nova Fight Promotions',
        money: 500000,
        reputation: 50,
        eventsHosted: 0,
        champions: [],
      });
      await this.db.put('organization', org);
    }
    this.organization = new Organization(org);
  }

  async _ensureInitialData() {
    const fighters = await this.fighterCtrl.getAllFighters();

    if (fighters.length === 0) {
      const roster = DataGenerator.generateRoster(12, 'org-001');
      const freeAgents = DataGenerator.generateFreeAgents(30);

      for (const f of [...roster, ...freeAgents]) {
        f.id = generateId();
        await this.db.put('fighters', f);
      }
    } else {
      const freeCount = fighters.filter(f => f.status === 'free').length;
      if (freeCount < 15) {
        const newAgents = DataGenerator.generateFreeAgents(15 - freeCount);
        for (const f of newAgents) {
          f.id = generateId();
          await this.db.put('fighters', f);
        }
      }
    }
  }

  async getOrganization() {
    const data = await this.db.get('organization', 'org-001');
    this.organization = new Organization(data);
    return this.organization;
  }

  async updateOrganization(org) {
    this.organization = org;
    await this.db.put('organization', org);
  }

  async getDashboard() {
    const org = await this.getOrganization();
    const roster = await this.fighterCtrl.getRoster('org-001');
    const freeAgents = await this.fighterCtrl.getFreeAgents();
    const events = await this.eventCtrl.getUpcomingEvents();
    const pastEvents = await this.eventCtrl.getPastEvents();

    const allFighters = [...roster, ...freeAgents];
    const rankings = RankingService.calculateRankings(allFighters);
    const champions = RankingService.getChampions(rankings);

    return {
      organization: org,
      roster,
      freeAgents,
      upcomingEvents: events,
      pastEvents,
      rankings,
      champions,
      rosterSize: roster.length,
      freeAgentCount: freeAgents.length,
    };
  }

  async simulateEvent(eventId) {
    const event = await this.eventCtrl.getEvent(eventId);
    if (!event) return null;

    const results = [];
    const allFights = event.allFights;

    for (const fight of allFights) {
      const fighterA = await this.fighterCtrl.getFighter(fight.fighterAId);
      const fighterB = await this.fighterCtrl.getFighter(fight.fighterBId);

      if (!fighterA || !fighterB) continue;

      // Corte de peso antes da luta
      fighterA.applyWeightCutImpact();
      fighterB.applyWeightCutImpact();

      const isBigEvent = fight.card === 'main' || this.organization.reputation >= 70;

      const result = SimulationEngine.simulateFight(fighterA, fighterB, isBigEvent);
      result.eventId = eventId;

      // Recuperar corte de peso após luta
      fighterA.recoverFromWeightCut();
      fighterB.recoverFromWeightCut();

      // Decrementar contratos (useFight fix)
      if (fighterA.contract && fighterA.contract.useFight) {
        fighterA.contract.useFight();
        if (fighterA.contract.fightsRemaining <= 0) {
          fighterA.status = 'free';
          fighterA.organizationId = null;
          fighterA.contract = null;
          await this.notifService.add('contract-expiry', 'Contrato Expirado', `${fighterA.name} teve o contrato expirado e foi liberado.`);
        } else if (fighterA.contract.fightsRemaining === 1) {
          await this.notifService.add('contract-expiry', 'Contrato Prestes a Expirar', `${fighterA.name} tem 1 luta restante no contrato.`);
        }
      }
      if (fighterB.contract && fighterB.contract.useFight) {
        fighterB.contract.useFight();
        if (fighterB.contract.fightsRemaining <= 0) {
          fighterB.status = 'free';
          fighterB.organizationId = null;
          fighterB.contract = null;
          await this.notifService.add('contract-expiry', 'Contrato Expirado', `${fighterB.name} teve o contrato expirado e foi liberado.`);
        } else if (fighterB.contract.fightsRemaining === 1) {
          await this.notifService.add('contract-expiry', 'Contrato Prestes a Expirar', `${fighterB.name} tem 1 luta restante no contrato.`);
        }
      }

      // Verificar lesao
      if (fighterA.status === 'injured') {
        await this.notifService.add('injury', 'Lesão', `${fighterA.name} ficou lesionado.`);
      }
      if (fighterB.status === 'injured') {
        await this.notifService.add('injury', 'Lesão', `${fighterB.name} ficou lesionado.`);
      }

      await this.fighterCtrl.updateFighter(fighterA);
      await this.fighterCtrl.updateFighter(fighterB);
      await this.eventCtrl.saveFightResult(result);

      results.push(result);
    }

    // Avançar semana após evento
    const newState = await this.seasonService.advanceWeek();
    await this.seasonService.applyWeeklyRecovery(this.fighterCtrl);
    await this.notifService.add('week-advance', 'Semana Avançada', `Agora é Semana ${newState.week}, Ano ${newState.year}. Fadiga e moral recuperadas.`);

    event.status = 'completed';
    event.results = results;

    const org = await this.getOrganization();

    // Popularidade afeta receita
    const allFighters = await this.fighterCtrl.getAllFighters();
    const starPower = allFights.reduce((sum, fight) => {
      const a = allFighters.find(f => f.id === fight.fighterAId);
      const b = allFighters.find(f => f.id === fight.fighterBId);
      return sum + (a ? a.popularity : 0) + (b ? b.popularity : 0);
    }, 0);
    const attendanceMultiplier = 1 + starPower / 800;

    const attendance = Math.floor(
      (org.reputation * 10 + Math.random() * 500) *
      (0.8 + event.totalFights * 0.1) * attendanceMultiplier
    );

    const ticketPrice = Math.floor(50 + org.reputation * 2);
    const revenue = attendance * ticketPrice;
    const eventCost = event.totalFights * 5000;

    event.revenue = revenue;
    event.expenses = eventCost;

    org.addMoney(revenue - eventCost);
    org.updateReputation(Math.floor(event.totalFights * 1.5 + Math.random() * 5));
    org.eventsHosted++;

    await this.updateOrganization(org);
    await this.eventCtrl.updateEvent(event);

    const newOrg = await this.getOrganization();
    const allFighters2 = await this.fighterCtrl.getAllFighters();
    const rankings = RankingService.calculateRankings(allFighters2);

    return {
      event,
      results,
      organization: newOrg,
      rankings,
      revenue,
      expenses: eventCost,
      profit: revenue - eventCost,
    };
  }

  async refreshFreeAgents() {
    const agents = DataGenerator.generateFreeAgents(5);
    for (const f of agents) {
      f.id = generateId();
      await this.db.put('fighters', f);
    }
    return await this.fighterCtrl.getFreeAgents();
  }
}
