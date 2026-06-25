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
    await this._ensureRivals();
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

  async _ensureRivals() {
    const existing = await this.db.getAll('organization');
    const rivals = existing.filter(o => o.id !== 'org-001' && o.id.startsWith('rival-'));
    if (rivals.length > 0) return;

    const rivalNames = ['Pride Fighting Championship', 'Global Combat Elite', 'Iron Fist Promotions'];
    for (let i = 0; i < rivalNames.length; i++) {
      const rival = new Organization({
        id: `rival-${i + 1}`,
        name: rivalNames[i],
        money: 200000 + Math.floor(Math.random() * 200000),
        reputation: 30 + Math.floor(Math.random() * 30),
        eventsHosted: 0,
      });
      await this.db.put('organization', rival);
    }
  }

  async getRivalOrgs() {
    const all = await this.db.getAll('organization');
    return all.filter(o => o.id !== 'org-001' && o.id.startsWith('rival-'));
  }

  async processRivalHires() {
    const rivals = await this.getRivalOrgs();
    const freeAgents = await this.fighterCtrl.getFreeAgents();
    const hired = [];

    for (const rival of rivals) {
      // Each rival tries to hire 1-2 free agents per week
      const targetCount = 1 + Math.floor(Math.random() * 2);
      const available = freeAgents.filter(f => !hired.some(h => h.id === f.id));

      for (let i = 0; i < targetCount && available.length > 0; i++) {
        // Pick a random free agent
        const idx = Math.floor(Math.random() * available.length);
        const target = available.splice(idx, 1)[0];

        if (target && rival.money >= 10000) {
          target.status = 'roster';
          target.organizationId = rival.id;
          await this.fighterCtrl.updateFighter(target);
          rival.money -= 10000;
          await this.db.put('organization', rival);
          hired.push(target);
        }
      }
    }

    return hired;
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

  async getMilestones() {
    const raw = await this.db.get('gameState', 'milestones');
    const state = raw || {};
    // Lista de conquistas com progresso
    const achievementDefs = [
      { id: 'firstEvent', label: 'Primeiro Evento', desc: 'Realizar o primeiro evento', max: 1 },
      { id: 'fiveEvents', label: '5 Eventos', desc: 'Realizar 5 eventos', max: 5 },
      { id: 'tenEvents', label: '10 Eventos', desc: 'Realizar 10 eventos', max: 10 },
      { id: 'firstProfit', label: 'Primeiro Lucro', desc: 'Ter lucro em um evento', max: 1 },
      { id: 'threeProfit', label: '3 Lucros Consecutivos', desc: 'Lucrar em 3 eventos seguidos', max: 3 },
      { id: 'superEvent', label: 'Super Evento', desc: 'Evento com receita > $200k', max: 1 },
      { id: 'firstChampion', label: 'Primeiro Campeão', desc: 'Ter um campeão em qualquer divisão', max: 1 },
      { id: 'threeChamps', label: '3 Divisões', desc: 'Campeão em 3 divisões', max: 3 },
    ];

    return achievementDefs.map(a => ({
      ...a,
      current: state[a.id] || 0,
      unlocked: (state[a.id] || 0) >= a.max,
    }));
  }

  async checkMilestones(event, revenue, profit) {
    const state = await this.db.get('gameState', 'milestones') || {};
    const roster = await this.fighterCtrl.getRoster('org-001');
    const freeAgents = await this.fighterCtrl.getFreeAgents();
    const allFighters = [...roster, ...freeAgents];
    const rankings = RankingService.calculateRankings(allFighters);
    const champions = RankingService.getChampions(rankings);

    const newUnlocks = [];

    // firstEvent: first event simulated
    if (!state.firstEvent) { state.firstEvent = 1; newUnlocks.push('firstEvent'); }

    // fiveEvents / tenEvents
    state.eventCount = (state.eventCount || 0) + 1;
    if (state.eventCount === 5 && !state.fiveEvents) { state.fiveEvents = 5; newUnlocks.push('fiveEvents'); }
    if (state.eventCount === 10 && !state.tenEvents) { state.tenEvents = 10; newUnlocks.push('tenEvents'); }

    // firstProfit / threeProfit
    if (profit > 0) {
      state.profitStreak = (state.profitStreak || 0) + 1;
      if (!state.firstProfit) { state.firstProfit = 1; newUnlocks.push('firstProfit'); }
      if (state.profitStreak >= 3 && !state.threeProfit) { state.threeProfit = 3; newUnlocks.push('threeProfit'); }
    } else {
      state.profitStreak = 0;
    }

    // superEvent
    if (revenue >= 200000 && !state.superEvent) {
      state.superEvent = 1;
      newUnlocks.push('superEvent');
    }

    // firstChampion / threeChamps
    const champCount = Object.keys(champions).length;
    if (champCount >= 1 && !state.firstChampion) { state.firstChampion = 1; newUnlocks.push('firstChampion'); }
    if (champCount >= 3 && !state.threeChamps) { state.threeChamps = 3; newUnlocks.push('threeChamps'); }

    await this.db.put('gameState', state);
    return newUnlocks;
  }

  async processWeeklyCosts() {
    const org = await this.getOrganization();
    const roster = await this.fighterCtrl.getRoster('org-001');

    // Staff costs scale with reputation
    const staffCost = Math.floor(5000 + org.reputation * 100);
    // Facility maintenance
    const facilityCost = Math.floor(2000 + org.reputation * 50);
    // Marketing overhead
    const marketingCost = Math.floor(1000 + org.reputation * 30);
    // Fighter salaries (weekly retainer)
    const salaryCost = roster.reduce((sum, f) => sum + (f.contract?.pursePerFight || 2000) * 0.1, 0);

    const totalCost = staffCost + facilityCost + marketingCost + Math.round(salaryCost);
    org.money -= totalCost;
    await this.updateOrganization(org);

    return { staffCost, facilityCost, marketingCost, salaryCost: Math.round(salaryCost), totalCost };
  }

  async processRetirements() {
    const roster = await this.fighterCtrl.getRoster('org-001');
    const retired = [];

    for (const f of roster) {
      const age = f.age || 30;
      let retireChance = 0;

      // Age-based retirement
      if (age >= 40) retireChance = 0.10;
      else if (age >= 38) retireChance = 0.05;
      else if (age >= 35) retireChance = 0.02;

      // Consecutive losses increase chance
      let lossStreak = 0;
      for (const fight of f.fights) {
        if (!fight.won) lossStreak++;
        else break;
      }
      if (lossStreak >= 5) retireChance += 0.05;
      if (lossStreak >= 3) retireChance += 0.03;

      if (Math.random() < retireChance) {
        f.status = 'retired';
        f.organizationId = null;
        f.contract = null;
        await this.fighterCtrl.updateFighter(f);
        retired.push(f);
      }
    }

    return retired;
  }

  async processDraft() {
    const state = await this.seasonService.getState();
    // Draft happens at the end of each year (week 52)
    if (state.week !== 52) return [];

    const newFighters = [];
    const count = 5 + Math.floor(Math.random() * 6); // 5-10 new fighters

    for (let i = 0; i < count; i++) {
      const fighter = DataGenerator.generateFighter(null);
      fighter.age = 20 + Math.floor(Math.random() * 5); // Young prospects
      fighter.hidden.potential = Math.min(99, fighter.hidden.potential + Math.floor(Math.random() * 20));
      fighter.status = 'free';
      fighter.organizationId = null;
      await this.fighterCtrl.createFighter(fighter);
      newFighters.push(fighter);
    }

    return newFighters;
  }

  async generateWeeklyNews() {
    const roster = await this.fighterCtrl.getRoster('org-001');
    const news = [];

    // Check for streaks
    for (const f of roster) {
      let streak = 0;
      let streakType = null;
      for (const fight of f.fights) {
        if (fight.won) { streak++; streakType = 'win'; }
        else break;
      }
      if (streak >= 3 && streakType === 'win') {
        news.push({ type: 'streak', text: `${f.name} está em uma sequência de ${streak} vitórias consecutivas!`, fighterId: f.id });
      }

      // Losing streak
      let lossStreak = 0;
      for (const fight of f.fights) {
        if (!fight.won) { lossStreak++; }
        else break;
      }
      if (lossStreak >= 2) {
        news.push({ type: 'losing', text: `${f.name} vem de ${lossStreak} derrotas seguidas — momento crítico na carreira.`, fighterId: f.id });
      }
    }

    // Random callout (rivalry building)
    if (roster.length >= 2) {
      const caller = roster[Math.floor(Math.random() * roster.length)];
      const target = roster.filter(f => f.id !== caller.id)[Math.floor(Math.random() * (roster.length - 1))];
      if (caller && target && Math.random() < 0.3) {
        news.push({ type: 'callout', text: `${caller.name} desafia ${target.name}: "Depois de você, não tem mais ninguém na divisão!"`, fighterId: caller.id });
      }
    }

    // Random training injury
    if (roster.length > 0 && Math.random() < 0.15) {
      const injured = roster[Math.floor(Math.random() * roster.length)];
      news.push({ type: 'injury', text: `${injured.name} sofreu uma lesão leve no treino — sem gravidade, mas pode afetar o desempenho.`, fighterId: injured.id });
    }

    return news;
  }

  async getDashboard() {
    const org = await this.getOrganization();
    const milestones = await this.getMilestones();
    const rivals = await this.getRivalOrgs();
    const orgStandings = [
      { name: org.name, rep: org.reputation, money: org.money, events: org.eventsHosted, isPlayer: true },
      ...rivals.map(r => ({ name: r.name, rep: r.reputation, money: r.money, events: r.eventsHosted || 0, isPlayer: false })),
    ].sort((a, b) => b.rep - a.rep);
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
      milestones,
      orgStandings,
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
      result.card = fight.card;

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

    // Bônus pós-evento (Luta da Noite, Performance da Noite)
    const bonuses = SimulationEngine.getFightBonus(results);
    event.bonuses = bonuses;
    let bonusTotal = 0;
    for (const b of bonuses) {
      bonusTotal += b.amount;
      await this.notifService.add('success', `🏆 ${b.type}`, `${b.winner} ganhou $${b.amount.toLocaleString()}!`);
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
    const attendanceMultiplier = 1 + starPower / 1200;

    // Attendance mais realista — capado
    const baseAttendance = Math.floor(
      org.reputation * 5 + Math.random() * 300
    );
    const attendance = Math.min(
      Math.floor(baseAttendance * (0.7 + event.totalFights * 0.15) * attendanceMultiplier),
      5000
    );

    // Ticket price mais baixo
    const ticketPrice = Math.floor(30 + org.reputation * 1.2);
    const revenue = attendance * ticketPrice;

    // Expenses realistas: salarios + producao + marketing + venue
    let fighterPurses = 0;
    for (const fight of allFights) {
      const a = allFighters.find(f => f.id === fight.fighterAId);
      const b = allFighters.find(f => f.id === fight.fighterBId);
      // Purses baseadas no pursePerFight do contrato
      fighterPurses += (a?.contract?.pursePerFight || 2000) + (b?.contract?.pursePerFight || 2000);
      // Bonus de vitoria se ganhou
      fighterPurses += (a?.contract?.victoryBonus || 500) + (b?.contract?.victoryBonus || 500);
    }
    // Minimo de purse por luta
    const minPurse = event.totalFights * 2000;
    fighterPurses = Math.max(fighterPurses, minPurse);

    // Custos de producao (escalam com reputacao)
    const productionCost = Math.floor(3000 + org.reputation * 50 + event.totalFights * 1500);
    // Marketing
    const marketingCost = Math.floor(1000 + org.reputation * 30 + starPower * 2);
    // Venue (escala com tamanho do evento)
    const venueCost = Math.floor(2000 + attendance * 0.5 + event.totalFights * 1000);

    const totalExpenses = fighterPurses + productionCost + marketingCost + venueCost + bonusTotal;

    event.revenue = revenue;
    event.expenses = totalExpenses;

    org.addMoney(revenue - totalExpenses);
    org.updateReputation(Math.floor(event.totalFights * 1.5 + Math.random() * 5));
    org.eventsHosted++;

    await this.updateOrganization(org);
    await this.eventCtrl.updateEvent(event);

    const newOrg = await this.getOrganization();
    const allFighters2 = await this.fighterCtrl.getAllFighters();
    const rankings = RankingService.calculateRankings(allFighters2);

    // Check milestones
    const newUnlocks = await this.checkMilestones(event, revenue, revenue - totalExpenses);

    return {
      event,
      results,
      organization: newOrg,
      newUnlocks,
      rankings,
      revenue,
      expenses: totalExpenses,
      profit: revenue - totalExpenses,
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
