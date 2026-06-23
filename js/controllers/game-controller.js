import { Organization } from '../models/organization.js';
import { Fighter } from '../models/fighter.js';
import { Event } from '../models/event.js';
import { DB } from '../services/db.js';
import { DataGenerator } from '../services/data-generator.js';
import { RankingService } from '../services/ranking.js';
import { SimulationEngine } from './simulation.js';
import { FighterController } from './fighter-controller.js';
import { EventController } from './event-controller.js';
import { generateId } from '../utils/helpers.js';

export class GameController {
  constructor() {
    this.db = new DB();
    this.organization = null;
    this.fighterCtrl = null;
    this.eventCtrl = null;
  }

  async init() {
    await this.db.init();

    this.fighterCtrl = new FighterController(this.db);
    this.eventCtrl = new EventController(this.db);

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

      const result = SimulationEngine.simulateFight(fighterA, fighterB);
      result.eventId = eventId;

      await this.fighterCtrl.updateFighter(fighterA);
      await this.fighterCtrl.updateFighter(fighterB);
      await this.eventCtrl.saveFightResult(result);

      results.push(result);
    }

    event.status = 'completed';
    event.results = results;

    const org = await this.getOrganization();

    const attendance = Math.floor(
      (org.reputation * 10 + Math.random() * 500) *
      (0.8 + event.totalFights * 0.1)
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
    const allFighters = await this.fighterCtrl.getAllFighters();
    const rankings = RankingService.calculateRankings(allFighters);

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
