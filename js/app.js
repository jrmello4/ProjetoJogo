import { LayoutView } from './views/layout.js';
import { DashboardView } from './views/dashboard.js';
import { RosterView } from './views/roster.js';
import { MarketView } from './views/market.js';
import { EventsView } from './views/events.js';
import { FighterProfileView } from './views/fighter-profile.js';
import { TrainingCampView } from './views/training-camp.js';
import { RivalriesView } from './views/rivalries.js';
import { PressConferenceView } from './views/press-conference.js';
import { HallOfFameView } from './views/hall-of-fame.js';
import { Event } from './models/event.js';
import { NotificationsView } from './views/notifications.js';
import { GameController } from './controllers/game-controller.js';
import { TrainingCamp } from './controllers/training-camp.js';
import { PressConference } from './controllers/press-conference.js';
import { RivalryService } from './services/rivalry-service.js';
import { HallOfFame } from './services/hall-of-fame.js';
import { SeasonService } from './services/season-service.js';
import { NotificationService } from './services/notification-service.js';
import { SaveService } from './services/save-service.js';

class App {
  constructor() {
    this.game = new GameController();
    this.currentView = 'dashboard';
    this.rosterFilter = '';
    this.marketFilter = '';
    this.marketSearch = '';
    this.weeklyFocus = 'striking';
    this.previousView = 'dashboard';
    this.rivalryService = null;
    this.trainingState = { intensity: null, spec: null };
    this.seasonService = new SeasonService(this.game.db);
    this.notificationService = new NotificationService(this.game.db);
    this.saveService = new SaveService(this.game.db);
  }

  async init() {
    LayoutView.initNavigation();
    try {
      await this.game.init();
    } catch (err) {
      console.error('Failed to init game:', err);
      document.getElementById('mainContent').innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:60vh;flex-direction:column;gap:1rem;">
          <h2 style="color:var(--accent)">Erro ao carregar banco de dados</h2>
          <p style="color:var(--text-secondary);text-align:center;max-width:500px;">
            O banco de dados pode estar corrompido ou bloqueado. Feche todas as abas do MMA Manager e tente novamente.
            Se persistir, clique em "Resetar Dados" no menu lateral.
          </p>
          <button class="btn btn-primary" onclick="location.reload()">Tentar Novamente</button>
        </div>
      `;
      return;
    }
    this.rivalryService = new RivalryService(this.game.db);

    window.addEventListener('navigate', (e) => {
      this.navigateTo(e.detail.view);
    });

    // Save/Load button
    document.getElementById('saveLoadBtn')?.addEventListener('click', () => this.handleSaveLoad());

    // Roster renew button
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('roster-renew')) {
        this.handleRenewContract(e.target.dataset.id);
      }
    });

    this.navigateTo('dashboard');
  }

  async navigateTo(view) {
    this.previousView = this.currentView;
    this.currentView = view;

    switch (view) {
      case 'dashboard':
        await this.renderDashboard();
        break;
      case 'roster':
        await this.renderRoster();
        break;
      case 'market':
        await this.renderMarket();
        break;
      case 'events':
        await this.renderEvents();
        break;
      case 'training':
        await this.renderTrainingCamp();
        break;
      case 'rivalries':
        await this.renderRivalries();
        break;
      case 'hall-of-fame':
        await this.renderHallOfFame();
        break;
      case 'notifications':
        await this.renderNotifications();
        break;
      case 'press-conference':
        await this.renderPressConference();
        break;
      default:
        await this.renderDashboard();
    }
  }

  async renderDashboard() {
    const data = await this.game.getDashboard();
    const weekLabel = await this.seasonService.getWeekLabel();
    const freeAgents = await this.game.fighterCtrl.getFreeAgents();
    const saveInfo = {
      rosterSize: data.roster.length,
      freeAgents: freeAgents.length,
      totalEvents: data.pastEvents.length,
    };
    data.weeklyFocus = this.weeklyFocus;
    const html = DashboardView.render(data, weekLabel, saveInfo);
    LayoutView.render(html);

    document.getElementById('weekAdvanceBtn')?.addEventListener('click', () => this.advanceWeek());

    document.querySelectorAll('.weekly-focus').forEach(btn => {
      btn.addEventListener('click', () => {
        this.weeklyFocus = btn.dataset.focus;
        this.renderDashboard();
      });
    });

    document.querySelectorAll('[data-fighter-click]').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        this.showFighterProfile(el.dataset.fighterClick);
      });
    });
  }

  async renderRoster() {
    const roster = await this.game.fighterCtrl.getRoster('org-001');
    const html = RosterView.render(roster, this.rosterFilter);
    LayoutView.render(html);

    document.querySelectorAll('.fighter-row').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        this.showFighterProfile(el.dataset.id);
      });
    });

    document.querySelectorAll('.roster-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        this.rosterFilter = btn.dataset.filter;
        this.renderRoster();
      });
    });

    document.querySelectorAll('.roster-fire').forEach(btn => {
      btn.addEventListener('click', async () => {
        await this.game.fighterCtrl.fireFighter(btn.dataset.id);
        this.rosterFilter = '';
        this.renderRoster();
      });
    });
  }

  async renderMarket() {
    const agents = await this.game.fighterCtrl.getFreeAgents();
    const html = MarketView.render(agents, this.marketFilter, this.marketSearch);
    LayoutView.render(html);
    this._bindMarket(agents);
  }

  _bindMarket(agents) {
    document.querySelectorAll('.fighter-row').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        this.showFighterProfile(el.dataset.id);
      });
    });

    document.querySelectorAll('.market-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        this.marketFilter = btn.dataset.filter;
        this.renderMarket();
      });
    });

    document.querySelectorAll('.market-search').forEach(input => {
      input.addEventListener('input', () => {
        this.marketSearch = input.value;
        this.renderMarket();
      });
    });

    document.querySelectorAll('.market-hire').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fighter = await this.game.fighterCtrl.getFighter(btn.dataset.id);
        if (!fighter) return;

        const currentAgents = agents;
        const modalHtml = MarketView.renderHireModal(fighter);
        const baseHtml = MarketView.render(currentAgents, this.marketFilter, this.marketSearch);
        LayoutView.render(baseHtml + modalHtml, false);

        this._bindMarket(currentAgents);
        this._bindHireModal(fighter);
      });
    });

    document.querySelectorAll('.market-hire-quick').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fighter = await this.game.fighterCtrl.getFighter(btn.dataset.id);
        if (!fighter) return;

        const basePurse = Math.round(fighter.overallRating * 200 + 5000);
        await this.game.fighterCtrl.hireFighter(btn.dataset.id, 'org-001', {
          pursePerFight: basePurse,
          duration: 3,
          victoryBonus: Math.round(basePurse * 0.5),
          fightsRemaining: 3,
        });

        this.notificationService.add('success', 'Contratação', `${fighter.name} contratado com sucesso!`);
        this.renderMarket();
      });
    });

    document.querySelectorAll('.market-confirm-hire').forEach(btn => {
      btn.addEventListener('click', async () => {
        const purse = parseInt(document.getElementById('hirePurse').value) || 10000;
        const duration = parseInt(document.getElementById('hireDuration').value) || 3;
        const bonus = parseInt(document.getElementById('hireBonus').value) || 5000;

        const fighter = await this.game.fighterCtrl.getFighter(btn.dataset.id);
        await this.game.fighterCtrl.hireFighter(btn.dataset.id, 'org-001', {
          pursePerFight: purse,
          duration,
          victoryBonus: bonus,
          fightsRemaining: duration,
        });

        this.notificationService.add('success', 'Contratação', `${fighter?.name || 'Fighter'} contratado com sucesso!`);
        this.renderMarket();
      });
    });

    document.querySelectorAll('.market-refresh').forEach(btn => {
      btn.addEventListener('click', async () => {
        await this.game.refreshFreeAgents();
        this.marketFilter = '';
        this.marketSearch = '';
        this.renderMarket();
      });
    });
  }

  _bindHireModal(fighter) {
    const purseInput = document.getElementById('hirePurse');
    const bonusInput = document.getElementById('hireBonus');
    const durationSelect = document.getElementById('hireDuration');
    const totalEl = document.getElementById('hireTotalCost');

    if (!purseInput || !bonusInput || !durationSelect || !totalEl) return;

    const updateTotal = () => {
      const purse = parseInt(purseInput.value) || 0;
      const bonus = parseInt(bonusInput.value) || 0;
      const duration = parseInt(durationSelect.value) || 1;
      const total = (purse + bonus) * duration;
      totalEl.textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total);
    };

    purseInput.addEventListener('input', updateTotal);
    bonusInput.addEventListener('input', updateTotal);
    durationSelect.addEventListener('change', updateTotal);
  }

  async renderEvents() {
    const allEvents = await this.game.eventCtrl.getAllEvents();
    const upcoming = await this.game.eventCtrl.getUpcomingEvents();
    const roster = await this.game.fighterCtrl.getRoster('org-001');
    const html = await EventsView.render(allEvents, roster, upcoming, this.seasonService);
    LayoutView.render(html);

    document.querySelectorAll('.event-create').forEach(btn => {
      btn.addEventListener('click', async () => {
        const modalHtml = await EventsView.renderCreateModal(roster, this.seasonService);
        const baseHtml = await EventsView.render(allEvents, roster, upcoming, this.seasonService);
        LayoutView.render(baseHtml + modalHtml, false);
        this._bindEventCreate(roster, allEvents, upcoming);
      });
    });

    document.querySelectorAll('.event-simulate').forEach(btn => {
      btn.addEventListener('click', async () => {
        await this.simulateEvent(btn.dataset.id);
      });
    });
  }

  _bindEventCreate(roster, allEvents, upcoming) {
    document.querySelectorAll('.event-create').forEach(btn => {
      btn.addEventListener('click', async () => {
        const modalHtml = await EventsView.renderCreateModal(roster, this.seasonService);
        const baseHtml = await EventsView.render(allEvents, roster, upcoming, this.seasonService);
        LayoutView.render(baseHtml + modalHtml, false);
        this._bindEventCreate(roster, allEvents, upcoming);
      });
    });

    document.querySelectorAll('.add-fight').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.dataset.card;
        const container = document.getElementById(card === 'main' ? 'mainCardFights' : 'prelimCardFights');

        const byWeight = {};
        roster.forEach(f => {
          if (!byWeight[f.weightClass]) byWeight[f.weightClass] = [];
          byWeight[f.weightClass].push(f);
        });

        let options = '';
        for (const [wc, fighters] of Object.entries(byWeight)) {
          options += `<optgroup label="${wc}">`;
          fighters.sort((a, b) => b.overallRating - a.overallRating).forEach(f => {
            options += `<option value="${f.id}">${f.name} (${f.record.wins}-${f.record.losses}-${f.record.draws}) — OVR ${f.overallRating}</option>`;
          });
          options += '</optgroup>';
        }

        const slot = document.createElement('div');
        slot.className = 'flex gap-2 mb-2 fight-slot';
        slot.innerHTML = `
          <select class="form-select fight-select" data-card="${card}">${options}</select>
          <span class="flex items-center text-muted">vs</span>
          <select class="form-select fight-select" data-card="${card}">${options}</select>
          <button class="btn btn-sm btn-danger remove-fight">&times;</button>
        `;
        container.appendChild(slot);
        slot.querySelector('.remove-fight').addEventListener('click', () => slot.remove());
      });
    });

    document.querySelectorAll('.remove-fight').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.fight-slot').remove();
      });
    });

    // Auto-match buttons — fill selects based on ranking
    const globalUsedIds = new Set();
    const autoFillCard = (cardType, roster) => {
      // Group by weight class, sort by overall rating
      const byWeight = {};
      roster.forEach(f => {
        if (!byWeight[f.weightClass]) byWeight[f.weightClass] = [];
        byWeight[f.weightClass].push(f);
      });

      // Collect all fighters sorted by rating
      const allSorted = [...roster].sort((a, b) => b.overallRating - a.overallRating);

      // Find existing slots for this card type
      const containerId = cardType === 'main' ? 'mainCardFights' : 'prelimCardFights';
      const container = document.getElementById(containerId);
      if (!container) return;

      const slots = container.querySelectorAll('.fight-slot');

      // For main card: pick top fighters from each weight class
      // For prelim: pick next tier fighters
      let fighterPool;

      if (cardType === 'main') {
        // Main card: best from each weight class
        const topPerWeight = [];
        for (const [, fighters] of Object.entries(byWeight)) {
          const sorted = [...fighters].sort((a, b) => b.overallRating - a.overallRating);
          if (sorted.length >= 2) {
            topPerWeight.push(sorted[0], sorted[1]);
            globalUsedIds.add(sorted[0].id);
            globalUsedIds.add(sorted[1].id);
          }
        }
        fighterPool = topPerWeight.sort((a, b) => b.overallRating - a.overallRating);
      } else {
        // Prelim: remaining fighters not used in main
        fighterPool = allSorted.filter(f => !globalUsedIds.has(f.id));
        // Also mark prelim-used fighters
        fighterPool.forEach(f => globalUsedIds.add(f.id));
      }

      // Fill existing slots
      slots.forEach((slot, i) => {
        const selects = slot.querySelectorAll('.fight-select');
        if (selects.length < 2) return;

        if (i * 2 + 1 < fighterPool.length) {
          selects[0].value = fighterPool[i * 2].id;
          selects[1].value = fighterPool[i * 2 + 1].id;
        }
      });

      // Add more slots if we have more fighters
      let slotCount = slots.length;
      while (slotCount * 2 < fighterPool.length) {
        const newSlot = document.createElement('div');
        newSlot.className = 'flex gap-2 mb-2 fight-slot';
        const idx = slotCount;
        const options = roster.sort((a, b) => b.overallRating - a.overallRating).map(f =>
          `<option value="${f.id}">${f.name} (${f.weightClass}) — OVR ${f.overallRating}</option>`
        ).join('');
        newSlot.innerHTML = `
          <select class="form-select fight-select" data-card="${cardType}">${options}</select>
          <span class="flex items-center text-muted">vs</span>
          <select class="form-select fight-select" data-card="${cardType}">${options}</select>
          <button class="btn btn-sm btn-danger remove-fight">&times;</button>
        `;
        container.appendChild(newSlot);
        newSlot.querySelector('.remove-fight').addEventListener('click', () => newSlot.remove());

        const newSelects = newSlot.querySelectorAll('.fight-select');
        if (idx * 2 + 1 < fighterPool.length) {
          newSelects[0].value = fighterPool[idx * 2].id;
          newSelects[1].value = fighterPool[idx * 2 + 1].id;
        }
        slotCount++;
      }
    };

    document.querySelectorAll('.auto-fill-main').forEach(btn => {
      btn.addEventListener('click', () => autoFillCard('main', roster));
    });

    document.querySelectorAll('.auto-fill-prelim').forEach(btn => {
      btn.addEventListener('click', () => {
        autoFillCard('prelim', roster);
      });
    });

    document.querySelectorAll('.auto-fill-all').forEach(btn => {
      btn.addEventListener('click', () => {
        globalUsedIds.clear();
        autoFillCard('main', roster);
        autoFillCard('prelim', roster);
      });
    });

    document.querySelectorAll('.event-confirm-create').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = document.getElementById('eventName').value || 'Fight Night';
        const date = document.getElementById('eventDate').value;

        if (!date) {
          alert('Selecione uma data para o evento.');
          return;
        }

        const mainCard = [];
        const prelimCard = [];

        document.querySelectorAll('#mainCardFights .fight-slot').forEach(slot => {
          const selects = slot.querySelectorAll('.fight-select');
          if (selects.length >= 2) {
            mainCard.push({
              fighterAId: selects[0].value,
              fighterBId: selects[1].value,
            });
          }
        });

        document.querySelectorAll('#prelimCardFights .fight-slot').forEach(slot => {
          const selects = slot.querySelectorAll('.fight-select');
          if (selects.length >= 2) {
            prelimCard.push({
              fighterAId: selects[0].value,
              fighterBId: selects[1].value,
            });
          }
        });

        if (mainCard.length === 0 && prelimCard.length === 0) {
          alert('Adicione pelo menos uma luta ao card.');
          return;
        }

        const usedIds = new Set();
        const allIds = [...mainCard, ...prelimCard].flatMap(f => [f.fighterAId, f.fighterBId]);
        for (const id of allIds) {
          if (usedIds.has(id)) {
            alert('Um lutador não pode lutar duas vezes no mesmo evento.');
            return;
          }
          usedIds.add(id);
        }

        for (const fight of [...mainCard, ...prelimCard]) {
          if (fight.fighterAId === fight.fighterBId) {
            alert('Um lutador não pode lutar contra si mesmo.');
            return;
          }
        }

        await this.game.eventCtrl.createEvent({
          name,
          date: new Date(date).toISOString(),
          mainCard,
          prelimCard,
        });

        this.renderEvents();
      });
    });
  }

  async advanceWeek() {
    const weekState = await this.seasonService.advanceWeek();
    const weekLabel = `Semana ${weekState.week}, Ano ${weekState.year}`;

    // Process weekly costs (financial pressure)
    const costs = await this.game.processWeeklyCosts();
    const totalCost = costs.totalCost;

    // Process retirements (age/loss streak based)
    const retired = await this.game.processRetirements();
    for (const f of retired) {
      this.notificationService.add('info', 'Aposentadoria', `${f.name} se aposentou do MMA.`);
    }

    // Process draft (at year end)
    const drafted = await this.game.processDraft();
    if (drafted.length > 0) {
      this.notificationService.add('success', 'Nova Safra', `${drafted.length} novos lutadores disponíveis no mercado!`);
    }

    // Rival organizations hire free agents
    const hiredByRivals = await this.game.processRivalHires();
    if (hiredByRivals.length > 0) {
      this.notificationService.add('info', 'Mercado', `${hiredByRivals.length} lutadores foram contratados por organizações rivais.`);
    }

    // Generate weekly news
    const news = await this.game.generateWeeklyNews();
    for (const item of news) {
      this.notificationService.add('info', 'Notícia', item.text);
    }

    // Recovery
    await this.seasonService.applyWeeklyRecovery(this.game.fighterCtrl);

    this.notificationService.add('week-advance', 'Semana Iniciada', `${weekLabel}. Custos: $${totalCost.toLocaleString()}.`);
    this.renderDashboard();
  }

  async handleSaveLoad() {
    const saveInfo = await this.saveService.getSaveInfo();
    const hasSave = localStorage.getItem('mmaManagerSave') !== null;
    const html = NotificationsView.renderSaveLoad(saveInfo, hasSave);
    LayoutView.render(html);

    document.querySelectorAll('.save-load-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.dataset.action === 'save') {
          await this.saveService.saveSave();
          this.notificationService.add('success', 'Save', 'Jogo salvo com sucesso!');
          this.renderDashboard();
        } else if (btn.dataset.action === 'load') {
          await this.saveService.loadSave();
          this.notificationService.add('success', 'Load', 'Jogo carregado com sucesso!');
          this.renderDashboard();
        }
      });
    });
  }

  async handleRenewContract(fighterId) {
    const fighter = await this.game.fighterCtrl.getFighter(fighterId);
    if (!fighter) return;

    const newContract = {
      pursePerFight: fighter.contract?.pursePerFight || 10000,
      duration: 5,
      fightsRemaining: 5,
      victoryBonus: fighter.contract?.victoryBonus || 5000,
    };

    const updated = await this.game.fighterCtrl.renewContract(fighterId, newContract);
    if (updated) {
      this.notificationService.add('success', 'Contrato', `Contrato renovado para ${updated.name}!`);
      this.renderRoster();
    }
  }

  async handleAutoMatchmaker() {
    const roster = await this.game.fighterCtrl.getRoster('org-001');

    const byWeight = {};
    roster.forEach(f => {
      if (!byWeight[f.weightClass]) byWeight[f.weightClass] = [];
      byWeight[f.weightClass].push(f);
    });

    const mainCard = [];
    const prelimCard = [];

    for (const [weightClass, fighters] of Object.entries(byWeight)) {
      if (fighters.length < 2) continue;

      // Shuffle fighters randomly (Fisher-Yates)
      const pool = [...fighters];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      // Create fights from shuffled pool
      const used = new Set();
      for (let i = 0; i < pool.length; i += 2) {
        if (i + 1 >= pool.length) break;
        const a = pool[i];
        const b = pool[i + 1];
        if (used.has(a.id) || used.has(b.id)) continue;

        used.add(a.id);
        used.add(b.id);

        const fight = {
          fighterAId: a.id,
          fighterBId: b.id,
          weightClass,
          winner: null,
        };

        // First fight per weight class goes to main card, rest to prelim
        if (mainCard.length < Object.keys(byWeight).length) {
          mainCard.push(fight);
        } else {
          prelimCard.push(fight);
        }
      }
    }

    // Ensure main card has at least the last fight if any exist
    if (prelimCard.length > 0 && mainCard.length === 0) {
      mainCard.push(prelimCard.pop());
    }

    const totalFights = mainCard.length + prelimCard.length;
    if (totalFights === 0) {
      this.notificationService.add('warning', 'Auto-Matchmaker', 'Nao ha lutadores suficientes para criar lutas.');
      return;
    }

    const newEvent = new Event({
      id: 'evt-' + Date.now(),
      name: 'Auto-Matchmaker ' + new Date().toLocaleDateString('pt-BR'),
      date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      mainCard,
      prelimCard,
      status: 'scheduled',
    });

    await this.game.eventCtrl.createEvent(newEvent);
    this.notificationService.add('success', 'Auto-Matchmaker', `Evento criado com ${totalFights} lutas!`);
    this.renderEvents();
  }

  async simulateEvent(eventId) {
    const result = await this.game.simulateEvent(eventId);
    if (!result) return;

    // Check rivalries after fights
    const allFighters = await this.game.fighterCtrl.getAllFighters();
    for (const fightResult of result.results) {
      const fighterA = allFighters.find(f => f.id === fightResult.fighterAId);
      const fighterB = allFighters.find(f => f.id === fightResult.fighterBId);
      if (fighterA && fighterB) {
        await this.rivalryService.checkPostFight(fighterA, fighterB, fightResult, false);
      }
    }

    // Check Hall of Fame eligibility
    for (const fighter of allFighters) {
      const eligibility = HallOfFame.checkEligibility(fighter);
      if (eligibility.eligible) {
        const existing = await this.game.db.get('hallOfFame', fighter.id);
        if (!existing) {
          const entry = HallOfFame.induct(fighter);
          entry.id = fighter.id; // Use fighter id as key
          await this.game.db.put('hallOfFame', entry);
        }
      }
    }

    // Show milestone unlocks
    if (result.newUnlocks && result.newUnlocks.length > 0) {
      const unlockLabels = {
        firstEvent: '🎉 Primeiro Evento!',
        fiveEvents: '🔥 5 Eventos Realizados!',
        tenEvents: '💪 10 Eventos Realizados!',
        firstProfit: '💰 Primeiro Lucro!',
        threeProfit: '📈 3 Lucros Consecutivos!',
        superEvent: '⭐ Super Evento! Receita > $200k!',
        firstChampion: '🏆 Primeiro Campeão!',
        threeChamps: '👑 Campeão em 3 Divisões!',
      };
      const unlockHtml = result.newUnlocks.map(id => `
        <div class="card" style="border-top-color:var(--gold,#d4a843);margin-bottom:0.5rem;animation:slideIn 0.3s ease">
          <div class="flex items-center gap-2">
            <span style="font-size:1.5rem">🏆</span>
            <div>
              <div class="font-bold">Conquista Desbloqueada!</div>
              <div class="text-sm">${unlockLabels[id] || id}</div>
            </div>
          </div>
        </div>
      `).join('');
      document.getElementById('mainContent').insertAdjacentHTML('afterbegin', unlockHtml);
    }

    const html = EventsView.renderSimulation(result.event, result.results);
    LayoutView.render(html);

    document.querySelectorAll('.event-back').forEach(btn => {
      btn.addEventListener('click', () => {
        this.renderEvents();
      });
    });

    // Expand fight details
    document.querySelectorAll('.fight-result-card').forEach(card => {
      card.addEventListener('click', () => {
        const targetId = card.dataset.expand;
        const details = document.getElementById(targetId);
        if (details) {
          const isVisible = details.style.display !== 'none';
          details.style.display = isVisible ? 'none' : 'block';
        }
      });
    });
  }

  async showFighterProfile(fighterId) {
    const fighter = await this.game.fighterCtrl.getFighter(fighterId);
    if (!fighter) return;

    const html = FighterProfileView.render(fighter, fighter.fights);
    LayoutView.render(html);

    document.querySelectorAll('.fighter-back').forEach(btn => {
      btn.addEventListener('click', () => {
        this.navigateTo(this.previousView);
      });
    });
  }

  // ===== Training Camp =====
  async renderTrainingCamp() {
    const roster = await this.game.fighterCtrl.getRoster('org-001');
    const html = TrainingCampView.render(roster);
    LayoutView.render(html);
    this._bindTrainingCamp(roster);
  }

  _bindTrainingCamp(roster) {
    const select = document.getElementById('trainingFighterSelect');
    if (!select) return;

    select.addEventListener('change', () => {
      const options = document.getElementById('trainingOptions');
      if (select.value) {
        options.style.display = 'block';
      } else {
        options.style.display = 'none';
      }
    });

    document.querySelectorAll('.training-intensity').forEach(btn => {
      btn.addEventListener('click', () => {
        this.trainingState.intensity = btn.dataset.intensity;
        document.querySelectorAll('.training-intensity').forEach(b => {
          b.classList.remove('btn-primary');
          b.classList.add('btn-secondary');
        });
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
        this._checkTrainingReady();
      });
    });

    document.querySelectorAll('.training-spec').forEach(btn => {
      btn.addEventListener('click', () => {
        this.trainingState.spec = btn.dataset.spec;
        document.querySelectorAll('.training-spec').forEach(b => {
          b.classList.remove('btn-primary');
          b.classList.add('btn-secondary');
        });
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
        this._checkTrainingReady();
      });
    });

    document.getElementById('startTrainingBtn')?.addEventListener('click', async () => {
      const fighterId = select.value;
      if (!fighterId || !this.trainingState.intensity || !this.trainingState.spec) return;

      const fighter = await this.game.fighterCtrl.getFighter(fighterId);
      if (!fighter) return;

      const result = TrainingCamp.runCamp(fighter, this.trainingState.intensity, this.trainingState.spec);
      await this.game.fighterCtrl.saveFighter(fighter);

      // Show result
      const resultContent = document.getElementById('trainingResultContent');
      resultContent.innerHTML = TrainingCampView.renderResult(result, fighter);
      document.getElementById('trainingResult').style.display = 'block';

      // Reset selections
      this.trainingState = { intensity: null, spec: null };
      document.querySelectorAll('.training-intensity').forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-secondary');
      });
      document.querySelectorAll('.training-spec').forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-secondary');
      });
      document.getElementById('startTrainingBtn').disabled = true;
    });
  }

  _checkTrainingReady() {
    const btn = document.getElementById('startTrainingBtn');
    if (btn) {
      btn.disabled = !(this.trainingState.intensity && this.trainingState.spec);
    }
  }

  // ===== Rivalries =====
  async renderRivalries() {
    const rivalries = await this.rivalryService.getAllActive();
    const fighters = await this.game.fighterCtrl.getAllFighters();
    const html = RivalriesView.render(rivalries, fighters);
    LayoutView.render(html);
  }

  // ===== Hall of Fame =====
  async renderHallOfFame() {
    const entries = await this.game.db.getAll('hallOfFame');
    const html = HallOfFameView.render(entries);
    LayoutView.render(html);
  }

  async renderNotifications() {
    const notifications = await this.notificationService.getAll();
    const unreadCount = notifications.filter(n => !n.read).length;
    const html = NotificationsView.render(notifications, unreadCount);
    LayoutView.render(html);
  }

  async renderPressConference() {
    const roster = await this.game.fighterCtrl.getRoster('org-001');
    const upcoming = await this.game.eventCtrl.getUpcomingEvents();
    const event = upcoming[0] || { name: 'Próximo Evento' };
    const fighterA = roster[0] || { name: 'N/A', record: { wins: 0, losses: 0, draws: 0 } };
    const fighterB = roster[1] || { name: 'N/A', record: { wins: 0, losses: 0, draws: 0 } };
    const scenarios = PressConference.getScenarios();
    const html = PressConferenceView.render(scenarios, fighterA, fighterB, event);
    LayoutView.render(html);

    document.querySelectorAll('.pc-answer').forEach(btn => {
      btn.addEventListener('click', async () => {
        const questionIndex = parseInt(btn.dataset.question);
        const optionIndex = parseInt(btn.dataset.option);
        const option = scenarios[questionIndex].options[optionIndex];
        PressConference.applyEffects(fighterA, option.effects);
        await this.game.fighterCtrl.updateFighter(fighterA);
        const current = document.querySelector(`.pc-question[data-index="${questionIndex}"]`);
        current.style.display = 'none';
        const next = document.querySelector(`.pc-question[data-index="${questionIndex + 1}"]`);
        if (next) {
          next.style.display = 'block';
        } else {
          const totalHype = PressConference.getTotalHype(option.effects);
          const summary = PressConferenceView.renderSummary(option.effects, totalHype);
          document.getElementById('pressConferenceSummary').innerHTML = summary;
          document.getElementById('pressConferenceSummary').style.display = 'block';
          document.getElementById('pcSimulateBtn').style.display = 'none';
          this.notificationService.add('success', 'Imprensa', 'Conferência de imprensa concluída!');
        }
      });
    });
  }
}

const app = new App();
app.init();

window.app = app;
