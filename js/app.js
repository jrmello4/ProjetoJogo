import { LayoutView } from './views/layout.js';
import { DashboardView } from './views/dashboard.js';
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
import { renderCalendar } from './views/calendar.js';
import { RankingsView } from './views/rankings.js';
import { FinanceView } from './views/finance.js';
import { RankingService } from './services/ranking.js';
import { TapeService } from './services/tape-service.js';
import { NotificationsView } from './views/notifications.js';
import { GameController } from './controllers/game-controller.js';
import { TrainingCamp } from './controllers/training-camp.js';
import { PressConference } from './controllers/press-conference.js';
import { CornerAdvice } from './controllers/corner-advice.js';
import { RivalryService } from './services/rivalry-service.js';
import { SeasonService } from './services/season-service.js';
import { NotificationService } from './services/notification-service.js';
import { SaveService } from './services/save-service.js';
import { ThreeArena } from './three-arena.js';
import { ThreeBackground } from './three-background.js';
import { motion } from './motion/motion-engine.js';
import { DIFFICULTIES, MILESTONE_LABELS, SIMULATE_PERIOD_PRESETS, TRAINING_FOCUS_META, ARCHETYPES, ORIGINS, absWeekToLabel, SYNERGY_CONFIG, FIGHTING_STYLES, PERKS } from './config/game-config.js';
import { getWeightClassName, formatCurrency, getAdjacentWeightClasses, clamp } from './utils/helpers.js';
import { CAMP_CONFIG, HYPE_PURSE_RATIO, absWeek } from './config/game-config.js';

// Depois de publicar no itch.io, cole a URL da página do jogo aqui pra ela
// aparecer nos textos de compartilhamento (resultado de luta, Hall da Fama).
// Vazio = compartilha só o texto, sem link.
const SHARE_URL = '';

// §C.1 — rótulos de Manager.style, usados na criação de personagem e na
// tela de academia/empresário.
const MANAGER_STYLE_LABELS = {
  aggressive: 'Agressivo',
  conservative: 'Conservador',
  loyal: 'Leal',
};

class App {
  constructor() {
    this.game = new GameController();
    this.currentView = 'dashboard';
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
    let playerFighter;
    try {
      playerFighter = await this.game.init();
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
    this.rivalryService = new RivalryService(this.game.db, this.game.careerLogService);

    this.threeBackground = new ThreeBackground('mainContent');

    window.addEventListener('navigate', (e) => {
      this.navigateTo(e.detail.view);
    });

    document.addEventListener('click', (e) => {
      const navEl = e.target.closest('[data-nav]');
      if (navEl) {
        this.navigateTo(navEl.dataset.nav);
      }
    });

    if (!playerFighter) {
      this._showCharacterCreation();
      return;
    }

    this.navigateTo('dashboard');
  }

  // ===== Criação de personagem (§A.7) =====
  async _showCharacterCreation() {
    const academies = await this.game.getAcademies();
    const managers = await this.game.getManagers();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'characterCreationModal';
    modal.innerHTML = `
      <div class="modal" style="max-width:640px">
        <div class="modal-header">
          <h3>Crie seu Lutador</h3>
        </div>
        <p class="text-sm" style="color:var(--text-secondary)">
          Você não gerencia uma academia — você É o lutador. Do primeiro contrato à aposentadoria,
          toda decisão de carreira é sua.
        </p>

        <div class="form-group">
          <label class="form-label">Nome</label>
          <input type="text" class="form-input" id="charName" maxlength="30" placeholder="Seu nome de lutador">
        </div>

        <div class="form-group">
          <label class="form-label">Categoria de Peso</label>
          <select class="form-select" id="charWeightClass">
            <option value="Flyweight">Peso Mosca</option>
            <option value="Bantamweight">Peso Galo</option>
            <option value="Featherweight">Peso Pena</option>
            <option value="Lightweight" selected>Peso Leve</option>
            <option value="Welterweight">Peso Meio-Médio</option>
            <option value="Middleweight">Peso Médio</option>
            <option value="Light Heavyweight">Meio-Pesado</option>
            <option value="Heavyweight">Peso Pesado</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Arquétipo Inicial</label>
          <div class="difficulty-grid">
            ${Object.entries(ARCHETYPES).map(([key, a]) => `
              <div class="difficulty-option ${key === 'generalist' ? 'selected' : ''}" data-archetype="${key}">
                <div class="difficulty-name">${a.label}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Origem Esportiva</label>
          <div class="difficulty-grid" style="grid-template-columns:repeat(3,1fr)">
            ${Object.entries(ORIGINS).map(([key, o], i) => `
              <div class="difficulty-option ${i === 0 ? 'selected' : ''}" data-origin="${key}">
                <div class="difficulty-name">${o.label}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Reserva Financeira</label>
          <div class="difficulty-grid">
            ${DIFFICULTIES.map(d => `
              <div class="difficulty-option ${d.id === 'normal' ? 'selected' : ''}" data-difficulty="${d.id}">
                <div class="difficulty-name">${d.name}</div>
                <div class="difficulty-cash">${formatCurrency(d.cash)}</div>
                <div class="text-xs text-muted mt-2">${d.desc}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Primeira Academia</label>
          <div class="difficulty-grid">
            ${academies.map((a, i) => `
              <div class="difficulty-option ${i === 0 ? 'selected' : ''}" data-academy="${a.id}">
                <div class="difficulty-name">${a.name}</div>
                <div class="text-xs text-muted mt-2">${a.philosophy} · ${formatCurrency(a.weeklyFee)}/sem</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Primeiro Empresário</label>
          <div class="difficulty-grid">
            ${managers.map((m, i) => `
              <div class="difficulty-option ${i === 0 ? 'selected' : ''}" data-manager="${m.id}">
                <div class="difficulty-name">${m.name}</div>
                <div class="text-xs text-muted mt-2">${MANAGER_STYLE_LABELS[m.style] || m.style} · corte ${Math.round(m.cut * 100)}%</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-primary w-full" id="characterCreationStartBtn">Começar carreira</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll('[data-archetype]').forEach(opt => {
      opt.addEventListener('click', () => {
        modal.querySelectorAll('[data-archetype]').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });
    modal.querySelectorAll('[data-origin]').forEach(opt => {
      opt.addEventListener('click', () => {
        modal.querySelectorAll('[data-origin]').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });
    modal.querySelectorAll('[data-difficulty]').forEach(opt => {
      opt.addEventListener('click', () => {
        modal.querySelectorAll('[data-difficulty]').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });
    modal.querySelectorAll('[data-academy]').forEach(opt => {
      opt.addEventListener('click', () => {
        modal.querySelectorAll('[data-academy]').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });
    modal.querySelectorAll('[data-manager]').forEach(opt => {
      opt.addEventListener('click', () => {
        modal.querySelectorAll('[data-manager]').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });

    modal.querySelector('#characterCreationStartBtn').addEventListener('click', async () => {
      const name = modal.querySelector('#charName').value.trim() || 'Lutador Anônimo';
      const weightClass = modal.querySelector('#charWeightClass').value;
      const archetype = modal.querySelector('[data-archetype].selected')?.dataset.archetype || 'generalist';
      const origin = modal.querySelector('[data-origin].selected')?.dataset.origin || null;
      const difficultyId = modal.querySelector('[data-difficulty].selected')?.dataset.difficulty || 'normal';
      const academyId = modal.querySelector('[data-academy].selected')?.dataset.academy || academies[0]?.id;
      const managerId = modal.querySelector('[data-manager].selected')?.dataset.manager || managers[0]?.id;

      await this.game.createPlayerFighter({ name, weightClass, archetype, origin, difficultyId, academyId, managerId });

      localStorage.setItem('characterCreationDone', '1');
      modal.remove();
      this.notificationService.add('success', 'Carreira Iniciada', `${name} deu o primeiro passo rumo à elite mundial.`);
      this.navigateTo('dashboard');
      setTimeout(() => this._showTutorial(), 600);
    });
  }

  // ===== Tutorial guiado para novos jogadores =====
  _showTutorial() {
    if (localStorage.getItem('tutorialDone')) return;

    const steps = [
      {
        emoji: '📊',
        title: 'Dashboard',
        text: 'Aqui você vê o resumo da sua carreira: próxima luta, finanças e notificações. Fique de olho nas ofertas!',
      },
      {
        emoji: '📩',
        title: 'Ofertas de Luta',
        text: 'No menu "Ofertas" você recebe propostas das promoções. Aceite as certas para subir de tier e disputar cinturões.',
      },
      {
        emoji: '🏋️',
        title: 'Acampamento',
        text: 'Antes de cada luta, configure o acampamento. Escolha a intensidade e o foco — isso define seu desempenho no octógono.',
      },
      {
        emoji: '⏩',
        title: 'Avançar Semana',
        text: 'Use o botão "Avançar Semana" para progredir. Cada semana traz treino, ofertas, eventos e notícias do mundo do MMA.',
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

    overlay.addEventListener('click', (e) => {
      const nextBtn = e.target.closest('.tutorial-next');
      const skipBtn = e.target.closest('.tutorial-skip');
      const finishBtn = e.target.closest('.tutorial-finish');

      if (nextBtn) {
        currentStep++;
        overlay.innerHTML = renderStep(currentStep);
      } else if (skipBtn || finishBtn) {
        localStorage.setItem('tutorialDone', '1');
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
      case 'calendar':
        await this.renderCalendarView();
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

    document.querySelectorAll('[data-social-choice]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const result = await this.game.resolveSocialPrompt(btn.dataset.socialChoice);
        if (!result.ok) {
          this.notificationService.add('warning', 'Redes Sociais', result.reason);
        }
        this.renderDashboard();
      });
    });

    document.querySelectorAll('[data-weigh-in-choice]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const result = await this.game.resolveWeighIn(btn.dataset.weighInChoice);
        if (!result.ok) {
          this.notificationService.add('warning', 'Pesagem', result.reason);
        }
        this.renderDashboard();
      });
    });

    // Rivalidade — escolha do prompt semanal
    document.querySelectorAll('.rivalry-choice').forEach(btn => {
      btn.addEventListener('click', async () => {
        const result = await this.game.resolveRivalryInteraction(btn.dataset.choice);
        this.renderDashboard();
      });
    });

    document.querySelectorAll('[data-approach-respond]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const result = await this.game.respondToApproach(btn.dataset.approachId, btn.dataset.approachRespond);
        if (result.success) {
          this.notificationService.add('success', 'Sondagem Respondida', result.message);
        } else if (result.outcome !== 'no_fighter') {
          this.notificationService.add('warning', 'Sondagem', result.message || 'Não foi possível responder agora.');
        }
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

    // §C.2 — sinergia técnico-atleta. Snapshot da Academia/coachSynergy ANTES
    // da luta: as sugestões de córner ao vivo usam esse valor o tempo todo
    // (a sinergia só muda DEPOIS da luta resolvida, ver _applyCoachSynergyChange).
    let coachPersonality = 'analytical';
    let coachSynergyAtFightStart = 40;
    try {
      const preFighter = await this.game.getPlayerFighter();
      const preAcademy = preFighter ? await this.game.getAcademy(preFighter.academyId) : null;
      coachPersonality = preAcademy?.headCoach?.personality || 'analytical';
      coachSynergyAtFightStart = preFighter?.coachSynergy ?? 40;
    } catch { /* sem academia/lutador ainda (onboarding) — segue com o default */ }

    // Tally da luta inteira: cada decisão de córner (rodada em que passou a
    // valer, sugestão do técnico, escolha do jogador) some para cornerTally
    // assim que o round QUE ELA GOVERNOU termina — só então dá pra saber se
    // foi vencido ou perdido. `pendingDecision` guarda a escolha ainda não
    // resolvida (a mais recente, cujo round ainda está em andamento).
    const cornerTally = [];
    let pendingDecision = null;
    const resolvePendingDecision = (roundEntry) => {
      if (!pendingDecision || !roundEntry) return;
      cornerTally.push({
        ...pendingDecision,
        won: roundEntry.scoreA > roundEntry.scoreB,
        lost: roundEntry.scoreA < roundEntry.scoreB,
      });
      pendingDecision = null;
    };

    const cornerHooks = {
      onFightStart: async ({ fighter, opponent, promo }) => {
        const html = EventsView.renderCornerFightIntro(fighter, opponent, promo.name);
        await LayoutView.render(html);
        await new Promise(r => setTimeout(r, 1000));
      },
      onRoundEnd: (info) => new Promise((resolve) => {
        // O round que acabou de terminar é o que a ÚLTIMA escolha de córner
        // governou — resolve o tally antes de pedir a PRÓXIMA escolha.
        resolvePendingDecision(info.roundResult);

        // §C.2 — sugestão do técnico da Academia atual, já passada pelo
        // embaralho de sinergia (CornerAdvice.applySynergyNoise).
        const suggestion = CornerAdvice.getSuggestion(coachPersonality, coachSynergyAtFightStart, info);

        const html = EventsView.renderCornerRound({
          fighterName: info.fighter.name,
          opponentName: info.opponent.name,
          round: info.round,
          roundResult: info.roundResult,
          totalScoreA: info.totalScoreA,
          totalScoreB: info.totalScoreB,
          cardA: info.cardA,
          cardB: info.cardB,
          suggested: suggestion.key,
        });
        LayoutView.render(html).then(() => {
          document.querySelectorAll('.corner-choice').forEach(b => {
            b.addEventListener('click', () => {
              const chosenKey = b.dataset.instruction;
              // 'instinct' bypassa o córner (não é conselho de ninguém) —
              // nunca conta como "seguiu a sugestão", mesmo que coincida.
              pendingDecision = {
                round: info.round + 1,
                suggestedKey: suggestion.key,
                chosenKey,
                followed: chosenKey !== 'instinct' && chosenKey === suggestion.key,
              };
              resolve(chosenKey);
            });
          });
        });
      }),
    };

    const summary = await this.game.processWeek(cornerHooks);
    const { world, offersCreated, economy, milestonesUnlocked, now } = summary;

    // §D.3 — checkPostFight (criação/derivação de tipo de rivalidade) agora
    // roda dentro de GameController.processWeek() (ver game-controller.js),
    // pra também disparar durante o fast-forward (simulateWeeks). Chamar de
    // novo aqui duplicaria o efeito (intensity +2, dois eventos de histórico
    // por rematch) toda vez que o jogador avança semana a semana.

    for (const id of milestonesUnlocked) {
      await this.notificationService.add('achievement', 'Conquista Desbloqueada!', MILESTONE_LABELS[id] || id);
    }

    await this.notificationService.add(
      'week-advance',
      'Semana Iniciada',
      `${absWeekToLabel(now)}. Fluxo pessoal: ${economy.net >= 0 ? '+' : ''}$${economy.net.toLocaleString()}${offersCreated.length > 0 ? ` · ${offersCreated.length} nova${offersCreated.length === 1 ? '' : 's'} oferta${offersCreated.length === 1 ? '' : 's'} de luta` : ''}.`
    );

    // §C.2 — a escolha de córner do ÚLTIMO round instruído nunca passa por
    // resolvePendingDecision dentro do hook (não há onRoundEnd depois do
    // round final da luta) — resolve aqui contra o resultado real, e só
    // então ajusta coachSynergy. Fetch-mutate-save próprio e isolado, ANTES
    // de qualquer outro código abaixo buscar `fA` fresco — nada depois deste
    // ponto salva o mesmo Fighter, então não há risco de sobrescrever.
    const playerFightResult = world.playerEvents[0]?.playerResults?.[0] || null;
    if (pendingDecision && playerFightResult) {
      const roundEntry = playerFightResult.rounds?.find(rd => rd.round === pendingDecision.round)
        || playerFightResult.rounds?.[playerFightResult.rounds.length - 1];
      resolvePendingDecision(roundEntry);
    }
    if (playerFightResult && cornerTally.length > 0) {
      await this._applyCoachSynergyChange(playerFightResult.fighterAId, cornerTally);
    }

    const featured = world.playerEvents[0];
    if (featured) {
      const playerResult = featured.playerResults?.[0];
      if (playerResult) {
        const fA = await this.game.fighterCtrl.getFighter(playerResult.fighterAId);
        const fB = await this.game.fighterCtrl.getFighter(playerResult.fighterBId);
        if (fA && fB) {
          const html = LiveFightHubView.render(fA, fB, playerResult);
          await LayoutView.render(html);
          this._playLiveHub(featured.results, featured.playerFighterIds, fA, fB);
          document.getElementById('hubBackBtn')?.addEventListener('click', () => this.renderDashboard());
          document.getElementById('shareFightBtn')?.addEventListener('click', () => {
            const fText = `${playerResult._won ? '🏆' : '😔'} ${fA.name} ${playerResult._won ? 'venceu' : 'perdeu'} por ${playerResult.method} no R${playerResult.round}!`;
            const shareText = `${fText}\n💰 Bolsa: $${(playerResult._purse || 0).toLocaleString()} | Líquido: $${(playerResult._netPurse || 0).toLocaleString()}\n📊 Recorde: ${fA.record.wins}-${fA.record.losses}-${fA.record.draws}${SHARE_URL ? `\n\nJogue MMA Manager: ${SHARE_URL}` : ''}`;
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

  // §C.2 — ajusta coachSynergy a partir do tally da luta ao vivo que acabou
  // de acontecer: cada round em que a instrução foi SEGUIDA e o round foi
  // VENCIDO soma; cada round em que foi IGNORADA e o round foi PERDIDO
  // subtrai — ambos escalados por GROWTH_RATE_BY_FACILITY (academia pequena
  // = atenção individual = sinergia cresce/cai mais rápido). Só chamado pelo
  // caminho AO VIVO (advanceWeek) — simulateWeeks() não tem cornerHooks, logo
  // nunca preenche cornerTally, e este método nunca é chamado por lá
  // (simplificação aceita pelo spec §C.2/pedido explícito da tarefa).
  //
  // Fetch-mutate-save PRÓPRIO e isolado: busca o Fighter fresco (pós-luta,
  // já com todas as mutações que WorldService/GameController salvaram
  // durante processWeek) em vez de reusar alguma variável local mais antiga
  // — ver a nota de app.js/game-controller.js sobre esse bug já ter
  // acontecido de verdade neste projeto.
  async _applyCoachSynergyChange(fighterId, cornerTally) {
    let followedAndWon = 0;
    let ignoredAndLost = 0;
    for (const t of cornerTally) {
      if (t.followed && t.won) followedAndWon++;
      else if (!t.followed && t.lost) ignoredAndLost++;
    }
    if (followedAndWon === 0 && ignoredAndLost === 0) return;

    const fighter = await this.game.fighterCtrl.getFighter(fighterId);
    if (!fighter) return;
    const academy = await this.game.getAcademy(fighter.academyId);
    const growthRate = SYNERGY_CONFIG.GROWTH_RATE_BY_FACILITY[(academy?.facilityLevel || 1) - 1] ?? 1;

    const delta = Math.round(
      followedAndWon * SYNERGY_CONFIG.GAIN_ON_INSTRUCTION_FOLLOWED_AND_WON * growthRate +
      ignoredAndLost * SYNERGY_CONFIG.LOSS_ON_INSTRUCTION_IGNORED_AND_LOST * growthRate
    );
    fighter.coachSynergy = clamp(fighter.coachSynergy + delta, 0, 100);
    await this.game.fighterCtrl.updateFighter(fighter);
  }

  // ===== Simular Período =====
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
          <strong>aceitas automaticamente</strong>.
        </p>

        <div class="form-group">
          <label class="form-label">Foco de Treino no Período</label>
          <div class="flex gap-2" style="flex-wrap:wrap">
            <button class="btn btn-sm btn-primary sim-focus-option" data-focus="">Manter escolha atual</button>
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
        <p>Avançando ${weeks} semanas na sua carreira</p>
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
    const fighter = await this.game.getPlayerFighter();

    const dossiers = {};
    for (const o of accepted) {
      const d = await this.game.opponentDossier(o);
      if (d) dossiers[o.id] = d;
    }

    // §Fase 3b — o dilema. Uma oferta contra um companheiro de treino não é uma
    // oferta como as outras, e o jogador precisa saber ANTES de aceitar.
    const teammates = {};
    for (const o of pending) {
      const t = await this.game.partnersService.isTeammate(fighter, o.opponentId);
      if (t) teammates[o.id] = t;
    }

    const contractProposals = await this._loadContractProposals(fighter);

    const html = OffersView.render(pending, accepted, history, fighter, now, dossiers, contractProposals, teammates);
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

    document.querySelectorAll('.bait-toggle').forEach(box => {
      box.addEventListener('change', async () => {
        const result = await this.game.setBait(box.dataset.offer, box.checked);
        if (!result.ok) this.notificationService.add('warning', 'Isca', result.reason);
        this.renderOffers();
      });
    });

    document.querySelectorAll('.offer-accept').forEach(btn => {
      btn.addEventListener('click', async () => {
        // Passa pelo controller, não direto no service: aceitar uma luta contra
        // um companheiro de treino tem consequência, e ela não pode depender de
        // qual botão o jogador clicou (§Fase 3b).
        await this.game.acceptOffer(btn.dataset.id, now);
        this.renderOffers();
      });
    });

    document.querySelectorAll('.offer-decline').forEach(btn => {
      btn.addEventListener('click', async () => {
        await this.game.declineOffer(btn.dataset.id, now);
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
        const result = await this.game.negotiateOffer(btn.dataset.id, parseInt(btn.dataset.bump));

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

    document.querySelectorAll('.contract-accept').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fighterId = btn.dataset.fighter;
        const promoId = btn.dataset.promo;
        const promoName = btn.dataset.promoName;

        // Verificar conflito com cinturão de outra promoção (compara por id)
        const conflict = await this.game.getSigningConflict(fighterId, promoId);

        if (conflict) {
          this._showContractConflictModal(fighterId, promoId, promoName, conflict, now);
        } else {
          const result = await this.game.contractService.accept(fighterId, promoId, now);
          if (result) {
            this.notificationService.add('success', 'Contrato Assinado!', `Você agora é exclusivo dessa promoção.`);
          }
          this.renderOffers();
        }
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

  // Modal de conflito ao assinar contrato segurando cinturão em outra promoção.
  // Oferece duas saídas: vagar o título e subir, ou adiar a decisão.
  _showContractConflictModal(fighterId, promoId, promoName, belts, now) {
    const existing = document.getElementById('conflictModalOverlay');
    if (existing) existing.remove();

    const beltsHtml = belts.map(b =>
      `<li><strong>${b.weightClass}</strong> · ${b.promotionName}</li>`
    ).join('');

    const isPlural = belts.length > 1;

    const modal = document.createElement('div');
    modal.id = 'conflictModalOverlay';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div class="card" style="max-width:520px;width:90%;padding:2rem">
        <h3 style="margin-top:0">Voc\u00EA \u00E9 campe\u00E3o!</h3>
        <p>Seu atleta segura o seguinte cintur\u00E3o${isPlural ? '\u00F5es' : ''}:</p>
        <ul>${beltsHtml}</ul>
        <p class="text-sm text-muted">Ao assinar com <strong>${promoName}</strong>, seu contrato exige exclusividade — voc\u00EA n\u00E3o pode lutar por outras promo\u00E7\u00F5es enquanto estiver sob contrato.</p>
        <div style="display:flex;flex-direction:column;gap:0.75rem;margin-top:1.5rem">
          <button id="conflictSignNow" class="btn btn-success">
            Subir agora — vagar cintur\u00E3o${isPlural ? '\u00F5es' : ''}
          </button>
          <button id="conflictPostpone" class="btn btn-secondary">
            Adiar — defender o cintur\u00E3o primeiro
          </button>
          <button id="conflictCancel" class="btn btn-ghost" style="color:var(--text-muted);font-size:0.85rem">
            Voltar
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#conflictSignNow').addEventListener('click', async () => {
      modal.remove();
      const result = await this.game.signContractWithVacate(fighterId, promoId, now);
      if (result.fighter) {
        this.notificationService.add('success', 'Contrato Assinado!',
          `${result.fighter.name} abdicou do${isPlural ? 's' : ''} cintur\u00E3o${isPlural ? '\u00F5es' : ''} e agora \u00E9 exclusivo do ${promoName}.`);
      }
      this.renderOffers();
    });

    modal.querySelector('#conflictPostpone').addEventListener('click', async () => {
      modal.remove();
      await this.game.contractService.postpone(fighterId);
      this.notificationService.add('info', 'Decis\u00E3o Adiada',
        `A proposta do ${promoName} foi mantida. Voc\u00EA pode aceit\u00E1-la quando estiver pronto.`);
      this.renderOffers();
    });

    modal.querySelector('#conflictCancel').addEventListener('click', () => {
      modal.remove();
    });
  }

  async _loadContractProposals(fighter) {
    if (!fighter) return [];
    try {
      const doc = await this.game.db.get('gameState', `contract-offer-${fighter.id}`);
      if (doc && doc.offers) {
        return doc.offers.map(offer => ({ ...offer, fighterId: fighter.id }));
      }
    } catch { /* sem propostas */ }
    return [];
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

    const fighter = await this.game.getPlayerFighter();
    const playerIds = new Set(fighter ? [fighter.id] : []);

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
  _playLiveHub(allResults, playerFighterIds, fighterA = null, fighterB = null) {
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
    try {
      import('./three-faceoff.js').then(mod => {
        if (!cancelled && faceOff) {
          threeFaceOff = new mod.ThreeFaceOff('hubFaceOff', fighterA, fighterB);
        }
      }).catch(() => {});
    } catch {}

    const finish = () => {
      cancelled = true;
      tl.kill();
      tl = gsap.timeline();

      rounds.forEach(r => r.style.display = 'block');
      rounds.forEach(r => {
        r.querySelectorAll('.live-beat').forEach(b => b.style.display = 'flex');
      });

      if (statusText) statusText.textContent = 'Luta encerrada';
      if (skipBtn) skipBtn.style.display = 'none';

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

    const showBeat = () => {
      if (cancelled) return;
      const round = rounds[roundIdx];
      if (!round) { finish(); return; }
      const beats = round.querySelectorAll('.live-beat');

      if (!beats.length || beatIdx >= beats.length) {
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

      beat.style.display = 'flex';

      if (beatType === 'knockdown') {
        gsap.to(faceOff || document.getElementById('liveHubRounds'), {
          x: '+=6', duration: 0.04, repeat: 4, yoyo: true, ease: 'power1.inOut',
        });
        if (threeFaceOff?.onKnockdown) threeFaceOff.onKnockdown();
      } else if (beatType === 'finish') {
        gsap.to(faceOff || document.getElementById('liveHubRounds'), {
          x: '+=10', duration: 0.05, repeat: 6, yoyo: true, ease: 'power1.inOut',
        });
        const flash = document.createElement('div');
        flash.style.cssText = 'position:fixed;inset:0;background:rgba(232,35,74,0.3);pointer-events:none;z-index:999';
        document.body.appendChild(flash);
        gsap.to(flash, { opacity: 0, duration: 0.6, onComplete: () => flash.remove() });
        if (threeFaceOff?.onFinish) threeFaceOff.onFinish();
      }

      beatIdx++;
      const nextDelay = beatType === 'finish' ? 1.6 : beatType === 'knockdown' ? 0.9 : 0.45;
      gsap.delayedCall(nextDelay, showBeat);
    };

    if (rounds.length === 0 || cancelled) { finish(); return; }

    tl.to(statusCard, { opacity: 1, duration: 0.3 }, 0)
      .to(title, { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.2)' }, '-=0.1')
      .to(subtitle, { opacity: 1, duration: 0.3 }, '-=0.15');

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

    const playerFighter = await this.game.getPlayerFighter();
    const isPlayer = playerFighter?.id === fighter.id;

    const html = FighterProfileView.render(fighter, fighter.fights, isPlayer);
    await LayoutView.render(html);

    document.querySelectorAll('.fighter-back').forEach(btn => {
      btn.addEventListener('click', () => {
        this.navigateTo(this.previousView);
      });
    });

    document.querySelectorAll('.change-weight-class').forEach(btn => {
      btn.addEventListener('click', async () => {
        const dir = btn.dataset.dir;
        const fId = btn.dataset.fighter;
        const f = await this.game.fighterCtrl.getFighter(fId);
        if (!f) return;

        const adj = getAdjacentWeightClasses(f.weightClass);
        const newWeightClass = dir === 'up' ? adj.up : adj.down;
        if (!newWeightClass) return;

        const cost = 5000;
        if (f.cash < cost) {
          this.notificationService.add('warning', 'Divisão', `Saldo insuficiente. Mudança custa ${formatCurrency(cost)}.`);
          return;
        }

        const oldClass = f.weightClass;
        f.weightClass = newWeightClass;

        if (dir === 'up') {
          f.attributes.power = Math.max(1, (f.attributes.power || 50) - 3);
          f.attributes.strength = Math.max(1, (f.attributes.strength || 50) - 2);
          f.attributes.speed = Math.min(99, (f.attributes.speed || 50) + 2);
          f.attributes.cardio = Math.min(99, (f.attributes.cardio || 50) + 1);
        } else {
          f.attributes.power = Math.min(99, (f.attributes.power || 50) + 2);
          f.attributes.strength = Math.min(99, (f.attributes.strength || 50) + 3);
          f.attributes.speed = Math.max(1, (f.attributes.speed || 50) - 2);
          f.attributes.cardio = Math.max(1, (f.attributes.cardio || 50) - 2);
        }

        const state = await this.seasonService.getState();
        const week = absWeek(state);
        f.addTransaction(week, `Mudança divisão: ${oldClass} → ${newWeightClass}`, -cost);
        await this.game.fighterCtrl.updateFighter(f);

        this.notificationService.add('success', 'Divisão Alterada', `Você mudou de ${oldClass} para ${newWeightClass}.`);
        this.showFighterProfile(fighterId);
      });
    });

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

    // Task 10: perks teia — aprender perks no perfil
    // Gap #1: equipar/remover golpes
    // Gap #2: troca de estilo
    FighterProfileView.bindEvents(fighter, {
      onPerkLearned: () => this.showFighterProfile(fighter.id),
      onMovesetChange: async () => {
        await this.game.fighterCtrl.updateFighter(fighter);
        this.showFighterProfile(fighter.id);
      },
      onStyleSwitch: async () => {
        const state = await this.seasonService.getState();
        const now = absWeek(state);
        if (fighter.styleLockedUntilAbsWeek > now) {
          this.notificationService.add('warning', 'Estilo', `Estilo travado por ${fighter.styleLockedUntilAbsWeek - now} semana${fighter.styleLockedUntilAbsWeek - now > 1 ? 's' : ''}.`);
          return;
        }
        const styleKeys = Object.keys(FIGHTING_STYLES).filter(k => k !== fighter.style);
        const labels = styleKeys.map(k => `${FIGHTING_STYLES[k].label} (vantagem vs ${FIGHTING_STYLES[k].matchup.advantage.map(s => FIGHTING_STYLES[s]?.label).join(', ') || '—'})`);
        const choice = prompt(
          `Trocar de estilo (custa $500 e trava 4 semanas):\n\nEstilo atual: ${FIGHTING_STYLES[fighter.style].label}\n\nDigite o número do novo estilo:\n${styleKeys.map((k, i) => `${i + 1}. ${labels[i]}`).join('\n')}`
        );
        if (!choice) return;
        const idx = parseInt(choice, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= styleKeys.length) {
          this.notificationService.add('warning', 'Estilo', 'Opção inválida.');
          return;
        }
        if (fighter.cash < 500) {
          this.notificationService.add('warning', 'Estilo', 'Você precisa de $500 para trocar de estilo.');
          return;
        }
        const newStyleId = styleKeys[idx];
        fighter.cash -= 500;
        fighter.addTransaction(now, `Troca de estilo: ${FIGHTING_STYLES[fighter.style].label} → ${FIGHTING_STYLES[newStyleId].label}`, -500);
        const oldStyleId = fighter.style;
        fighter.style = newStyleId;
        fighter.styleLockedUntilAbsWeek = now + 4;
        fighter.styleChangedAtAbsWeek = now;
        // Reset moveset to new style's pool
        const newPool = FIGHTING_STYLES[newStyleId].poolMoves || [];
        const lostMoves = fighter.moveset.filter(m => !newPool.includes(m));
        fighter.moveset = fighter.moveset.filter(m => newPool.includes(m)).slice(0, fighter.getMaxMoves());
        if (fighter.moveset.length === 0 && newPool.length > 0) {
          fighter.moveset = [newPool[0]];
        }
        // Gap #3: auto-conceder/remover stylePerk
        const oldPerkId = FIGHTING_STYLES[oldStyleId]?.stylePerkId;
        const newPerkId = FIGHTING_STYLES[newStyleId]?.stylePerkId;
        if (oldPerkId && fighter.perks.includes(oldPerkId)) {
          fighter.perks = fighter.perks.filter(id => id !== oldPerkId);
        }
        if (newPerkId && !fighter.perks.includes(newPerkId)) {
          fighter.perks.push(newPerkId);
          // Check if learned via learnPerk to respect perk point cost—style perks are free
        }
        // Perks perdidos por requisito de estilo
        const lostPerks = fighter.perks.filter(id => {
          const p = PERKS[id];
          return p && p.requirements?.style && p.requirements.style !== newStyleId;
        });
        fighter.perks = fighter.perks.filter(id => {
          const p = PERKS[id];
          return !p || !p.requirements?.style || p.requirements.style === newStyleId;
        });
        await this.game.fighterCtrl.updateFighter(fighter);
        const noticeParts = [`Você mudou para ${FIGHTING_STYLES[newStyleId].label}. Estilo travado por 4 semanas.`];
        if (lostMoves.length > 0) noticeParts.push(`${lostMoves.length} golpe${lostMoves.length > 1 ? 's' : ''} perdido${lostMoves.length > 1 ? 's' : ''} (não disponíve${lostMoves.length > 1 ? 'is' : ''} no ${FIGHTING_STYLES[newStyleId].label}).`);
        if (lostPerks.length > 0) {
          const names = lostPerks.map(id => PERKS[id]?.name || id);
          noticeParts.push(`Perks perdidos: ${names.join(', ')} (requerem ${FIGHTING_STYLES[oldStyleId].label}).`);
        }
        this.notificationService.add('success', '🔄 Troca de Estilo', noticeParts.join(' '));
        this.showFighterProfile(fighter.id);
      },
    });
  }

  // ===== Training Camp =====
  async renderTrainingCamp() {
    const fighter = await this.game.getPlayerFighter();
    const bookings = await this.game.offerService.getAccepted();
    const state = await this.seasonService.getState();
    const now = (state.year - 1) * 52 + state.week;
    const booking = bookings.find(b => b.fighterId === fighter.id) || null;
    // Fase 3 — a academia define quais armas existem pra você. Uma academia
    // pequena não tem quem te ensine wrestling; é isso que faz a escolha de
    // academia virar uma aposta de carreira, e não um bônus numérico.
    const academy = await this.game.getAcademy(fighter.academyId);
    const weaponOptions = TapeService.installablePlans(academy);
    const team = await this.game.partnersService.getTeammates(fighter);
    const html = TrainingCampView.render(fighter, booking, now, weaponOptions, team);
    await LayoutView.render(html);
    this._bindTrainingCamp(fighter, booking, now);
  }

  _bindTrainingCamp(fighter, booking, now) {
    // O bloco da arma só faz sentido quando o foco é instalá-la — mostrar as
    // opções de arma num camp de cardio seria oferecer uma decisão que não
    // existe.
    const specSelect = document.querySelector(`.camp-spec[data-fighter="${fighter.id}"]`);
    const weaponBlock = document.querySelector('[data-weapon-block]');
    specSelect?.addEventListener('change', () => {
      if (weaponBlock) weaponBlock.style.display = specSelect.value === 'install_weapon' ? '' : 'none';
    });

    document.querySelectorAll('.camp-save').forEach(btn => {
      btn.addEventListener('click', async () => {
        const intensity = document.querySelector(`.camp-intensity[data-fighter="${fighter.id}"]`)?.value;
        const spec = document.querySelector(`.camp-spec[data-fighter="${fighter.id}"]`)?.value;

        if (!intensity) {
          this.notificationService.add('warning', 'Camp', 'Selecione uma intensidade para o camp.');
          return;
        }
        if (intensity === 'intense' && !booking) {
          this.notificationService.add('warning', 'Camp', 'Treino intenso só é permitido com luta marcada.');
          return;
        }

        const weaponTarget = spec === 'install_weapon'
          ? document.querySelector(`.camp-weapon-target[data-fighter="${fighter.id}"]`)?.value || null
          : null;
        const partnerId = document.querySelector(`.camp-partner[data-fighter="${fighter.id}"]`)?.value || null;
        const profFocus = document.querySelector('#camp-proficiency-focus')?.value || null;

        TrainingCamp.configureCamp(fighter, intensity, spec || 'striking', partnerId, weaponTarget, profFocus);
        await this.game.fighterCtrl.updateFighter(fighter);

        const cost = CAMP_CONFIG.WEEKLY_COST[intensity] || 0;
        this.notificationService.add('success', 'Camp Configurado', `Você iniciou camp ${intensity} ($${cost.toLocaleString()}/sem).`);
        this.renderTrainingCamp();
      });
    });

    document.querySelectorAll('.camp-cancel').forEach(btn => {
      btn.addEventListener('click', async () => {
        TrainingCamp.cancelCamp(fighter);
        await this.game.fighterCtrl.updateFighter(fighter);
        this.notificationService.add('info', 'Camp Cancelado', 'Camp cancelado.');
        this.renderTrainingCamp();
      });
    });
  }

  // ===== Rankings =====
  async renderRankings() {
    const allFighters = await this.game.fighterCtrl.getAllFighters();
    const active = allFighters.filter(f => f.status !== 'retired');
    const rankings = RankingService.calculateRankings(active);
    const playerFighter = await this.game.getPlayerFighter();
    const belts = await this.game.titleService.getBeltMap(playerFighter?.id);
    const html = RankingsView.render(rankings, belts, playerFighter?.id);
    await LayoutView.render(html);
    this._bindFighterClicks();
  }

  // ===== Finanças =====
  async renderFinance() {
    const fighter = await this.game.getPlayerFighter();
    const academy = await this.game.getPlayerAcademy();
    const manager = await this.game.getPlayerManager();
    const html = FinanceView.render(fighter, academy, manager);
    await LayoutView.render(html);

    document.querySelectorAll('.lifestyle-set').forEach(btn => {
      btn.addEventListener('click', async () => {
        await this.game.setLifestyle(btn.dataset.tier);
        this.renderFinance();
      });
    });
  }

  // ===== Academia (escolha de onde treinar, §E.3) =====
  async renderAcademy() {
    const academies = await this.game.getAcademies();
    const managers = await this.game.getManagers();
    const fighter = await this.game.getPlayerFighter();
    const html = AcademyView.render(academies, fighter, managers);
    await LayoutView.render(html);

    document.querySelectorAll('.academy-switch').forEach(btn => {
      btn.addEventListener('click', async () => {
        const result = await this.game.switchAcademy(btn.dataset.academy);
        if (result.ok) {
          this.notificationService.add('success', 'Academia Trocada', `Agora você treina em ${result.academy.name}.`);
        } else {
          this.notificationService.add('warning', 'Troca Falhou', result.reason);
        }
        this.renderAcademy();
      });
    });

    document.querySelectorAll('.manager-hire').forEach(btn => {
      btn.addEventListener('click', async () => {
        // Trocar de empresário já contratado cobra a multa de rescisão
        // (§C.1, espelha ContractService.terminate) — só então contrata o novo.
        if (fighter.managerId) {
          const termination = await this.game.terminateManager();
          if (!termination.ok) {
            this.notificationService.add('warning', 'Troca Falhou', termination.reason);
            return;
          }
        }
        const result = await this.game.hireManager(btn.dataset.manager);
        if (result.ok) {
          this.notificationService.add('success', 'Novo Empresário', `${result.manager.name} agora cuida da sua carreira.`);
        } else {
          this.notificationService.add('warning', 'Contratação Falhou', result.reason);
        }
        this.renderAcademy();
      });
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
      const text = `Acabei de imortalizar ${entries.length} lendas no MMA Manager!\n\nConstrua uma carreira. Vire lenda.${SHARE_URL ? `\n👉 ${SHARE_URL}` : ''}`;
      if (navigator.share) {
        navigator.share(SHARE_URL ? { title: 'MMA Manager', text, url: SHARE_URL } : { title: 'MMA Manager', text });
      } else {
        navigator.clipboard.writeText(text).then(() => {
          this.notificationService?.add('success', 'Compartilhar', 'Link copiado! Envie para um amigo fã de MMA.');
        });
      }
    });
  }

  // ===== Cerimônia de Aposentadoria =====
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

    // §B.3 — o entry do Hall da Fama é só o snapshot resumido feito na
    // indução (ver hall-of-fame.js); o documentário precisa de dados que
    // NÃO estão nesse snapshot: fights[] completo (pra estreia/pico/zebra/
    // streak), permanentScars, discoveredTraits e rivalidades. Isso é uma
    // leitura pura (getFighter), sem nenhum updateFighter() depois — não
    // corre o risco do bug de fetch-mutate-save duplo já visto nesta sessão.
    const fighter = await this.game.fighterCtrl.getFighter(fighterId);
    const topMoments = this.game.careerLogService ? await this.game.careerLogService.topByMagnitude(fighterId, 8) : [];

    let rivalryInfo = null;
    if (fighter && this.rivalryService) {
      const rivalries = await this.rivalryService.getRivalries(fighter.id);
      if (rivalries.length > 0) {
        const top = rivalries.reduce((a, b) => (b.intensity > a.intensity ? b : a));
        const otherId = top.fighterAId === fighter.id ? top.fighterBId : top.fighterAId;
        const fromFights = fighter.fights.find(f => f.opponentId === otherId)?.opponent;
        const otherFighter = fromFights ? null : await this.game.fighterCtrl.getFighter(otherId);
        rivalryInfo = { rivalry: top, opponentName: fromFights || otherFighter?.name || 'Adversário desconhecido' };
      }
    }

    const html = RetirementCeremonyView.render(entry, {
      fighter,
      topMoments,
      rivalryInfo,
      startedAt: gameState?.startedAt || null,
    });
    await LayoutView.render(html);

    document.getElementById('viewFullCareerBtn')?.addEventListener('click', () => {
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

    document.querySelectorAll('.notif-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => this.renderNotifications(btn.dataset.cat));
    });

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

  // ===== Calendário visual =====
  async renderCalendarView() {
    const data = await this.game.getCalendarData();

    if (!data) {
      await LayoutView.render('<div class="card"><div class="card-body"><p class="text-muted">Crie um personagem primeiro.</p></div></div>');
      return;
    }

    await LayoutView.render(renderCalendar(data));
  }

  async renderPressConference() {
    const fighter = await this.game.getPlayerFighter();
    const upcoming = await this.game.offerService.getAccepted();

    const booking = upcoming.length > 0 ? upcoming[0] : null;
    let fighterA = fighter;
    let fighterB = null;
    let event = null;

    if (booking) {
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
      event = { name: 'Nenhuma luta marcada', promotion: '' };
      fighterB = { name: '—', record: { wins: 0, losses: 0, draws: 0 } };
    }

    const scenarios = PressConference.getScenarios();
    // A coletiva é única por luta marcada (ver Fighter.pcDoneForOfferId).
    const alreadyDone = !!booking && fighterA.pcDoneForOfferId === booking.id;
    const html = PressConferenceView.render(scenarios, fighterA, fighterB, event, !!booking, alreadyDone);
    await LayoutView.render(html);

    if (!booking || alreadyDone) return;

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
          const totalHype = fighterA.pcHype || 0;
          const hypeBonus = totalHype * HYPE_PURSE_RATIO;
          // Fecha a coletiva DESTA luta — reentrar na aba não gera mais hype.
          fighterA.pcDoneForOfferId = booking.id;
          await this.game.fighterCtrl.updateFighter(fighterA);

          if (totalHype >= PressConference.RIVALRY_HYPE_THRESHOLD && booking && fighterB?.id) {
            const rivalry = await this.rivalryService.addPressConferenceHeat(
              fighterA.id, fighterB.id, totalHype, booking.promotionId
            );
            if (rivalry) {
              this.notificationService.add('info', 'Rivalidade',
                `A provocação na coletiva acirrou a rivalidade com ${fighterB.name}! (Intensidade: ${rivalry.intensityLabel})`);
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
              `Você gerou hype +${totalHype} na coletiva. Bônus de ${formatCurrency(hypeBonus)} na bolsa da luta!`);
          } else {
            this.notificationService.add('info', 'Imprensa', 'Conferência de imprensa concluída.');
          }
        }
      });
    });
  }
}

const app = new App();
app.init();

window.app = app;
