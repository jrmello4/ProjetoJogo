import { LayoutView } from './views/layout.js';
import { DashboardView } from './views/dashboard.js';
import { RosterView } from './views/roster.js';
import { MarketView } from './views/market.js';
import { EventsView } from './views/events.js';
import { LiveFightHubView } from './views/live-fight-hub.js';
import { OffersView } from './views/offers.js';
import { AcademyView } from './views/academy.js';
import { FighterProfileView } from './views/fighter-profile.js';
import { TrainingCampView } from './views/training-camp.js';
import { RivalriesView } from './views/rivalries.js';
import { PressConferenceView } from './views/press-conference.js';
import { HallOfFameView } from './views/hall-of-fame.js';
import { RetirementCeremonyView } from './views/retirement-ceremony.js';
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
import { getWeightClassName, formatCurrency, getAdjacentWeightClasses } from './utils/helpers.js';
import { CAMP_CONFIG, HYPE_PURSE_RATIO, absWeek } from './config/game-config.js';

class App {
  constructor() {
    this.game = new GameController();
    this.currentView = 'dashboard';
    this.marketFilter = '';
    this.marketSearch = '';
    this.previousView = 'dashboard';
    this.rivalryService = null;
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
      // Tutorial guiado para novos treinadores
      setTimeout(() => this._showTutorial(), 600);
    });
  }

  // ===== Tutorial guiado para novos jogadores =====
  _showTutorial() {
    if (localStorage.getItem('gymTutorialDone')) return;

    const steps = [
      {
        emoji: '📊',
        title: 'Dashboard',
        text: 'Aqui você vê o resumo da sua academia: próximas lutas, resultados recentes, finanças e notificações. Fique de olho nas ofertas!',
      },
      {
        emoji: '📩',
        title: 'Ofertas de Luta',
        text: 'No menu "Ofertas" você recebe propostas de luta das promoções. Aceite as certas para subir de tier e disputar cinturões.',
      },
      {
        emoji: '🏋️',
        title: 'Acampamento',
        text: 'Antes de cada luta, configure o acampamento no perfil do lutador. Escolha a intensidade e o foco — isso define o desempenho no octógono.',
      },
      {
        emoji: '⏩',
        title: 'Avançar Semana',
        text: 'Use o botão "Avançar Semana" para progredir. Cada semana traz treinos, ofertas, eventos e notícias do mundo do MMA.',
      },
    ];

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'tutorialOverlay';
    overlay.style.cssText = 'z-index:9999;background:rgba(8,8,10,0.85);display:flex;align-items:center;justify-content:center';

    let currentStep = 0;

    function renderStep(i) {
      const step = steps[i];
      const total = steps.length;
      return `
        <div class="modal" style="max-width:480px;text-align:center">
          <div style="font-size:3rem;margin-bottom:0.75rem">${step.emoji}</div>
          <h3 style="margin-bottom:0.5rem">${step.title}</h3>
          <p class="text-sm" style="color:var(--text-secondary);line-height:1.6;margin-bottom:1.5rem">${step.text}</p>
          <div style="display:flex;gap:0.5rem;justify-content:center;margin-bottom:1.25rem">
            ${Array.from({ length: total }, (_, j) =>
              `<span style="width:8px;height:8px;border-radius:50%;background:${j === i ? 'var(--belt)' : 'var(--border)'};display:inline-block"></span>`
            ).join('')}
          </div>
          <div class="modal-actions" style="flex-direction:column;gap:0.5rem">
            ${i < total - 1
              ? `<button class="btn btn-primary w-full tutorial-next" style="width:100%">Próximo — ${steps[i + 1].title}</button>
                 <button class="btn btn-sm btn-secondary tutorial-skip" style="width:100%">Pular tutorial</button>`
              : `<button class="btn btn-primary w-full tutorial-finish" style="width:100%">✅ Entendi! Vou começar</button>`}
          </div>
        </div>
      `;
    }

    overlay.innerHTML = renderStep(0);
    document.body.appendChild(overlay);

    // Avançar passo
    overlay.addEventListener('click', (e) => {
      const nextBtn = e.target.closest('.tutorial-next');
      const skipBtn = e.target.closest('.tutorial-skip');
      const finishBtn = e.target.closest('.tutorial-finish');

      if (nextBtn) {
        currentStep++;
        overlay.innerHTML = renderStep(currentStep);
      } else if (skipBtn || finishBtn) {
        localStorage.setItem('gymTutorialDone', '1');
        overlay.remove();
      }
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
      case 'retirement':
        await this.renderRetirementCeremony();
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
          cardA: info.cardA,
          cardB: info.cardB,
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

    // Se um atleta da academia lutou, mostra o Live Fight Hub
    const featured = world.playerEvents[0];
    if (featured) {
      const playerResult = featured.playerResults?.[0];
      if (playerResult) {
        const fA = await this.game.fighterCtrl.getFighter(playerResult.fighterAId);
        const fB = await this.game.fighterCtrl.getFighter(playerResult.fighterBId);
        if (fA && fB) {
          const html = LiveFightHubView.render(fA, fB, playerResult);
          await LayoutView.render(html);
          this._playLiveHub(featured.results, featured.playerFighterIds);
          // Sem este bind o botão do resumo é um beco sem saída — o jogador
          // termina a luta e fica preso na tela do hub.
          document.getElementById('hubBackBtn')?.addEventListener('click', () => this.renderDashboard());
          document.getElementById('shareFightBtn')?.addEventListener('click', () => {
            const fText = `${playerResult._won ? '🏆' : '😔'} ${fA.name} ${playerResult._won ? 'venceu' : 'perdeu'} por ${playerResult.method} no R${playerResult.round}!`;
            const shareText = `${fText}\n💰 Bolsa: $${(playerResult._purse || 0).toLocaleString()} | Comissão: $${(playerResult._gymCut || 0).toLocaleString()}\n📊 Recorde: ${fA.record.wins}-${fA.record.losses}-${fA.record.draws}\n\nJogue MMA Manager: ${window.location.origin}/landing.html`;
            if (navigator.share) {
              navigator.share({ title: 'MMA Manager', text: shareText });
            } else {
              navigator.clipboard.writeText(shareText).then(() => {
                this.notificationService?.add('success', 'Compartilhar', 'Resultado copiado! Envie para um amigo.');
              });
            }
          });
          return;
        }
      }
      // fallback: broadcast completo
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

  // Fase 2: Live Fight Hub — revelação temporizada round a round
  _playLiveHub(allResults, playerFighterIds) {
    const statusText = document.getElementById('liveStatusText');
    const statusCard = document.getElementById('liveHubStatus');
    const rounds = document.querySelectorAll('.live-round');
    const summary = document.getElementById('liveHubSummary');
    const skipBtn = document.getElementById('skipLiveHubBtn');
    const title = document.getElementById('hubFightTitle');
    const subtitle = document.getElementById('hubFightSubtitle');
    let roundIdx = 0;
    let beatIdx = 0;
    let cancelled = false;
    let tl = gsap.timeline();

    const faceOff = document.getElementById('hubFaceOff');
    let threeFaceOff = null;
    // Tenta montar ThreeFaceOff (falha silenciosa se Three.js nao carregou)
    try {
      import('./three-faceoff.js').then(mod => {
        if (!cancelled && faceOff) {
          threeFaceOff = new mod.ThreeFaceOff('hubFaceOff', null, null);
        }
      }).catch(() => {});
    } catch {}

    const finish = () => {
      cancelled = true;
      tl.kill();
      tl = gsap.timeline(); // fresh timeline for summary

      rounds.forEach(r => r.style.display = 'block');
      rounds.forEach(r => {
        r.querySelectorAll('.live-beat').forEach(b => b.style.display = 'flex');
      });

      if (statusText) statusText.textContent = 'Luta encerrada';
      if (skipBtn) skipBtn.style.display = 'none';

      // Summary dramatic reveal
      if (summary) {
        summary.style.display = 'block';
        tl.to('#hubResultIcon', { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 0)
          .to('#hubResultText', { opacity: 1, y: 0, duration: 0.3 }, '-=0.2')
          .to('#hubResultMethod', { opacity: 1, duration: 0.3 }, '-=0.15')
          .to('#hubScorecards', { opacity: 1, duration: 0.3 }, '-=0.1')
          .to('#hubPurseDisplay', { opacity: 1, y: 0, duration: 0.3 }, '-=0.05')
          .to('#hubDamageWarning', { opacity: 1, duration: 0.3 }, '-=0.05')
          .to('#hubActions', { opacity: 1, y: 0, duration: 0.3 }, '-=0.05');
      }
    };

    // Nota: o ritmo round-a-round usa gsap.delayedCall (não tl.call) de
    // propósito. GSAP3 não tem o argumento "scope" que GSAP2 tinha —
    // tl.call(fn, null, null, delay) é a assinatura antiga, o 4º argumento
    // é ignorado silenciosamente, e reagendar novos tl.call() de DENTRO de
    // um callback que já está rodando na mesma timeline nunca dispara de
    // novo (testado: a timeline trava depois da 1ª chamada, mesmo esperando
    // 10s). gsap.delayedCall é um agendamento independente e não sofre disso.
    const showBeat = () => {
      if (cancelled) return;
      const round = rounds[roundIdx];
      if (!round) { finish(); return; }
      const beats = round.querySelectorAll('.live-beat');

      if (!beats.length || beatIdx >= beats.length) {
        // Pausa entre rounds
        gsap.delayedCall(1, () => {
          if (cancelled) return;
          roundIdx++;
          beatIdx = 0;
          if (roundIdx >= rounds.length) { finish(); return; }
          rounds[roundIdx].style.display = 'block';
          if (statusText) statusText.textContent = `Round ${roundIdx + 1} de ${rounds.length}`;
          gsap.delayedCall(0.6, showBeat);
        });
        return;
      }

      const beat = beats[beatIdx];
      const beatType = beat.dataset.beatType;

      // Revelar beat
      beat.style.display = 'flex';

      // Screen shake em knockdown e finish
      if (beatType === 'knockdown') {
        gsap.to(faceOff || document.getElementById('liveHubRounds'), {
          x: '+=6', duration: 0.04, repeat: 4, yoyo: true, ease: 'power1.inOut',
        });
        if (threeFaceOff?.onKnockdown) threeFaceOff.onKnockdown();
      } else if (beatType === 'finish') {
        gsap.to(faceOff || document.getElementById('liveHubRounds'), {
          x: '+=10', duration: 0.05, repeat: 6, yoyo: true, ease: 'power1.inOut',
        });
        // Flash momentâneo
        const flash = document.createElement('div');
        flash.style.cssText = 'position:fixed;inset:0;background:rgba(232,35,74,0.3);pointer-events:none;z-index:999';
        document.body.appendChild(flash);
        gsap.to(flash, { opacity: 0, duration: 0.6, onComplete: () => flash.remove() });
        if (threeFaceOff?.onFinish) threeFaceOff.onFinish();
      }

      beatIdx++;
      gsap.delayedCall(0.45, showBeat);
    };

    if (rounds.length === 0 || cancelled) { finish(); return; }

    // Intro animation
    tl.to(statusCard, { opacity: 1, duration: 0.3 }, 0)
      .to(title, { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.2)' }, '-=0.1')
      .to(subtitle, { opacity: 1, duration: 0.3 }, '-=0.15');

    // Show first round
    gsap.delayedCall(0.8, () => {
      if (!cancelled) {
        rounds[0].style.display = 'block';
        if (statusText) statusText.textContent = `Round 1 de ${rounds.length}`;
      }
    });

    skipBtn?.addEventListener('click', finish);

    gsap.delayedCall(1.2, showBeat);
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

    // Épico E1: mudança de divisão de peso
    document.querySelectorAll('.change-weight-class').forEach(btn => {
      btn.addEventListener('click', async () => {
        const dir = btn.dataset.dir;
        const fId = btn.dataset.fighter;
        const f = await this.game.fighterCtrl.getFighter(fId);
        if (!f) return;

        const adj = getAdjacentWeightClasses(f.weightClass);
        const newWeightClass = dir === 'up' ? adj.up : adj.down;
        if (!newWeightClass) return;

        const gym = await this.game.getGym();
        const cost = 5000;
        if (gym.cash < cost) {
          this.notificationService.add('warning', 'Divisão', `Saldo insuficiente. Mudança custa ${formatCurrency(cost)}.`);
          return;
        }

        // Efeitos da mudança na divisão
        const oldClass = f.weightClass;
        f.weightClass = newWeightClass;

        // Ajustes de atributos por mudança de divisão
        if (dir === 'up') {
          // Subir = enfrentar oponentes menores: perde power/strength, ganha speed/cardio
          f.attributes.power = Math.max(1, (f.attributes.power || 50) - 3);
          f.attributes.strength = Math.max(1, (f.attributes.strength || 50) - 2);
          f.attributes.speed = Math.min(99, (f.attributes.speed || 50) + 2);
          f.attributes.cardio = Math.min(99, (f.attributes.cardio || 50) + 1);
        } else {
          // Descer = enfrentar oponentes maiores: ganha power/strength, perde speed/cardio
          f.attributes.power = Math.min(99, (f.attributes.power || 50) + 2);
          f.attributes.strength = Math.min(99, (f.attributes.strength || 50) + 3);
          f.attributes.speed = Math.max(1, (f.attributes.speed || 50) - 2);
          f.attributes.cardio = Math.max(1, (f.attributes.cardio || 50) - 2);
        }

        const state = await this.seasonService.getState();
        const week = absWeek(state);
        gym.addTransaction(week, `Mudança divisão: ${f.name} (${oldClass} → ${newWeightClass})`, -cost);
        await this.game.fighterCtrl.updateFighter(f);
        await this.game.updateGym(gym);

        this.notificationService.add('success', 'Divisão Alterada', `${f.name} mudou de ${oldClass} para ${newWeightClass}.`);
        this.showFighterProfile(fighterId);
      });
    });

    // Renomear lutador
    document.querySelectorAll('.fighter-rename').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fId = btn.dataset.id;
        const f = await this.game.fighterCtrl.getFighter(fId);
        if (!f) return;

        const newName = prompt('Novo nome do lutador:', f.name);
        if (!newName || newName.trim().length === 0) return;
        if (newName.length > 30) {
          this.notificationService.add('warning', 'Renomear', 'O nome deve ter no máximo 30 caracteres.');
          return;
        }

        f.name = newName.trim();
        await this.game.fighterCtrl.updateFighter(f);
        this.notificationService.add('success', 'Renomear', `Lutador renomeado para ${newName.trim()}.`);
        this.showFighterProfile(fighterId);
      });
    });
  }

  // ===== Training Camp (Épico D) =====
  async renderTrainingCamp() {
    const team = await this.game.getTeam();
    const bookings = await this.game.offerService.getAccepted();
    const state = await this.seasonService.getState();
    const now = (state.year - 1) * 52 + state.week;
    const gym = await this.game.getGym();
    const html = TrainingCampView.render(team, bookings, now, gym);
    await LayoutView.render(html);
    this._bindTrainingCamp(team, bookings, now, gym);
  }

  _bindTrainingCamp(team, bookings, now, gym) {
    // Salvar configuração de camp
    document.querySelectorAll('.camp-save').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fighterId = btn.dataset.fighter;
        const fighter = await this.game.fighterCtrl.getFighter(fighterId);
        if (!fighter) return;

        const intensity = document.querySelector(`.camp-intensity[data-fighter="${fighterId}"]`)?.value;
        const spec = document.querySelector(`.camp-spec[data-fighter="${fighterId}"]`)?.value;
        const sparringPartnerId = document.querySelector(`.camp-sparring[data-fighter="${fighterId}"]`)?.value || null;

        if (!intensity) {
          this.notificationService.add('warning', 'Camp', 'Selecione uma intensidade para o camp.');
          return;
        }

        const booking = bookings.find(b => b.fighterId === fighterId);
        if (intensity === 'intense' && !booking) {
          this.notificationService.add('warning', 'Camp', 'Treino intenso só é permitido com luta marcada.');
          return;
        }

        TrainingCamp.configureCamp(fighter, intensity, spec || 'striking', sparringPartnerId);
        await this.game.fighterCtrl.updateFighter(fighter);

        const cost = CAMP_CONFIG.WEEKLY_COST[intensity] || 0;
        this.notificationService.add('success', 'Camp Configurado', `${fighter.name} iniciou camp ${intensity} ($${cost.toLocaleString()}/sem).`);
        this.renderTrainingCamp();
      });
    });

    // Cancelar camp
    document.querySelectorAll('.camp-cancel').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fighterId = btn.dataset.fighter;
        const fighter = await this.game.fighterCtrl.getFighter(fighterId);
        if (!fighter) return;

        TrainingCamp.cancelCamp(fighter);
        await this.game.fighterCtrl.updateFighter(fighter);

        this.notificationService.add('info', 'Camp Cancelado', `Camp de ${fighter.name} foi cancelado.`);
        this.renderTrainingCamp();
      });
    });
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
    const html = FinanceView.render(gym, team);
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

    document.querySelector('.hall-of-fame-share')?.addEventListener('click', () => {
      const text = `Acabei de imortalizar ${entries.length} lendas no MMA Manager!\n\nConstrua dinastias. Destrua legados.\n👉 ${window.location.origin}/landing.html`;
      if (navigator.share) {
        navigator.share({ title: 'MMA Manager', text, url: `${window.location.origin}/landing.html` });
      } else {
        navigator.clipboard.writeText(text).then(() => {
          this.notificationService?.add('success', 'Compartilhar', 'Link copiado! Envie para um amigo fã de MMA.');
        });
      }
    });
  }

  // ===== G5: Cerimônia de Aposentadoria =====
  async renderRetirementCeremony() {
    const gameState = await this.game.db.get('gameState', 'state');
    const fighterId = gameState?.meta?.lastRetirementFighterId;
    if (!fighterId) {
      await this.renderHallOfFame();
      return;
    }

    const entry = await this.game.db.get('hallOfFame', fighterId);
    if (!entry) {
      await this.renderHallOfFame();
      return;
    }

    const html = RetirementCeremonyView.render(entry);
    await LayoutView.render(html);

    document.getElementById('viewFullCareerBtn')?.addEventListener('click', () => {
      // Mostra o card do atleta no Hall da Fama — navega para lá
      this.navigateTo('hall-of-fame');
    });

    document.getElementById('backToHallBtn')?.addEventListener('click', () => {
      this.navigateTo('hall-of-fame');
    });
  }

  async renderNotifications(category = 'all') {
    const notifications = await this.notificationService.getAll();
    const unreadCount = notifications.filter(n => !n.read).length;
    const html = NotificationsView.render(notifications, unreadCount, category);
    await LayoutView.render(html);

    // Abas de categoria
    document.querySelectorAll('.notif-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => this.renderNotifications(btn.dataset.cat));
    });

    // G5: navega para cerimônia ao clicar em notificação de hall-of-fame
    document.querySelectorAll('.nav-link[data-view="retirement"]').forEach(link => {
      link.addEventListener('click', (e) => {
        if (e.target.closest('.notif-mark-read, .notif-mark-all')) return;
        this.navigateTo('retirement');
      });
    });
  }

  async handleSaveLoad() {
    const saveInfo = await this.saveService.getSaveInfo();
    const slots = await this.saveService.listSlots();
    const currentSlot = this.saveService.currentSlot;
    const html = NotificationsView.renderSaveLoad(saveInfo, slots, currentSlot);
    await LayoutView.render(html);

    document.querySelectorAll('.slot-save-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const slot = parseInt(btn.dataset.slot, 10);
        await this.saveService.saveSave(slot);
        this.notificationService.add('success', 'Save', `Jogo salvo no slot ${slot}!`);
        this.handleSaveLoad();
      });
    });

    document.querySelectorAll('.slot-load-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const slot = parseInt(btn.dataset.slot, 10);
        await this.saveService.loadSave(slot);
        this.notificationService.add('success', 'Load', `Jogo carregado do slot ${slot}!`);
        window.location.reload();
      });
    });

    document.querySelectorAll('.slot-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const slot = parseInt(btn.dataset.slot, 10);
        await this.saveService.deleteSave(slot);
        this.notificationService.add('info', 'Delete', `Save do slot ${slot} deletado.`);
        this.handleSaveLoad();
      });
    });
  }

  async renderPressConference() {
    const team = await this.game.getTeam();
    const upcoming = await this.game.offerService.getAccepted();

    // F1: buscar a luta real do primeiro atleta com booking
    const booking = upcoming.length > 0 ? upcoming[0] : null;
    let fighterA = null;
    let fighterB = null;
    let event = null;

    if (booking) {
      fighterA = team.find(f => f.id === booking.fighterId) || team[0];
      const oppData = await this.game.fighterCtrl.getFighter(booking.opponentId);
      if (oppData) {
        fighterB = oppData;
      } else {
        fighterB = { name: booking.opponentName, record: booking.opponentRecord || { wins: 0, losses: 0, draws: 0 } };
      }
      const promotions = await this.game.worldService.getPromotions();
      const promo = promotions.find(p => p.id === booking.promotionId);
      event = {
        name: `${promo?.name || booking.promotionName || 'Evento'} — Luta principal`,
        promotion: promo?.name || booking.promotionName || '',
      };
    } else {
      // Fallback: sem luta marcada
      event = { name: 'Nenhuma luta marcada', promotion: '' };
      fighterA = { name: '—', record: { wins: 0, losses: 0, draws: 0 } };
      fighterB = { name: '—', record: { wins: 0, losses: 0, draws: 0 } };
    }

    const scenarios = PressConference.getScenarios();
    const html = PressConferenceView.render(scenarios, fighterA, fighterB, event, !!booking);
    await LayoutView.render(html);

    if (!booking) return; // sem luta marcada: nada para responder, nada a ligar

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
          // Épico F1: hype acumulado de TODAS as perguntas
          const totalHype = fighterA.pcHype || 0;
          const hypeBonus = totalHype * HYPE_PURSE_RATIO;
          await this.game.fighterCtrl.updateFighter(fighterA);

          // Épico F1: hype alto gera rivalidade/heat entre os lutadores
          if (totalHype >= PressConference.RIVALRY_HYPE_THRESHOLD && booking && fighterB?.id) {
            const rivalry = await this.rivalryService.addPressConferenceHeat(
              fighterA.id, fighterB.id, totalHype, booking.promotionId
            );
            if (rivalry) {
              this.notificationService.add('info', 'Rivalidade',
                `A provocação na coletiva acirrou a rivalidade entre ${fighterA.name} e ${fighterB.name}! (Intensidade: ${rivalry.intensityLabel})`);
            }
          }

          const summary = PressConferenceView.renderSummary(null, totalHype, hypeBonus);
          document.getElementById('pressConferenceSummary').innerHTML = summary;
          document.getElementById('pressConferenceSummary').style.display = 'block';
          const simulateBtn = document.getElementById('pcSimulateBtn');
          simulateBtn.style.display = 'block';
          simulateBtn.addEventListener('click', () => this.navigateTo('dashboard'));

          if (totalHype > 0) {
            this.notificationService.add('success', 'Hype!',
              `${fighterA.name} gerou hype +${totalHype} na coletiva. Bônus de ${formatCurrency(hypeBonus)} na bolsa da luta!`);
          } else {
            this.notificationService.add('info', 'Imprensa',
              `Conferência de imprensa de ${fighterA.name} concluída.`);
          }
        }
      });
    });
  }
}

const app = new App();
app.init();

window.app = app;
