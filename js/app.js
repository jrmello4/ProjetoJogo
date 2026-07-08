import { LayoutView } from './views/layout.js';
import { DashboardView } from './views/dashboard.js';
import { RosterView } from './views/roster.js';
import { MarketView } from './views/market.js';
import { EventsView } from './views/events.js';
import { OffersView } from './views/offers.js';
import { AcademyView } from './views/academy.js';
import { FighterProfileView } from './views/fighter-profile.js';
import { TrainingCampView } from './views/training-camp.js';
import { RivalriesView } from './views/rivalries.js';
import { PressConferenceView } from './views/press-conference.js';
import { HallOfFameView } from './views/hall-of-fame.js';
import { RankingsView } from './views/rankings.js';
import { FinanceView } from './views/finance.js';
import { RankingService } from './services/ranking.js';
import { NotificationsView } from './views/notifications.js';
import { GameController } from './controllers/game-controller.js';
import { TrainingCamp } from './controllers/training-camp.js';
import { PressConference } from './controllers/press-conference.js';
import { RivalryService } from './services/rivalry-service.js';
import { SeasonService } from './services/season-service.js';
import { NotificationService } from './services/notification-service.js';
import { SaveService } from './services/save-service.js';
import { ThreeArena } from './three-arena.js';
import { ThreeBackground } from './three-background.js';
import { motion } from './motion/motion-engine.js';
import { DIFFICULTIES, MILESTONE_LABELS, SIMULATE_PERIOD_PRESETS, TRAINING_FOCUS_META, absWeekToLabel, GYM_CONFIG } from './config/game-config.js';
import { getWeightClassName, formatCurrency } from './utils/helpers.js';

class App {
  constructor() {
    this.game = new GameController();
    this.currentView = 'dashboard';
    this.marketFilter = '';
    this.marketSearch = '';
    this.previousView = 'dashboard';
    this.rivalryService = null;
    this.trainingState = { intensity: null, spec: null };
    this.seasonService = new SeasonService(this.game.db);
    this.notificationService = new NotificationService(this.game.db);
    this.saveService = new SaveService(this.game.db);
    this.threeArena = null;
    this.threeBackground = null;
  }

  async init() {
    try { motion.init(); } catch(e) { console.warn('Motion init failed:', e); }
    LayoutView.initNavigation();
    try {
      await this.game.init();
    } catch (err) {
      console.error('Failed to init game:', err);
      document.getElementById('mainContent').innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:60vh;flex-direction:column;gap:1rem;">
          <h2 style="color:var(--accent)">Erro ao carregar banco de dados</h2>
          <p style="color:var(--text-secondary);text-align:center;max-width:500px;">
            O banco de dados pode estar corrompido ou bloqueado. Feche todas as abas do jogo e tente novamente.
            Se persistir, clique em "Resetar Dados" no menu lateral.
          </p>
          <button class="btn btn-primary" onclick="location.reload()">Tentar Novamente</button>
        </div>
      `;
      return;
    }
    this.rivalryService = new RivalryService(this.game.db);

    this.threeBackground = new ThreeBackground('mainContent');

    window.addEventListener('navigate', (e) => {
      this.navigateTo(e.detail.view);
    });

    // Delegação global para botões de navegação renderizados nas views
    document.addEventListener('click', (e) => {
      const navEl = e.target.closest('[data-nav]');
      if (navEl) {
        this.navigateTo(navEl.dataset.nav);
      }
    });

    this.navigateTo('dashboard');
    this._maybeShowOnboarding();
  }

  // ===== Onboarding: nome da academia + dificuldade + equipe inicial =====
  async _maybeShowOnboarding() {
    if (localStorage.getItem('gymOnboardingDone')) return;
    const gym = await this.game.getGym();
    if (gym.wins + gym.losses > 0) {
      localStorage.setItem('gymOnboardingDone', '1');
      return;
    }

    const team = await this.game.getTeam();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'onboardingModal';
    modal.innerHTML = `
      <div class="modal" style="max-width:620px">
        <div class="modal-header">
          <h3>Bem-vindo à sua Academia</h3>
        </div>
        <p class="text-sm" style="color:var(--text-secondary)">
          Você é o treinador e dono de uma academia de MMA. Desenvolva seus atletas,
          aceite as lutas certas e leve sua equipe do circuito regional à elite mundial:
        </p>
        <div class="onboarding-steps">
          <div class="onboarding-step"><div class="onboarding-step-icon">🥋</div><div class="onboarding-step-label">Treine sua equipe</div></div>
          <div class="onboarding-step"><div class="onboarding-step-icon">📩</div><div class="onboarding-step-label">Aceite ofertas de luta</div></div>
          <div class="onboarding-step"><div class="onboarding-step-icon">🥊</div><div class="onboarding-step-label">Vença nos eventos</div></div>
          <div class="onboarding-step"><div class="onboarding-step-icon">🏆</div><div class="onboarding-step-label">Chegue à elite mundial</div></div>
        </div>

        <div class="form-group">
          <label class="form-label">Sua equipe inicial</label>
          <div class="grid grid-cols-3 gap-2">
            ${team.map(f => `
              <div class="card" style="padding:0.6rem">
                <div class="text-sm font-bold">${f.name}</div>
                <div class="text-xs text-muted">${getWeightClassName(f.weightClass)} · ${f.age} anos</div>
                <div class="text-xs">OVR ${f.overallRating} · ${f.record.wins}-${f.record.losses}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Nome da sua academia</label>
          <input type="text" class="form-input" id="onboardingGymName" maxlength="40" value="" placeholder="Ex: Alpha Team BR">
        </div>

        <div class="form-group">
          <label class="form-label">Dificuldade</label>
          <div class="difficulty-grid">
            ${DIFFICULTIES.map(d => `
              <div class="difficulty-option ${d.id === 'normal' ? 'selected' : ''}" data-difficulty="${d.id}" data-cash="${d.cash}">
                <div class="difficulty-name">${d.name}</div>
                <div class="difficulty-cash">$${(d.cash / 1000).toFixed(0)}k iniciais</div>
                <div class="text-xs text-muted mt-2">${d.desc}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-primary w-full" id="onboardingStartBtn">Abrir a academia</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll('.difficulty-option').forEach(opt => {
      opt.addEventListener('click', () => {
        modal.querySelectorAll('.difficulty-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });

    modal.querySelector('#onboardingStartBtn').addEventListener('click', async () => {
      const name = modal.querySelector('#onboardingGymName').value.trim() || 'Alpha Team BR';
      const selected = modal.querySelector('.difficulty-option.selected');
      const cash = parseInt(selected?.dataset.cash) || 35000;

      const freshGym = await this.game.getGym();
      freshGym.name = name;
      freshGym.cash = cash;
      await this.game.updateGym(freshGym);

      localStorage.setItem('gymOnboardingDone', '1');
      modal.remove();
      this.notificationService.add('success', 'Academia Aberta', `${name} está de portas abertas. Confira as ofertas de luta na mesa, treinador!`);
      this.renderDashboard();
    });
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
      case 'offers':
        await this.renderOffers();
        break;
      case 'events':
        await this.renderEvents();
        break;
      case 'training':
        await this.renderTrainingCamp();
        break;
      case 'academy':
        await this.renderAcademy();
        break;
      case 'rivalries':
        await this.renderRivalries();
        break;
      case 'rankings':
        await this.renderRankings();
        break;
      case 'finance':
        await this.renderFinance();
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

  // ===== Dashboard =====
  async renderDashboard() {
    const data = await this.game.getDashboard();
    const weekLabel = absWeekToLabel(data.now);
    const html = DashboardView.render(data, weekLabel);
    await LayoutView.render(html);

    this.initThreeArena();

    document.getElementById('weekAdvanceBtn')?.addEventListener('click', () => this.advanceWeek());
    document.getElementById('saveLoadBtn')?.addEventListener('click', () => this.handleSaveLoad());
    document.getElementById('simulatePeriodBtn')?.addEventListener('click', () => this.openSimulatePeriod());

    // Patrocínios: fechar/recusar direto do dashboard
    document.querySelectorAll('[data-sponsor-accept]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const result = await this.game.acceptSponsorOffer(btn.dataset.sponsorAccept);
        if (!result.ok) {
          await this.notificationService.add('warning', 'Patrocínio Falhou', result.reason);
        }
        this.renderDashboard();
      });
    });
    document.querySelectorAll('[data-sponsor-decline]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await this.game.declineSponsorOffer(btn.dataset.sponsorDecline);
        this.renderDashboard();
      });
    });

    this._bindFighterClicks();
    this._bindEventClicks();
  }

  initThreeArena() {
    const container = document.getElementById('octagonArena');
    if (!container) return;

    if (this.threeArena) {
      this.threeArena.dispose();
      this.threeArena = null;
    }

    const oldCanvases = container.querySelectorAll('canvas');
    oldCanvases.forEach(c => c.remove());

    requestAnimationFrame(() => {
      this.threeArena = new ThreeArena('octagonArena');
      motion.refresh();
    });
  }

  // ===== Tick semanal: o coração do jogo =====
  async advanceWeek() {
    const btn = document.getElementById('weekAdvanceBtn');
    if (btn) btn.disabled = true;

    // Instruções de córner ao vivo: só existem para a(s) luta(s) do
    // jogador nesta semana; o WorldService chama isso entre rounds.
    const cornerHooks = {
      onFightStart: async ({ fighter, opponent, promo }) => {
        const html = EventsView.renderCornerFightIntro(fighter, opponent, promo.name);
        await LayoutView.render(html);
        await new Promise(r => setTimeout(r, 1000));
      },
      onRoundEnd: (info) => new Promise((resolve) => {
        const html = EventsView.renderCornerRound({
          fighterName: info.fighter.name,
          opponentName: info.opponent.name,
          round: info.round,
          roundResult: info.roundResult,
          totalScoreA: info.totalScoreA,
          totalScoreB: info.totalScoreB,
        });
        LayoutView.render(html).then(() => {
          document.querySelectorAll('.corner-choice').forEach(b => {
            b.addEventListener('click', () => resolve(b.dataset.instruction));
          });
        });
      }),
    };

    const summary = await this.game.processWeek(cornerHooks);
    const { world, offersCreated, economy, milestonesUnlocked, now } = summary;

    // Rivalidades e narrativa pós-luta dos atletas do jogador
    for (const evt of world.playerEvents) {
      for (const result of evt.playerResults) {
        const fighterA = await this.game.fighterCtrl.getFighter(result.fighterAId);
        const fighterB = await this.game.fighterCtrl.getFighter(result.fighterBId);
        if (fighterA && fighterB) {
          await this.rivalryService.checkPostFight(fighterA, fighterB, result, result.card === 'main');
        }
      }
    }

    // Conquistas desbloqueadas
    for (const id of milestonesUnlocked) {
      await this.notificationService.add('achievement', 'Conquista Desbloqueada!', MILESTONE_LABELS[id] || id);
    }

    await this.notificationService.add(
      'week-advance',
      'Semana Iniciada',
      `${absWeekToLabel(now)}. Fluxo da academia: ${economy.net >= 0 ? '+' : ''}$${economy.net.toLocaleString()}${offersCreated.length > 0 ? ` · ${offersCreated.length} nova${offersCreated.length === 1 ? '' : 's'} oferta${offersCreated.length === 1 ? '' : 's'} de luta` : ''}.`
    );

    // Se um atleta da academia lutou, mostra o recap completo do card
    const featured = world.playerEvents[0];
    if (featured) {
      const html = EventsView.renderLiveSimulation(featured.event, featured.results, featured.playerFighterIds);
      await LayoutView.render(html);
      this._playLiveBroadcast();
      document.querySelectorAll('.event-back').forEach(b => {
        b.addEventListener('click', () => this.renderDashboard());
      });
      return;
    }

    this.renderDashboard();
  }

  // ===== Simular Período (fast-forward de semanas/meses/anos) =====
  async openSimulatePeriod() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'simulatePeriodModal';
    modal.innerHTML = `
      <div class="modal" style="max-width:520px">
        <div class="modal-header">
          <h3>Simular Período</h3>
          <button class="modal-close" data-close="simulatePeriodModal">&times;</button>
        </div>
        <p class="text-sm" style="color:var(--text-secondary)">
          Avance várias semanas de uma vez, sem instruções de córner. Ofertas de luta compatíveis são
          <strong>aceitas automaticamente</strong> — a academia não fica parada enquanto você está fora.
        </p>

        <div class="form-group">
          <label class="form-label">Foco de Treino da Equipe no Período</label>
          <div class="flex gap-2" style="flex-wrap:wrap">
            <button class="btn btn-sm btn-primary sim-focus-option" data-focus="">Manter escolhas individuais</button>
            ${Object.entries(TRAINING_FOCUS_META).map(([key, meta]) => `
              <button class="btn btn-sm btn-secondary sim-focus-option" data-focus="${key}">${meta.icon} ${meta.label}</button>
            `).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Duração</label>
          <div class="difficulty-grid" style="grid-template-columns:repeat(2,1fr)">
            ${SIMULATE_PERIOD_PRESETS.map(p => `
              <div class="difficulty-option" data-weeks="${p.weeks}">
                <div class="difficulty-name">${p.label}</div>
                <div class="difficulty-cash">${p.weeks} semanas</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    let selectedFocus = '';
    modal.querySelectorAll('.sim-focus-option').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedFocus = btn.dataset.focus;
        modal.querySelectorAll('.sim-focus-option').forEach(b => {
          b.classList.remove('btn-primary');
          b.classList.add('btn-secondary');
        });
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
      });
    });

    modal.querySelectorAll('.difficulty-option').forEach(opt => {
      opt.addEventListener('click', async () => {
        const weeks = parseInt(opt.dataset.weeks);
        modal.remove();
        await this.runSimulatePeriod(weeks, selectedFocus || null);
      });
    });
  }

  async runSimulatePeriod(weeks, trainingFocus) {
    await LayoutView.render(`
      <div class="page-header">
        <h2>Simulando...</h2>
        <p>Avançando ${weeks} semanas na sua academia</p>
      </div>
      <div class="empty-state"><p>O tempo está passando — isso pode levar alguns segundos.</p></div>
    `, false);

    const result = await this.game.simulateWeeks(weeks, { trainingFocus });

    const html = EventsView.renderPeriodSummary(result);
    await LayoutView.render(html);
    document.querySelector('.summary-back')?.addEventListener('click', () => this.renderDashboard());
  }

  // ===== Ofertas =====
  async renderOffers() {
    const state = await this.seasonService.getState();
    const now = (state.year - 1) * 52 + state.week;
    const pending = await this.game.offerService.getPending();
    const accepted = await this.game.offerService.getAccepted();
    const history = await this.game.offerService.getHistory();
    const team = await this.game.getTeam();

    // Dossiê de cada adversário já contratado — o que você sabe (ou não).
    const dossiers = {};
    for (const o of accepted) {
      const d = await this.game.opponentDossier(o);
      if (d) dossiers[o.id] = d;
    }

    // Épico B: carregar propostas de contrato pendentes
    const contractProposals = await this._loadContractProposals(team);

    const html = OffersView.render(pending, accepted, history, team, now, dossiers, contractProposals);
    await LayoutView.render(html);

    document.querySelectorAll('.study-opponent').forEach(btn => {
      btn.addEventListener('click', async () => {
        const offer = accepted.find(o => o.id === btn.dataset.id);
        const result = await this.game.studyOpponent(offer.opponentId);
        if (!result.ok) this.notificationService.add('warning', 'Scouting', result.reason);
        this.renderOffers();
      });
    });

    document.querySelectorAll('.plan-option').forEach(btn => {
      btn.addEventListener('click', async () => {
        await this.game.setGamePlan(btn.dataset.offer, btn.dataset.plan);
        this.renderOffers();
      });
    });

    document.querySelectorAll('.offer-accept').forEach(btn => {
      btn.addEventListener('click', async () => {
        await this.game.offerService.accept(btn.dataset.id, now);
        this.renderOffers();
      });
    });

    document.querySelectorAll('.offer-decline').forEach(btn => {
      btn.addEventListener('click', async () => {
        await this.game.offerService.decline(btn.dataset.id);
        this.notificationService.add('info', 'Oferta Recusada', 'A promoção seguirá procurando outros lutadores.');
        this.renderOffers();
      });
    });

    document.querySelectorAll('.negotiate-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = document.querySelector(`.negotiate-panel[data-panel="${btn.dataset.id}"]`);
        if (panel) panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
      });
    });

    document.querySelectorAll('.negotiate-option').forEach(btn => {
      btn.addEventListener('click', async () => {
        const offer = pending.find(o => o.id === btn.dataset.id);
        const fighter = team.find(f => f.id === offer?.fighterId);
        const gym = await this.game.getGym();
        const result = await this.game.offerService.negotiate(btn.dataset.id, parseInt(btn.dataset.bump), fighter, gym);

        if (!result.ok) {
          this.notificationService.add('warning', 'Negociação Falhou', result.reason);
        } else {
          const messages = {
            accepted: 'A promoção aceitou o novo valor da bolsa!',
            countered: 'A promoção recusou o valor pedido, mas ofereceu um meio-termo.',
            refused: 'A promoção recusou o aumento — a bolsa original segue de pé.',
            rescinded: 'A promoção se incomodou com o pedido e cancelou a oferta.',
          };
          this.notificationService.add(result.outcome === 'rescinded' ? 'warning' : 'info', 'Negociação de Bolsa', messages[result.outcome] || '');
        }
        this.renderOffers();
      });
    });

    // Épico B: aceitar/recusar proposta de contrato
    document.querySelectorAll('.contract-accept').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fighterId = btn.dataset.fighter;
        const promoId = btn.dataset.promo;
        const result = await this.game.contractService.accept(fighterId, promoId, now);
        if (result) {
          this.notificationService.add('success', 'Contrato Assinado!', `${result.name} agora é exclusivo da promoção.`);
        }
        this.renderOffers();
      });
    });

    document.querySelectorAll('.contract-decline').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fighterId = btn.dataset.fighter;
        await this.game.contractService.decline(fighterId);
        this.notificationService.add('info', 'Proposta Recusada', 'Ofertas futuras de outras promoções ainda podem aparecer.');
        this.renderOffers();
      });
    });
  }

  // Épico B: carregar propostas de contrato pendentes do banco
  async _loadContractProposals(team) {
    const proposals = [];
    for (const fighter of team) {
      try {
        const doc = await this.game.db.get('gameState', `contract-offer-${fighter.id}`);
        if (doc && doc.offers) {
          for (const offer of doc.offers) {
            proposals.push({ ...offer, fighterId: fighter.id });
          }
        }
      } catch { /* sem propostas para este lutador */ }
    }
    return proposals;
  }

  // ===== Minha Equipe =====
  async renderRoster() {
    const team = await this.game.getTeam();
    const bookings = await this.game.offerService.getAccepted();
    const state = await this.seasonService.getState();
    const now = (state.year - 1) * 52 + state.week;

    // Épico A: carregar sondagens ativas
    const approaches = await this._loadRetentionApproaches();

    const html = RosterView.render(team, bookings, now, approaches);
    await LayoutView.render(html);

    this._bindFighterClicks();

    document.querySelectorAll('.roster-release').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Dispensar ${btn.dataset.name} da equipe? Ele volta ao mercado.`)) return;
        await this.game.fighterCtrl.releaseFromGym(btn.dataset.id);
        this.notificationService.add('info', 'Dispensa', `${btn.dataset.name} deixou a academia.`);
        this.renderRoster();
      });
    });

    document.querySelectorAll('.training-focus-set').forEach(btn => {
      btn.addEventListener('click', async () => {
        await this.game.setTrainingFocus(btn.dataset.id, btn.dataset.focus);
        this.renderRoster();
      });
    });

    // Épico A: responder a sondagem
    document.querySelectorAll('.retention-respond').forEach(btn => {
      btn.addEventListener('click', async () => {
        const approachId = btn.dataset.approach;
        const action = btn.dataset.action;
        const gym = await this.game.getGym();

        // Encontrar o fighter pelo approach
        const approaches2 = await this._loadRetentionApproaches();
        const approach = approaches2.find(a => a.id === approachId);
        if (!approach) return;

        const fighter = await this.game.fighterCtrl.getFighter(approach.fighterId);
        if (!fighter) return;

        const result = await this.game.retentionService.respond(now, approachId, action, fighter, gym);
        await this.game.fighterCtrl.updateFighter(fighter);
        await this.game.updateGym(gym);

        if (result.success) {
          this.notificationService.add(result.outcome === 'released' ? 'warning' : 'success', 'Retenção', result.message);
        } else {
          this.notificationService.add('warning', 'Retenção', result.message || 'Não foi possível realizar esta ação.');
        }

        this.renderRoster();
      });
    });
  }

  // Épico A: carregar sondagens ativas do banco
  async _loadRetentionApproaches() {
    try {
      const doc = await this.game.db.get('gameState', 'retention');
      return doc ? doc.approaches || [] : [];
    } catch {
      return [];
    }
  }

  // ===== Recrutamento =====
  async renderMarket() {
    const agents = await this.game.fighterCtrl.getFreeAgents();
    const gym = await this.game.getGym();
    const team = await this.game.getTeam();

    const knowledge = await this.game.scoutingService.knowledgeMap(agents, gym);

    const html = MarketView.render(
      agents, gym, team.length,
      this.marketFilter, this.marketSearch,
      (f) => this.game.recruitFee(f),
      knowledge
    );
    await LayoutView.render(html);

    this._bindFighterClicks();

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

    document.querySelectorAll('.market-recruit').forEach(btn => {
      btn.addEventListener('click', async () => {
        const result = await this.game.recruitFighter(btn.dataset.id);
        if (result.ok) {
          this.notificationService.add('success', 'Novo Atleta', `${result.fighter.name} agora treina na sua academia! Taxa: $${result.fee.toLocaleString()}.`);
          this.renderMarket();
        } else {
          this.notificationService.add('warning', 'Recrutamento Falhou', result.reason);
        }
      });
    });
  }

  // ===== Mundo (eventos das promoções) =====
  async renderEvents() {
    const promotions = await this.game.worldService.getPromotions();
    const pastEvents = (await this.game.eventCtrl.getAllEvents()).slice(0, 20);
    const bookings = await this.game.offerService.getAccepted();
    const state = await this.seasonService.getState();
    const now = (state.year - 1) * 52 + state.week;

    const html = EventsView.render(promotions, pastEvents, bookings, now);
    await LayoutView.render(html);

    document.querySelectorAll('.event-details').forEach(btn => {
      btn.addEventListener('click', () => this.showEventDetails(btn.dataset.id));
    });
  }

  async showEventDetails(eventId) {
    const event = await this.game.eventCtrl.getEvent(eventId);
    if (!event) return;

    const team = await this.game.getTeam();
    const playerIds = new Set(team.map(f => f.id));

    const html = EventsView.renderSimulation(event, event.results || [], playerIds);
    await LayoutView.render(html);

    document.querySelectorAll('.event-back').forEach(btn => {
      btn.addEventListener('click', () => this.renderEvents());
    });

    document.querySelectorAll('[data-expand]').forEach(card => {
      card.addEventListener('click', () => {
        const target = document.getElementById(card.dataset.expand);
        if (target) target.style.display = target.style.display === 'none' ? 'block' : 'none';
      });
    });
  }

  _playLiveBroadcast() {
    const status = document.getElementById('liveStatus');
    const fights = Array.from(document.querySelectorAll('#liveFights .live-fight'));
    const summary = document.getElementById('liveSummary');
    const skipBtn = document.getElementById('skipLiveBtn');
    let idx = 0;
    let timer = null;

    const finish = () => {
      clearTimeout(timer);
      fights.forEach(f => f.classList.add('live-fight--shown'));
      if (summary) summary.classList.add('live-fight--shown');
      if (status) status.textContent = 'Evento encerrado';
      if (skipBtn) skipBtn.style.display = 'none';
      const dot = document.querySelector('.live-dot');
      if (dot) dot.style.animation = 'none';
    };

    const showNext = () => {
      if (idx >= fights.length) {
        finish();
        return;
      }
      fights[idx].classList.add('live-fight--shown');
      if (status) status.textContent = `Luta ${idx + 1} de ${fights.length} encerrada`;
      fights[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      idx++;
      timer = setTimeout(showNext, 1600);
    };

    if (fights.length === 0) {
      finish();
      return;
    }

    skipBtn?.addEventListener('click', finish);
    timer = setTimeout(showNext, 700);
  }

  async showFighterProfile(fighterId) {
    const fighter = await this.game.fighterCtrl.getFighter(fighterId);
    if (!fighter) return;

    const html = FighterProfileView.render(fighter, fighter.fights);
    await LayoutView.render(html);

    document.querySelectorAll('.fighter-back').forEach(btn => {
      btn.addEventListener('click', () => {
        this.navigateTo(this.previousView);
      });
    });
  }

  // ===== Training Camp =====
  async renderTrainingCamp() {
    const team = await this.game.getTeam();
    const html = TrainingCampView.render(team);
    await LayoutView.render(html);
    this._bindTrainingCamp(team);
  }

  _bindTrainingCamp(team) {
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

      // B3: Anti-exploit — cooldown semanal
      const absWeekNow = this.game.state.absWeek;
      if (fighter.lastTrainedAbsWeek === absWeekNow) {
        alert('Este lutador já treinou esta semana. Espere a próxima semana.');
        return;
      }

      // B3: Sem luta marcada, bloquear treino intenso
      const hasFight = this.game.state.offers?.accepted?.some(o => o.fighterId === fighterId);
      if (!hasFight && this.trainingState.intensity === 'heavy') {
        alert('Treino pesado só é permitido quando o lutador tem uma luta marcada.');
        return;
      }

      // B3: Cobrar custo do treino
      const cost = GYM_CONFIG.WEEKLY_COACHING_PER_FIGHTER * 2;
      const gym = this.game.state.gym;
      if (gym.cash < cost) {
        alert(`Saldo insuficiente. O treino custa ${formatCurrency(cost)}.`);
        return;
      }
      gym.addTransaction(absWeekNow, `Treino: ${fighter.name}`, -cost);

      const result = TrainingCamp.runCamp(fighter, this.trainingState.intensity, this.trainingState.spec, absWeekNow);
      fighter.lastTrainedAbsWeek = absWeekNow;
      await this.game.fighterCtrl.saveFighter(fighter);

      const resultContent = document.getElementById('trainingResultContent');
      resultContent.innerHTML = TrainingCampView.renderResult(result, fighter);
      document.getElementById('trainingResult').style.display = 'block';

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

  // ===== Rankings =====
  async renderRankings() {
    const allFighters = await this.game.fighterCtrl.getAllFighters();
    const active = allFighters.filter(f => f.status !== 'retired');
    const rankings = RankingService.calculateRankings(active);
    const belts = await this.game.titleService.getBeltMap();
    const html = RankingsView.render(rankings, belts);
    await LayoutView.render(html);
    this._bindFighterClicks();
  }

  // ===== Finanças =====
  async renderFinance() {
    const gym = await this.game.getGym();
    const team = await this.game.getTeam();
    const html = FinanceView.render(gym, team.length);
    await LayoutView.render(html);
  }

  // ===== Academia (estrutura, treinadores, olheiro) =====
  async renderAcademy() {
    const gym = await this.game.getGym();
    const html = AcademyView.render(gym);
    await LayoutView.render(html);

    document.querySelector('.facility-upgrade')?.addEventListener('click', async () => {
      const result = await this.game.upgradeFacility();
      if (result.ok) {
        this.notificationService.add('success', 'Upgrade Concluído', `Sua academia agora é um(a) ${result.facility.name}!`);
      } else {
        this.notificationService.add('warning', 'Upgrade Falhou', result.reason);
      }
      this.renderAcademy();
    });

    document.querySelectorAll('.coach-hire').forEach(btn => {
      btn.addEventListener('click', async () => {
        const result = await this.game.hireCoach(btn.dataset.category);
        if (result.ok) {
          this.notificationService.add('success', 'Treinador Contratado', 'A comissão técnica está mais forte.');
        } else {
          this.notificationService.add('warning', 'Contratação Falhou', result.reason);
        }
        this.renderAcademy();
      });
    });

    document.querySelectorAll('.coach-fire').forEach(btn => {
      btn.addEventListener('click', async () => {
        await this.game.fireCoach(btn.dataset.category);
        this.notificationService.add('info', 'Treinador Dispensado', 'Vaga de comissão técnica liberada.');
        this.renderAcademy();
      });
    });

    document.querySelector('.scout-hire')?.addEventListener('click', async () => {
      const result = await this.game.purchaseScout();
      if (result.ok) {
        this.notificationService.add('success', 'Olheiro Contratado', 'O potencial oculto dos agentes livres agora aparece no Recrutamento.');
      } else {
        this.notificationService.add('warning', 'Contratação Falhou', result.reason);
      }
      this.renderAcademy();
    });
  }

  _bindFighterClicks(selector = '[data-fighter-click]', dataAttr = 'fighterClick') {
    document.querySelectorAll(selector).forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        const id = dataAttr === 'id' ? el.dataset.id : el.dataset.fighterClick;
        this.showFighterProfile(id);
      });
    });
  }

  _bindEventClicks() {
    document.querySelectorAll('[data-event-click]').forEach(el => {
      el.addEventListener('click', () => {
        this.showEventDetails(el.dataset.eventClick);
      });
    });
  }

  // ===== Rivalidades =====
  async renderRivalries() {
    const rivalries = await this.rivalryService.getAllActive();
    const fighters = await this.game.fighterCtrl.getAllFighters();
    const html = RivalriesView.render(rivalries, fighters);
    await LayoutView.render(html);
  }

  // ===== Hall of Fame =====
  async renderHallOfFame() {
    const entries = await this.game.db.getAll('hallOfFame');
    const html = HallOfFameView.render(entries);
    await LayoutView.render(html);
  }

  async renderNotifications() {
    const notifications = await this.notificationService.getAll();
    const unreadCount = notifications.filter(n => !n.read).length;
    const html = NotificationsView.render(notifications, unreadCount);
    await LayoutView.render(html);
  }

  async handleSaveLoad() {
    const saveInfo = await this.saveService.getSaveInfo();
    const hasSave = localStorage.getItem('mmaManagerSave') !== null;
    const html = NotificationsView.renderSaveLoad(saveInfo, hasSave);
    await LayoutView.render(html);

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

  async renderPressConference() {
    const team = await this.game.getTeam();
    const upcoming = await this.game.offerService.getAccepted();
    const event = { name: upcoming[0] ? `Luta vs ${upcoming[0].opponentName}` : 'Próxima Luta' };
    const fighterA = team[0] || { name: 'N/A', record: { wins: 0, losses: 0, draws: 0 } };
    const fighterB = { name: upcoming[0]?.opponentName || 'Adversário', record: upcoming[0]?.opponentRecord || { wins: 0, losses: 0, draws: 0 } };
    const scenarios = PressConference.getScenarios();
    const html = PressConferenceView.render(scenarios, fighterA, fighterB, event);
    await LayoutView.render(html);

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
