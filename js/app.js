import { LayoutView } from './views/layout.js';
import { DashboardView } from './views/dashboard.js';
import { RosterView } from './views/roster.js';
import { MarketView } from './views/market.js';
import { EventsView } from './views/events.js';
import { FighterProfileView } from './views/fighter-profile.js';
import { GameController } from './controllers/game-controller.js';

class App {
  constructor() {
    this.game = new GameController();
    this.currentView = 'dashboard';
    this.rosterFilter = '';
    this.marketFilter = '';
    this.previousView = 'dashboard';
  }

  async init() {
    LayoutView.initNavigation();
    await this.game.init();

    window.addEventListener('navigate', (e) => {
      this.navigateTo(e.detail.view);
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
      default:
        await this.renderDashboard();
    }
  }

  async renderDashboard() {
    const data = await this.game.getDashboard();
    const html = DashboardView.render(data);
    LayoutView.render(html);

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
    const html = MarketView.render(agents, this.marketFilter);
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

    document.querySelectorAll('.market-hire').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fighter = await this.game.fighterCtrl.getFighter(btn.dataset.id);
        if (!fighter) return;

        const currentAgents = agents;
        const modalHtml = MarketView.renderHireModal(fighter);
        const baseHtml = MarketView.render(currentAgents, this.marketFilter);
        LayoutView.render(baseHtml + modalHtml);

        this._bindMarket(currentAgents);
        this._bindHireModal(fighter);
      });
    });

    document.querySelectorAll('.market-confirm-hire').forEach(btn => {
      btn.addEventListener('click', async () => {
        const purse = parseInt(document.getElementById('hirePurse').value) || 10000;
        const duration = parseInt(document.getElementById('hireDuration').value) || 3;
        const bonus = parseInt(document.getElementById('hireBonus').value) || 5000;

        await this.game.fighterCtrl.hireFighter(btn.dataset.id, 'org-001', {
          pursePerFight: purse,
          duration,
          victoryBonus: bonus,
          fightsRemaining: duration,
        });

        this.marketFilter = '';
        this.renderMarket();
      });
    });

    document.querySelectorAll('.market-refresh').forEach(btn => {
      btn.addEventListener('click', async () => {
        await this.game.refreshFreeAgents();
        this.marketFilter = '';
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
    const html = EventsView.render(allEvents, roster, upcoming);
    LayoutView.render(html);

    document.querySelectorAll('.event-create').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalHtml = EventsView.renderCreateModal(roster);
        const baseHtml = EventsView.render(allEvents, roster, upcoming);
        LayoutView.render(baseHtml + modalHtml);
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
      btn.addEventListener('click', () => {
        const modalHtml = EventsView.renderCreateModal(roster);
        const baseHtml = EventsView.render(allEvents, roster, upcoming);
        LayoutView.render(baseHtml + modalHtml);
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

  async simulateEvent(eventId) {
    const result = await this.game.simulateEvent(eventId);
    if (!result) return;

    const html = EventsView.renderSimulation(result.event, result.results);
    LayoutView.render(html);

    document.querySelectorAll('.event-back').forEach(btn => {
      btn.addEventListener('click', () => {
        this.renderEvents();
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
}

const app = new App();
app.init();

window.app = app;
