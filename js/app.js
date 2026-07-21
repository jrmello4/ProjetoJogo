import { LayoutView } from './views/layout.js';
import { DashboardView, ONBOARDING_SPOTLIGHT } from './views/dashboard.js';
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
import { HallOfFame } from './services/hall-of-fame.js';
import { renderCalendar } from './views/calendar.js';
import { RankingsView } from './views/rankings.js';
import { FinanceView } from './views/finance.js';
import { RankingService } from './services/ranking.js';
import { computeFightStakes } from './services/fight-stakes.js';
import { TapeService } from './services/tape-service.js';
import { ReadinessService } from './services/readiness-service.js';
import { NotificationsView } from './views/notifications.js';
import { GameController } from './controllers/game-controller.js';
import { TrainingCamp } from './controllers/training-camp.js';
import { OnboardingService } from './services/onboarding-service.js';
import { PressConference } from './controllers/press-conference.js';
import { WeeklyTrainingController } from './controllers/weekly-training.js';
import { CombatAdapter } from './controllers/combat-adapter.js';
import { MetaProgressionService } from './services/meta-progression-service.js';
import * as PerksScreenView from './views/perks-screen.js';
import { RivalryService } from './services/rivalry-service.js';
import { SeasonService } from './services/season-service.js';
import { NotificationService } from './services/notification-service.js';
import { SaveService } from './services/save-service.js';
import { CinematicService } from './services/cinematic-service.js';
import { AudioService } from './services/audio-service.js';
import { AdService } from './services/ad-service.js';
import { MonetizationService } from './services/monetization-service.js';
import { PortraitService } from './services/portrait-service.js';
import { VisualIdentityService } from './services/visual-identity-service.js';
import { AppearanceEditor } from './views/appearance-editor.js';
import { SettingsView } from './views/settings.js';
import { TutorialCoach } from './services/tutorial-coach.js';
import { ThreeArena } from './three-arena.js';
import { ThreeBackground } from './three-background.js';
import { motion } from './motion/motion-engine.js';
import { DIFFICULTIES, MILESTONE_LABELS, SIMULATE_PERIOD_PRESETS, TRAINING_FOCUS_META, ARCHETYPES, ORIGINS, absWeekToLabel, SYNERGY_CONFIG, FIGHTING_STYLES, PERKS, CHALLENGE_MODES } from './config/game-config.js';
import { formatCurrency, getAdjacentWeightClasses, clamp, sanitizePlayerName, e } from './utils/helpers.js';
import { validateCharCreateStep } from './utils/char-create-validate.js';
import { CAMP_CONFIG, HYPE_PURSE_RATIO, absWeek } from './config/game-config.js';

// Combate por cartas é o motor oficial das lutas do jogador (WorldService
// + CombatAdapter). ?cardCombat=true permanece como flag legada de dev e
// expõe app.runCardFight no console se quiser testar fora do fluxo semanal.
if (new URLSearchParams(window.location.search).has('cardCombat')) {
  window.__useCardCombat = true;
}

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
    this.monetizationService = new MonetizationService(this.game.db);
    this.threeArena = null;
    this.threeBackground = null;
  }

  async init() {
    try { motion.init(); } catch(e) { console.warn('Motion init failed:', e); }
    AudioService.init();
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

    // Decorativo — uma falha de WebGL aqui está no caminho síncrono do boot
    // e não pode impedir o resto do app de carregar.
    try {
      this.threeBackground = new ThreeBackground('mainContent');
    } catch (err) {
      console.warn('ThreeBackground falhou ao iniciar (WebGL indisponível?):', err);
    }

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
      // Primeiro lançamento, sem jogador ainda — a pior tela possível pra
      // travar é esta (spinner de boot pra sempre, sem erro nenhum), então
      // aqui ganha o mesmo tratamento do resto do boot.
      try {
        await this._showCharacterCreation();
      } catch (err) {
        console.error('Falha ao mostrar criação de personagem:', err);
        document.getElementById('mainContent').innerHTML = `
          <div style="display:flex;align-items:center;justify-content:center;min-height:60vh;flex-direction:column;gap:1rem;">
            <h2 style="color:var(--accent)">Erro ao carregar criação de personagem</h2>
            <p style="color:var(--text-secondary);text-align:center;max-width:500px;">
              Algo deu errado montando esta tela. Tente recarregar — se persistir, clique em "Resetar Dados" no menu lateral.
            </p>
            <button class="btn btn-primary" onclick="location.reload()">Tentar Novamente</button>
          </div>`;
      }
      return;
    }

    this.navigateTo('dashboard');
  }

  // ===== Criação de personagem (§A.7) — wizard multi-step =====
  // Shell + draft em memória; um único createPlayerFighter no Start.
  // Não confundir com ONBOARDING_STEPS (pós-carreira no dashboard).

  static get CHAR_CREATE_STEPS() {
    return [
      { id: 1, short: 'Identidade', lead: 'Antes do primeiro round, o mundo só vê um rosto e um nome. Quem entra no octógono?' },
      { id: 2, short: 'Estilo', lead: 'Todo lutador carrega uma escola e um jeito de apertar o gatilho. Qual é o seu?' },
      { id: 3, short: 'Corner', lead: 'Ninguém sobe sozinho. Escolha onde treina e quem negocia por você.' },
      { id: 4, short: 'Jornada', lead: 'Última porta antes da carreira. Quanto risco você aguenta — e sob quais regras?' },
    ];
  }

  static get CHAR_CREATE_WEIGHT_LABELS() {
    return {
      Flyweight: 'Peso Mosca',
      Bantamweight: 'Peso Galo',
      Featherweight: 'Peso Pena',
      Lightweight: 'Peso Leve',
      Welterweight: 'Peso Meio-Médio',
      Middleweight: 'Peso Médio',
      'Light Heavyweight': 'Meio-Pesado',
      Heavyweight: 'Peso Pesado',
    };
  }

  async _showCharacterCreation() {
    // Já aberto (ex.: double-click em Nova Carreira)
    if (document.getElementById('characterCreationModal')) return;

    const academies = await this.game.getAcademies();
    const managers = await this.game.getManagers();
    const hasCompletedCareer = await HallOfFame.hasCompletedCareer(this.game.db);
    const originKeys = Object.keys(ORIGINS);

    const ctx = { academies, managers, hasCompletedCareer };
    const session = {
      step: 1,
      maxReachedStep: 1,
      draft: {
        name: '',
        appearance: PortraitService.contextualAppearance({
          age: 22,
          popularity: 12,
          totalFights: 0,
          fightingStyle: 'balanced',
        }),
        weightClass: 'Lightweight',
        archetype: 'generalist',
        origin: originKeys[0] || 'kickboxing',
        difficultyId: 'normal',
        academyId: academies[0]?.id ?? null,
        managerId: managers[0]?.id ?? null,
        challengeMode: null,
      },
    };

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'characterCreationModal';
    modal.innerHTML = `
      <div class="modal modal--character-create" style="max-width:640px">
        <div class="modal-header">
          <h3 id="charCreateTitle">Crie seu Lutador</h3>
          <span class="char-create-step-meta text-xs text-muted" id="charCreateStepMeta" aria-live="polite">Passo 1 de 4</span>
        </div>
        <nav class="char-create-progress" id="charCreateProgress" aria-label="Progresso da criação"></nav>
        <p class="char-create-lead text-sm" id="charCreateLead"></p>
        <div id="charCreateError" class="char-create-error" role="alert" hidden></div>
        <div class="char-create-body" id="charCreateBody" data-step="1"></div>
        <div class="modal-actions char-create-actions">
          <button type="button" class="btn btn-secondary" id="charCreateBack" hidden>Voltar</button>
          <button type="button" class="btn btn-primary" id="charCreateNext">Próximo</button>
          <button type="button" class="btn btn-primary" id="characterCreationStartBtn" hidden>Começar carreira</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const backBtn = modal.querySelector('#charCreateBack');
    const nextBtn = modal.querySelector('#charCreateNext');
    const startBtn = modal.querySelector('#characterCreationStartBtn');

    const goToStep = (target) => {
      this._syncCharCreateDraft(modal, session, session.step);
      session.step = target;
      this._clearCharCreateError(modal);
      this._renderCharCreateStep(modal, session, ctx);
      this._bindCharCreateStepControls(modal, session, ctx);
    };

    backBtn.addEventListener('click', () => {
      if (session.step <= 1) return;
      goToStep(session.step - 1);
    });

    nextBtn.addEventListener('click', () => {
      this._syncCharCreateDraft(modal, session, session.step);
      const result = validateCharCreateStep(session.draft, session.step, ctx);
      if (!result.ok) {
        this._showCharCreateError(modal, result);
        return;
      }
      this._clearCharCreateError(modal);
      const next = Math.min(4, session.step + 1);
      session.step = next;
      session.maxReachedStep = Math.max(session.maxReachedStep, next);
      this._renderCharCreateStep(modal, session, ctx);
      this._bindCharCreateStepControls(modal, session, ctx);
    });

    startBtn.addEventListener('click', async () => {
      this._syncCharCreateDraft(modal, session, session.step);
      // Re-checa unlock HoF fresco no commit (DOM pode estar stale vs progressão)
      ctx.hasCompletedCareer = await HallOfFame.hasCompletedCareer(this.game.db);
      const result = validateCharCreateStep(session.draft, 'all', ctx);
      if (!result.ok) {
        this._showCharCreateError(modal, result);
        return;
      }

      startBtn.disabled = true;
      backBtn.disabled = true;
      nextBtn.disabled = true;
      this._clearCharCreateError(modal);

      try {
        const name = sanitizePlayerName(session.draft.name, { fallback: '' });
        await this.game.createPlayerFighter({
          name,
          weightClass: session.draft.weightClass,
          archetype: session.draft.archetype,
          origin: session.draft.origin,
          difficultyId: session.draft.difficultyId,
          academyId: session.draft.academyId,
          managerId: session.draft.managerId,
          challengeMode: session.draft.challengeMode || null,
          appearance: { ...session.draft.appearance },
        });

        localStorage.setItem('characterCreationDone', '1');
        LayoutView.closeModal(modal);
        this.notificationService.add('success', 'Carreira Iniciada', `${name} deu o primeiro passo rumo à elite mundial.`);
        this.navigateTo('dashboard');
        setTimeout(() => this._showTutorial(), 600);
      } catch (err) {
        console.error('Falha ao criar lutador:', err);
        this._showCharCreateError(modal, {
          ok: false,
          message: 'Não foi possível iniciar a carreira. Tente de novo.',
        });
        startBtn.disabled = false;
        backBtn.disabled = false;
        nextBtn.disabled = false;
        this._updateCharCreateNav(modal, session);
      }
    });

    // Progresso: jumps só para steps já alcançados
    modal.querySelector('#charCreateProgress').addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-char-step]');
      if (!btn) return;
      const target = Number(btn.dataset.charStep);
      if (!target || target > session.maxReachedStep || target === session.step) return;
      goToStep(target);
    });

    this._renderCharCreateStep(modal, session, ctx);
    this._bindCharCreateStepControls(modal, session, ctx);
  }

  _showCharCreateError(modal, result) {
    const el = modal.querySelector('#charCreateError');
    if (!el) return;
    el.hidden = false;
    el.textContent = result.message || 'Verifique os campos.';
    el.focus?.();
    const field = result.field;
    if (field === 'name') modal.querySelector('#charName')?.focus();
    else if (field === 'weightClass') modal.querySelector('#charWeightClass')?.focus();
  }

  _clearCharCreateError(modal) {
    const el = modal.querySelector('#charCreateError');
    if (!el) return;
    el.hidden = true;
    el.textContent = '';
  }

  _updateCharCreateNav(modal, session) {
    const backBtn = modal.querySelector('#charCreateBack');
    const nextBtn = modal.querySelector('#charCreateNext');
    const startBtn = modal.querySelector('#characterCreationStartBtn');
    const onLast = session.step >= 4;
    if (backBtn) {
      backBtn.hidden = session.step <= 1;
      backBtn.disabled = false;
    }
    if (nextBtn) {
      nextBtn.hidden = onLast;
      nextBtn.disabled = false;
    }
    if (startBtn) {
      startBtn.hidden = !onLast;
      startBtn.disabled = false;
    }
  }

  _syncCharCreateDraft(modal, session, step) {
    const d = session.draft;
    if (step === 1) {
      const nameEl = modal.querySelector('#charName');
      const wcEl = modal.querySelector('#charWeightClass');
      if (nameEl) d.name = nameEl.value;
      if (wcEl && !wcEl.disabled) d.weightClass = wcEl.value;
      else if (wcEl && wcEl.value) d.weightClass = wcEl.value;
    } else if (step === 2) {
      const arch = modal.querySelector('[data-archetype].selected')?.dataset.archetype;
      const origin = modal.querySelector('[data-origin].selected')?.dataset.origin;
      if (arch) d.archetype = arch;
      if (origin) d.origin = origin;
    } else if (step === 3) {
      const academy = modal.querySelector('[data-academy].selected')?.dataset.academy;
      const manager = modal.querySelector('[data-manager].selected')?.dataset.manager;
      if (academy) d.academyId = academy;
      if (manager) d.managerId = manager;
    } else if (step === 4) {
      const diff = modal.querySelector('[data-difficulty].selected')?.dataset.difficulty;
      const challengeEl = modal.querySelector('[data-challenge].selected');
      if (diff) d.difficultyId = diff;
      if (challengeEl) {
        const raw = challengeEl.dataset.challenge;
        d.challengeMode = raw ? raw : null;
      }
    }
  }

  _renderCharCreateStep(modal, session, ctx) {
    const { step, draft, maxReachedStep } = session;
    const steps = App.CHAR_CREATE_STEPS;
    const meta = modal.querySelector('#charCreateStepMeta');
    const lead = modal.querySelector('#charCreateLead');
    const progress = modal.querySelector('#charCreateProgress');
    const body = modal.querySelector('#charCreateBody');
    if (meta) meta.textContent = `Passo ${step} de 4`;
    if (lead) lead.textContent = steps[step - 1]?.lead || '';

    if (progress) {
      progress.innerHTML = steps.map((s) => {
        const done = s.id < step;
        const active = s.id === step;
        const clickable = s.id <= maxReachedStep;
        const cls = [
          'char-create-step',
          done ? 'is-done' : '',
          active ? 'is-active' : '',
          clickable ? 'is-clickable' : '',
        ].filter(Boolean).join(' ');
        return `
          <button type="button" class="${cls}" data-char-step="${s.id}"
            ${clickable ? '' : 'disabled'}
            ${active ? 'aria-current="step"' : ''}
            aria-label="Passo ${s.id}: ${e(s.short)}">
            <span class="char-create-step-num">${s.id}</span>
            <span class="char-create-step-label">${e(s.short)}</span>
          </button>`;
      }).join('');
    }

    if (body) {
      body.dataset.step = String(step);
      body.innerHTML = this._charCreateStepHtml(step, draft, ctx);
      body.scrollTop = 0;
    }

    this._updateCharCreateNav(modal, session);
  }

  _charCreateStepHtml(step, draft, ctx) {
    const { academies, managers, hasCompletedCareer } = ctx;
    const wcLabels = App.CHAR_CREATE_WEIGHT_LABELS;

    if (step === 1) {
      const options = Object.entries(wcLabels).map(([value, label]) => {
        const locked = value === 'Heavyweight' && !hasCompletedCareer;
        const selected = draft.weightClass === value ? 'selected' : '';
        const text = locked ? '🔒 Peso Pesado (complete uma carreira)' : label;
        return `<option value="${value}" ${selected} ${locked ? 'disabled' : ''}>${text}</option>`;
      }).join('');
      return `
        <div class="form-group">
          <label class="form-label" for="charName">Nome</label>
          <input type="text" class="form-input" id="charName" maxlength="30"
            placeholder="Seu nome de lutador" value="${e(draft.name || '')}" autocomplete="off">
        </div>
        <div class="form-group">
          <label class="form-label">Aparência</label>
          <div id="charAppearance"></div>
        </div>
        <div class="form-group">
          <label class="form-label" for="charWeightClass">Categoria de Peso</label>
          <select class="form-select" id="charWeightClass">${options}</select>
        </div>`;
    }

    if (step === 2) {
      return `
        <div class="form-group">
          <label class="form-label">Arquétipo Inicial</label>
          <div class="difficulty-grid">
            ${Object.entries(ARCHETYPES).map(([key, a]) => `
              <button type="button" class="difficulty-option ${key === draft.archetype ? 'selected' : ''}" data-archetype="${key}">
                <div class="difficulty-name">${e(a.label)}</div>
              </button>
            `).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Origem Esportiva</label>
          <div class="difficulty-grid" style="grid-template-columns:repeat(3,1fr)">
            ${Object.entries(ORIGINS).map(([key, o]) => `
              <button type="button" class="difficulty-option ${key === draft.origin ? 'selected' : ''}" data-origin="${key}">
                <div class="difficulty-name">${e(o.label)}</div>
              </button>
            `).join('')}
          </div>
        </div>`;
    }

    if (step === 3) {
      return `
        <div class="form-group">
          <label class="form-label">Primeira Academia</label>
          <div class="difficulty-grid">
            ${academies.map((a) => `
              <button type="button" class="difficulty-option ${a.id === draft.academyId ? 'selected' : ''}" data-academy="${a.id}">
                <div class="difficulty-name">${e(a.name)}</div>
                <div class="text-xs text-muted mt-2">${e(a.philosophy)} · ${formatCurrency(a.weeklyFee)}/sem</div>
              </button>
            `).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Primeiro Empresário</label>
          <div class="difficulty-grid">
            ${managers.map((m) => `
              <button type="button" class="difficulty-option ${m.id === draft.managerId ? 'selected' : ''}" data-manager="${m.id}">
                <div class="difficulty-name">${e(m.name)}</div>
                <div class="text-xs text-muted mt-2">${MANAGER_STYLE_LABELS[m.style] || m.style} · corte ${Math.round(m.cut * 100)}%</div>
              </button>
            `).join('')}
          </div>
        </div>`;
    }

    // Step 4 — jornada + resumo
    const challengeSel = draft.challengeMode || '';
    const summary = this._charCreateSummaryChips(draft, ctx);
    return `
      <div class="form-group">
        <label class="form-label">Reserva Financeira</label>
        <div class="difficulty-grid">
          ${DIFFICULTIES.map(d => `
            <button type="button" class="difficulty-option ${d.id === draft.difficultyId ? 'selected' : ''}" data-difficulty="${d.id}">
              <div class="difficulty-name">${e(d.name)}</div>
              <div class="difficulty-cash">${formatCurrency(d.cash)}</div>
              <div class="text-xs text-muted mt-2">${e(d.desc)}</div>
            </button>
          `).join('')}
        </div>
      </div>
      <div class="form-group" id="challengeModeGroup">
        <label class="form-label">Modo Desafio <span class="text-xs text-muted">(opcional)</span></label>
        <div class="difficulty-grid" style="grid-template-columns:repeat(3,1fr)">
          ${Object.entries(CHALLENGE_MODES).map(([key, m]) => {
            const locked = !hasCompletedCareer;
            return `
              <button type="button" class="difficulty-option challenge-option ${locked ? 'challenge-locked' : ''} ${challengeSel === key ? 'selected' : ''}"
                data-challenge="${key}" ${locked ? 'disabled' : ''}>
                <div class="difficulty-name">${m.icon} ${e(m.name)}</div>
                <div class="text-xs text-muted mt-2">${e(m.description)}</div>
                ${locked ? `<div class="text-xs mt-1" style="color:var(--warning)">🔒 ${e(m.requirements)}</div>` : ''}
              </button>`;
          }).join('')}
          <button type="button" class="difficulty-option ${challengeSel === '' ? 'selected' : ''}" data-challenge="">
            <div class="difficulty-name">🎯 Normal</div>
            <div class="text-xs text-muted mt-2">Sem modificações — experiência padrão.</div>
          </button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Resumo</label>
        <div class="char-create-summary">${summary}</div>
      </div>`;
  }

  _charCreateSummaryChips(draft, ctx) {
    const wc = App.CHAR_CREATE_WEIGHT_LABELS[draft.weightClass] || draft.weightClass;
    const arch = ARCHETYPES[draft.archetype]?.label || draft.archetype;
    const origin = ORIGINS[draft.origin]?.label || draft.origin;
    const academy = ctx.academies.find(a => a.id === draft.academyId)?.name || '—';
    const manager = ctx.managers.find(m => m.id === draft.managerId)?.name || '—';
    const diff = DIFFICULTIES.find(d => d.id === draft.difficultyId)?.name || draft.difficultyId;
    const challenge = draft.challengeMode
      ? (CHALLENGE_MODES[draft.challengeMode]?.name || draft.challengeMode)
      : 'Normal';
    const chips = [
      draft.name || '(sem nome)',
      wc,
      arch,
      origin,
      academy,
      manager,
      diff,
      challenge,
    ];
    return chips.map(c => `<span class="char-create-chip">${e(String(c))}</span>`).join('');
  }

  _bindCharCreateStepControls(modal, session, ctx) {
    const body = modal.querySelector('#charCreateBody');
    if (!body) return;

    // Delegation: um listener por mount do body (nodes recriados a cada step)
    body.onclick = (ev) => {
      const opt = ev.target.closest(
        '[data-archetype],[data-origin],[data-difficulty],[data-academy],[data-manager],[data-challenge]'
      );
      if (!opt || opt.disabled || !body.contains(opt)) return;

      const attrs = ['archetype', 'origin', 'difficulty', 'academy', 'manager', 'challenge'];
      for (const attr of attrs) {
        if (opt.dataset[attr] === undefined) continue;
        body.querySelectorAll(`[data-${attr}]`).forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        const val = opt.dataset[attr];
        if (attr === 'archetype') session.draft.archetype = val;
        else if (attr === 'origin') session.draft.origin = val;
        else if (attr === 'difficulty') session.draft.difficultyId = val;
        else if (attr === 'academy') session.draft.academyId = val;
        else if (attr === 'manager') session.draft.managerId = val;
        else if (attr === 'challenge') session.draft.challengeMode = val || null;
        break;
      }
    };

    if (session.step === 1) {
      const nameEl = body.querySelector('#charName');
      const wcEl = body.querySelector('#charWeightClass');
      nameEl?.addEventListener('input', () => {
        session.draft.name = nameEl.value;
      });
      wcEl?.addEventListener('change', () => {
        session.draft.weightClass = wcEl.value;
      });

      const appearanceHost = body.querySelector('#charAppearance');
      if (appearanceHost) {
        appearanceHost.innerHTML = AppearanceEditor.render(session.draft.appearance);
        AppearanceEditor.wire(appearanceHost, session.draft.appearance, {
          context: {
            age: 22,
            popularity: 12,
            totalFights: 0,
            fightingStyle: ORIGINS[session.draft.origin]?.styleKey || session.draft.archetype,
          },
        });
      }

      // Foco no nome no primeiro passo
      queueMicrotask(() => nameEl?.focus());
    } else {
      queueMicrotask(() => {
        const first = body.querySelector('button:not([disabled]), input, select');
        first?.focus?.();
      });
    }
  }

  // ===== Tutorial guiado para novos jogadores =====
  // Coach-marks espaciais (TutorialCoach) em vez de modal solto — cada
  // parada aponta pro elemento real na tela, não só descreve em abstrato.
  async _showTutorial() {
    if (localStorage.getItem('tutorialDone')) return;

    await TutorialCoach.run([
      {
        selector: '.poster',
        title: '📊 Seu cartaz de luta',
        text: 'Aqui fica o resumo da sua carreira: próxima luta marcada — ou, se não tiver nenhuma, as ofertas esperando resposta.',
      },
      {
        selector: '.nav-link[data-view="offers"]',
        title: '📩 Ofertas de Luta',
        text: 'Promoções te chamam aqui. Aceite as certas pra subir de tier e disputar cinturões.',
      },
      {
        selector: '.nav-link[data-view="training"]',
        title: '🏋️ Acampamento',
        text: 'Antes de cada luta, configure intensidade e foco do treino aqui — isso define seu desempenho no octógono.',
      },
      {
        selector: '#weekAdvanceBtn',
        title: '⏩ Avançar Semana',
        text: 'Cada clique processa uma semana inteira: treino, ofertas, eventos e notícias do mundo do MMA.',
      },
    ]);

    localStorage.setItem('tutorialDone', '1');
  }

  async navigateTo(view) {
    this.previousView = this.currentView;
    this.currentView = view;

    try {
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
        case 'settings':
          await this.renderSettings();
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
    } catch (err) {
      // Sem isto, qualquer exceção num render (dado inesperado num save
      // antigo, campo ausente) travava a SPA na tela anterior sem aviso —
      // clique não fazia nada, sem pista de que algo quebrou. Agora sempre
      // sobra um caminho de volta.
      console.error(`Falha ao renderizar "${view}":`, err);
      document.getElementById('mainContent').innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:50vh;flex-direction:column;gap:1rem;text-align:center">
          <h2 style="color:var(--accent)">Esta tela não carregou</h2>
          <p style="color:var(--text-secondary);max-width:440px">
            Algo deu errado ao montar "${view}". Seu progresso está salvo — isto afeta só a exibição desta tela.
          </p>
          <button class="btn btn-primary" id="navErrorBackBtn">Voltar ao Dashboard</button>
        </div>`;
      document.getElementById('navErrorBackBtn')?.addEventListener('click', () => this.navigateTo('dashboard'));
    }
  }

  // ===== Dashboard =====
  // Dots vermelhos na sidebar — sinalizam conteúdo esperando ação sem o
  // jogador precisar entrar na página pra descobrir.
  async _updateNavBadges(pendingOffersCount) {
    const setDot = (view, show) => {
      const link = document.querySelector(`.nav-link[data-view="${view}"]`);
      if (!link) return;
      const existing = link.querySelector('.nav-dot');
      if (show && !existing) {
        const dot = document.createElement('span');
        dot.className = 'nav-dot';
        link.appendChild(dot);
      } else if (!show && existing) {
        existing.remove();
      }
    };
    setDot('offers', pendingOffersCount > 0);
    const unread = await this.notificationService.getUnreadCount();
    setDot('notifications', unread > 0);
  }

  async renderDashboard() {
    const data = await this.game.getDashboard();
    const monetization = await this.monetizationService.getState();
    data.eliteFrame = monetization.equipped.posterFrame === 'cos-elite-frame';

    // Retrato do oponente no CTA de oferta precisa do LUTADOR COMPLETO —
    // uma projeção {id, name} derivava outra cara (idade/estilo/cartel
    // entram no viés visual), e o mesmo oponente aparecia diferente aqui
    // e no perfil dele.
    const bestOffer = [...(data.pendingOffers || [])].sort((a, b) => (b.purse || 0) - (a.purse || 0))[0];
    data.bestOfferOpponent = bestOffer?.opponentId
      ? await this.game.fighterCtrl.getFighter(bestOffer.opponentId).catch(() => null)
      : null;

    // Fase 2 — feed "Últimos Acontecimentos": os capítulos recentes da
    // carreira (career log, mais novo primeiro) logo abaixo do pôster.
    data.recentHappenings = data.fighter
      ? await this.game.careerLogService.timelineForFighter(data.fighter.id, { limit: 6, newestFirst: true })
      : [];

    const weekLabel = absWeekToLabel(data.now);
    const html = DashboardView.render(data, weekLabel);
    await LayoutView.render(html);

    this.initThreeArena();
    this._updateNavBadges(data.pendingOffers?.length || 0);

    document.getElementById('weekAdvanceBtn')?.addEventListener('click', () => this.advanceWeek());
    document.getElementById('saveLoadBtn')?.addEventListener('click', () => this.handleSaveLoad());
    document.getElementById('simulatePeriodBtn')?.addEventListener('click', () => this.openSimulatePeriod());

    document.querySelector('[data-onboarding-dismiss]')?.addEventListener('click', async () => {
      await this.game.dismissOnboarding();
      this.renderDashboard();
    });

    document.querySelector('[data-onboarding-spotlight]')?.addEventListener('click', (e) => {
      const spot = ONBOARDING_SPOTLIGHT[e.currentTarget.dataset.onboardingSpotlight];
      if (spot) TutorialCoach.spotlightOnce(spot.selector, spot);
    });

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

    document.querySelectorAll('.weekly-activity-set').forEach(btn => {
      btn.addEventListener('click', async () => {
        await this.game.setWeeklyActivity(btn.dataset.activity);
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

    // P2.2: Escolha de reabilitação de lesão
    document.querySelectorAll('[data-rehab-choice]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const result = await this.game.resolveRehabChoice(btn.dataset.rehabChoice);
        if (result.ok) {
          this.notificationService.add('info', 'Reabilitação',
            result.choice === 'fast'
              ? `Fisioterapia rápida contratada por $${result.cost}. Recuperação em ${result.rehabWeeks} semanas.`
              : `Fisioterapia gratuita iniciada. Recuperação em ${result.rehabWeeks} semanas.`);
        } else {
          this.notificationService.add('warning', 'Reabilitação', result.reason);
        }
        this.renderDashboard();
      });
    });

    // Rivalidade — escolha do prompt semanal
    document.querySelectorAll('.rivalry-choice').forEach(btn => {
      btn.addEventListener('click', async () => {
        await this.game.resolveRivalryInteraction(btn.dataset.choice);
        this.renderDashboard();
      });
    });

    // Evento narrativo — escolha do jogador
    document.querySelectorAll('.narrative-choice').forEach(btn => {
      btn.addEventListener('click', async () => {
        const result = await this.game.resolveNarrativeChoice(btn.dataset.narrativeChoice);
        if (result.ok) {
          this.notificationService.add('info', '📰 Decisão', result.choice);
        } else {
          this.notificationService.add('warning', 'Evento Narrativo', result.reason);
        }
        this.renderDashboard();
      });
    });

    // P5.3: Fim de carreira — escolha do Último Capítulo
    document.querySelectorAll('.end-career-choice').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fighterId = data.fighter?.id;
        if (!fighterId) return;
        const result = await this.game.resolveEndCareer(fighterId, btn.dataset.endCareer);
        if (result.ok) {
          const choiceLabel = btn.querySelector('.font-bold')?.textContent || result.choice;
          this.notificationService.add('info', '🕊️ Último Capítulo', `Você escolheu: ${choiceLabel}`);
        } else {
          this.notificationService.add('warning', 'Fim de Carreira', result.reason || 'Erro ao processar escolha.');
        }
        this.renderDashboard();
      });
    });

    // Fase 1: Weekly training micro-decision modal
    if (data.weeklyTrainingPrompt?.active) {
      this._showWeeklyTrainingModal(data.fighter);
    }

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
      // WebGL pode falhar em hardware/driver incomum (VM, GPU sem suporte,
      // contexto perdido) — o octógono 3D é decorativo, uma falha aqui não
      // pode derrubar o resto da tela nem sujar o console com erro não
      // tratado.
      try {
        this.threeArena = new ThreeArena('octagonArena');
      } catch (err) {
        console.warn('ThreeArena falhou ao iniciar (WebGL indisponível?):', err);
      }
      motion.refresh();
    });
  }

  // ===== Tick semanal: o coração do jogo =====
  async advanceWeek() {
    const btn = document.getElementById('weekAdvanceBtn');
    if (btn) btn.disabled = true;
    AudioService.play('whoosh');

    try {
      await this._advanceWeekInner();
    } catch (err) {
      // A ação mais executada do jogo inteiro, sem nenhuma rede de segurança
      // antes disto: qualquer exceção em processWeek() (bug de dado após
      // meses de carreira acumulada, edge case em qualquer um dos ~1600
      // linhas de world-service) deixava o botão desabilitado pra sempre,
      // sem aviso — único jeito de sair era recarregar a página.
      console.error('Falha ao avançar semana:', err);
      const retryBtn = document.getElementById('weekAdvanceBtn');
      if (retryBtn) retryBtn.disabled = false;
      await this.notificationService.add(
        'danger',
        'Falha ao avançar semana',
        'Algo deu errado processando a semana. Seu progresso da semana anterior está salvo — tente novamente.'
      );
    }
  }

  async _advanceWeekInner() {
    // Live player fights run inside processWeek via prepareCardFight: WorldService
    // awaits CombatAdapter.runFight(interactive=true) before finishing the week.
    // Passing any non-null cornerHooks object is the signal that this is the
    // interactive path (simulateWeeks passes null → AI plays both sides).
    const cornerHooks = {
      prepareCardFight: async ({ fighter, opponent, promo }) => {
        const intro = EventsView.renderCornerFightIntro(fighter, opponent, promo.name);
        await LayoutView.render(intro);
        await new Promise(r => setTimeout(r, 800));
        await LayoutView.render('<div id="fight-container" class="card-fight-host"></div>');
        return document.getElementById('fight-container');
      },
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

    const featured = world.playerEvents[0];
    if (featured) {
      const playerResult = featured.playerResults?.[0];
      if (playerResult) {
        const fA = await this.game.fighterCtrl.getFighter(playerResult.fighterAId);
        const fB = await this.game.fighterCtrl.getFighter(playerResult.fighterBId);
        if (fA && fB) {
          // Torcida da noite — gravada no settle da luta
          try {
            const cr = await this.game.db.get('gameState', 'crowdReaction');
            if (cr?.reaction?.chant) playerResult._crowdChant = cr.reaction.chant;
          } catch { /* ok */ }
          const html = LiveFightHubView.render(fA, fB, playerResult);
          await LayoutView.render(html);
          // Cinemática de marco: agendada aqui, disparada quando o resumo
          // final do live hub aparece (finish() em _playLiveHub).
          this._pendingCinematic = null;
          this._lastFightWon = playerResult.isDraw ? null : !!playerResult._won;
          if (playerResult._won && playerResult.isTitleFight) {
            const id = playerResult.titleRetained
              ? 'TitleDefense'
              : (featured.event?.tier === 1 ? 'WorldChampion' : 'BeltWin');
            this._pendingCinematic = {
              id,
              text: {
                title: fA.name,
                subtitle: `${fA.record.wins}-${fA.record.losses}-${fA.record.draws}`,
              },
            };
          }
          this._playLiveHub(featured.results, featured.playerFighterIds, fA, fB);
          document.getElementById('hubBackBtn')?.addEventListener('click', () => this.renderDashboard());
          document.getElementById('shareFightBtn')?.addEventListener('click', () => {
            const fText = `${playerResult._won ? '🏆' : '😔'} ${e(fA.name)} ${playerResult._won ? 'venceu' : 'perdeu'} por ${e(playerResult.method)} no R${playerResult.round}!`;
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
              <button class="btn btn-sm btn-secondary sim-focus-option" data-focus="${key}">${meta.icon} ${e(meta.label)}</button>
            `).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Duração</label>
          <div class="difficulty-grid" style="grid-template-columns:repeat(2,1fr)">
            ${SIMULATE_PERIOD_PRESETS.map(p => `
              <button type="button" class="difficulty-option" data-weeks="${p.weeks}">
                <div class="difficulty-name">${e(p.label)}</div>
                <div class="difficulty-cash">${p.weeks} semanas</div>
              </button>
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
        LayoutView.closeModal(modal);
        await this.runSimulatePeriod(weeks, selectedFocus || null);
      });
    });
  }

  async runSimulatePeriod(weeks, trainingFocus) {
    // Mesmo componente de espera do boot (index.html) — antes esta tela usava
    // .empty-state (uma caixa tracejada de "nada aqui"), a linguagem visual
    // errada pra "algo está processando". simulateWeeks(60) já levou ~5-10s
    // nos testes; sem o spinner girando, alguns segundos de tela parada
    // parecem trava, não trabalho em andamento.
    await LayoutView.render(`
      <div class="page-header">
        <h2>Simulando...</h2>
        <p>Avançando ${weeks} semanas na sua carreira</p>
      </div>
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>O tempo está passando — isso pode levar alguns segundos.</p>
      </div>
      ${AdService.renderSlot('simulate-period', 'simulateAdSlot')}
    `, false);
    AdService.mount('simulateAdSlot');

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

    // Prontidão (item 4): a MESMA conta que a simulação usa na noite da
    // luta, mostrada antes — cada tela ignorada vira pontos faltando aqui.
    // A prontidão do adversário só aparece com scouting nível 1+.
    const readiness = {};
    for (const o of accepted) {
      const level = dossiers[o.id]?.level ?? 0;
      const player = ReadinessService.playerReadiness(fighter, o, level);
      const opponent = ReadinessService.aiReadiness(o.tier, !!o.isTitleFight, `${o.id}-${o.opponentId}`);
      readiness[o.id] = {
        player: player.total,
        parts: player.parts,
        opponentKnown: level >= 1,
        opponent: level >= 1 ? opponent : null,
        opponentLabel: level >= 1 ? ReadinessService.label(opponent) : null,
      };
    }

    // §Fase 3b — o dilema. Uma oferta contra um companheiro de treino não é uma
    // oferta como as outras, e o jogador precisa saber ANTES de aceitar.
    const teammates = {};
    for (const o of pending) {
      const t = await this.game.partnersService.isTeammate(fighter, o.opponentId);
      if (t) teammates[o.id] = t;
    }

    // Rivalidade ativa contra este adversário — o efeito na leitura/bolsa já
    // existe por baixo dos panos (RivalryService/WorldService); isto só o
    // torna visível ANTES de aceitar a luta.
    const rivalries = {};
    for (const o of [...pending, ...accepted]) {
      const r = await this.game.rivalryService.getRivalryBetween(fighter.id, o.opponentId);
      if (r) rivalries[o.id] = { intensity: r.intensity, label: r.intensityLabel };
    }

    const contractProposals = await this._loadContractProposals(fighter);

    // Lutadores COMPLETOS dos oponentes — retrato consistente com o perfil
    // (projeção {id, name} derivaria outra cara; ver comentário no
    // renderDashboard).
    const opponents = {};
    for (const o of [...pending, ...accepted]) {
      if (o.opponentId && !(o.opponentId in opponents)) {
        opponents[o.opponentId] = await this.game.fighterCtrl.getFighter(o.opponentId).catch(() => null);
      }
    }

    // Fase 1 — "O que está em jogo": enquadra cada oferta pendente em
    // RECOMPENSA/RISCO/CONSEQUÊNCIA. O salto/recuo no ranking usa a posição
    // divisional real (uma leitura de todos os lutadores por render).
    const stakes = {};
    if (pending.length > 0) {
      const activeDivision = (await this.game.fighterCtrl.getAllFighters())
        .filter(f => f.status !== 'retired' && f.weightClass === fighter.weightClass);
      const divRankings = RankingService.calculateRankings(activeDivision);
      const rankOf = (id) => divRankings.find(r => r.fighter.id === id)?.rank ?? null;
      for (const o of pending) {
        stakes[o.id] = computeFightStakes(fighter, o, {
          playerRank: rankOf(fighter.id),
          oppRank: rankOf(o.opponentId),
          divisionSize: divRankings.length,
        });
      }
    }

    const html = OffersView.render(pending, accepted, history, fighter, now, dossiers, contractProposals, teammates, rivalries, readiness, opponents, stakes);
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
      `<li><strong>${b.weightClass}</strong> · ${e(b.promotionName)}</li>`
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
      LayoutView.closeModal(modal);
      const result = await this.game.signContractWithVacate(fighterId, promoId, now);
      if (result.fighter) {
        this.notificationService.add('success', 'Contrato Assinado!',
          `${e(result.fighter.name)} abdicou do${isPlural ? 's' : ''} cintur\u00E3o${isPlural ? '\u00F5es' : ''} e agora \u00E9 exclusivo do ${promoName}.`);
      }
      this.renderOffers();
    });

    modal.querySelector('#conflictPostpone').addEventListener('click', async () => {
      LayoutView.closeModal(modal);
      await this.game.contractService.postpone(fighterId);
      this.notificationService.add('info', 'Decis\u00E3o Adiada',
        `A proposta do ${promoName} foi mantida. Voc\u00EA pode aceit\u00E1-la quando estiver pronto.`);
      this.renderOffers();
    });

    modal.querySelector('#conflictCancel').addEventListener('click', () => {
      LayoutView.closeModal(modal);
    });
  }

  // Fase 1: Modal de microdecisão de treino semanal
  _showWeeklyTrainingModal(fighter) {
    const existing = document.getElementById('weeklyTrainingModal');
    if (existing) return;

    const choices = WeeklyTrainingController.getChoices(fighter);
    const choiceCards = choices.map(c => `
      <button type="button" class="card weekly-training-card" data-choice="${c.key}" style="cursor:pointer;padding:1rem;transition:border-color 0.15s;width:100%;text-align:left;font:inherit;color:inherit">
        <h4 style="margin:0 0 0.25rem 0;color:var(--accent)">${e(c.label)}</h4>
        <p class="text-sm" style="color:var(--text-secondary);margin:0 0 0.5rem 0">${e(c.description)}</p>
        <div class="text-xs" style="color:var(--text-muted)">
          ${c.fatigueGain > 0 ? `+${c.fatigueGain} fadiga` : c.fatigueGain < 0 ? `${c.fatigueGain} fadiga` : ''}
          ${c.moraleEffect !== 0 ? ` · ${c.moraleEffect > 0 ? '+' : ''}${c.moraleEffect} moral` : ''}
          ${c.bondBoost ? ' · +vínculo' : ''}
          · ${Math.round(c.injuryRisk * 100)}% lesão
        </div>
      </button>
    `).join('');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'weeklyTrainingModal';
    modal.innerHTML = `
      <div class="modal" style="max-width:560px">
        <div class="modal-header">
          <h3>🏋️ Foco do Treino da Semana</h3>
          <button class="modal-close" data-close="weeklyTrainingModal">&times;</button>
        </div>
        <p class="text-sm" style="color:var(--text-secondary);margin-bottom:1rem">
          Sem luta marcada esta semana — você pode escolher um foco especial para o treino.
          Cada opção tem um perfil diferente de risco e recompensa.
        </p>
        <div style="display:flex;flex-direction:column;gap:0.75rem" id="weeklyTrainingChoices">
          ${choiceCards}
        </div>
        <div class="modal-actions" style="margin-top:1rem">
          <button class="btn btn-sm btn-secondary w-full dismiss-training-modal">Agora não</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#weeklyTrainingChoices').addEventListener('click', async (e) => {
      const card = e.target.closest('[data-choice]');
      if (!card) return;

      const choiceKey = card.dataset.choice;
      modal.querySelectorAll('.weekly-training-card').forEach(c => c.style.borderColor = '');
      card.style.borderColor = 'var(--accent)';

      const result = await this.game.resolveWeeklyTraining(choiceKey);
      if (result.ok) {
        const parts = [];
        const gainLabels = Object.entries(result.gains).map(([attr, val]) => `${attr}+${val}`);
        if (gainLabels.length > 0) parts.push(`Ganhos: ${gainLabels.join(', ')}`);
        if (result.fatigueDelta > 0) parts.push(`Fadiga +${result.fatigueDelta}`);
        else if (result.fatigueDelta < 0) parts.push(`Fadiga ${result.fatigueDelta}`);
        if (result.moraleDelta !== 0) parts.push(`Moral ${result.moraleDelta > 0 ? '+' : ''}${result.moraleDelta}`);
        if (result.injured) parts.push('Você se lesionou!');
        if (result.bondGains?.length > 0) {
          parts.push(`Vínculo com ${result.bondGains[0].partnerName} aumentou`);
        }
        this.notificationService.add('info', '🏋️ Treino Semanal', parts.join(' · ') || 'Sessão concluída.');
      } else {
        this.notificationService.add('warning', 'Treino Semanal', result.reason);
      }

      LayoutView.closeModal(modal);
      this.renderDashboard();
    });

    modal.querySelector('.dismiss-training-modal').addEventListener('click', () => {
      LayoutView.closeModal(modal);
    });

    modal.querySelector('[data-close="weeklyTrainingModal"]').addEventListener('click', () => {
      LayoutView.closeModal(modal);
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
      card.setAttribute('aria-expanded', 'false');
      this._makeClickable(card).addEventListener('click', () => {
        const target = document.getElementById(card.dataset.expand);
        if (!target) return;
        const willShow = target.style.display === 'none';
        target.style.display = willShow ? 'block' : 'none';
        card.setAttribute('aria-expanded', String(willShow));
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
    const monetizationPromise = this.monetizationService.getState();

    const faceOff = document.getElementById('hubFaceOff');
    let threeFaceOff = null;
    try {
      import('./three-faceoff.js').then(mod => {
        if (!cancelled && faceOff) {
          threeFaceOff = new mod.ThreeFaceOff('hubFaceOff', fighterA, fighterB);
        }
      }).catch(() => {});
    } catch {}

    const finish = async () => {
      cancelled = true;
      tl.kill();
      tl = gsap.timeline();

      rounds.forEach(r => r.style.display = 'block');
      rounds.forEach(r => {
        r.querySelectorAll('.live-beat').forEach(b => b.style.display = 'flex');
      });

      if (statusText) statusText.textContent = 'Luta encerrada';
      if (skipBtn) skipBtn.style.display = 'none';

      const won = this._lastFightWon;

      // Marco de título? Toca a cinemática por cima do resumo — o resumo já
      // está montado embaixo quando ela termina ou é pulada. O sting de
      // vitória/derrota só toca quando NÃO há cinemática (que tem seu
      // próprio som de impacto).
      if (this._pendingCinematic) {
        const c = this._pendingCinematic;
        this._pendingCinematic = null;
        CinematicService.play(c.id, c.text);
      } else if (won === true) {
        AudioService.play('success');
      } else if (won === false) {
        AudioService.play('fail');
      }
      this._lastFightWon = undefined;

      if (summary) {
        summary.style.display = 'block';
        tl.to('#hubResultIcon', { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 0)
          .to('#hubResultText', { opacity: 1, y: 0, duration: 0.3 }, '-=0.2')
          .to('#hubResultMethod', { opacity: 1, duration: 0.3 }, '-=0.15')
          .to('#hubScorecards', { opacity: 1, duration: 0.3 }, '-=0.1')
          .to('#hubPurseDisplay', { opacity: 1, y: 0, duration: 0.3 }, '-=0.05')
          .to('#hubDamageWarning', { opacity: 1, duration: 0.3 }, '-=0.05')
          .to('#hubActions', { opacity: 1, y: 0, duration: 0.3 }, '-=0.05')
          .to('#hubAdSlot', { opacity: 1, duration: 0.3 }, '-=0.05');
        AdService.mount('hubAdSlotInner');

        // Cosmético de apoiador (js/services/monetization-service.js) —
        // puramente decorativo, só dispara em vitória.
        if (won === true) {
          const monetization = await monetizationPromise;
          if (monetization.equipped.winEffect === 'cos-confetti') {
            this._fireConfetti(summary);
          }
        }
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
        AudioService.play('thud');
        gsap.to(faceOff || document.getElementById('liveHubRounds'), {
          x: '+=6', duration: 0.04, repeat: 4, yoyo: true, ease: 'power1.inOut',
        });
        if (threeFaceOff?.onKnockdown) threeFaceOff.onKnockdown();
      } else if (beatType === 'finish') {
        AudioService.play('thud');
        AudioService.play('bell');
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
        AudioService.play('bell');
        rounds[0].style.display = 'block';
        if (statusText) statusText.textContent = `Round 1 de ${rounds.length}`;
      }
    });

    skipBtn?.addEventListener('click', finish);

    gsap.delayedCall(1.2, showBeat);
  }

  // Cosmético "Confete na Vitória" (COSMETIC_ITEMS, game-config.js) — puramente
  // decorativo. Peças em position:fixed ancoradas no card de resultado, não
  // no fluxo do documento, pra nunca empurrar layout.
  _fireConfetti(anchorEl) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = anchorEl.getBoundingClientRect();
    const colors = ['#f3efe9', '#c9a227', '#8e857c', '#ef5f6b'];

    for (let i = 0; i < 28; i++) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      piece.style.background = colors[i % colors.length];
      piece.style.top = `${rect.top}px`;
      piece.style.left = `${rect.left + Math.random() * rect.width}px`;
      document.body.appendChild(piece);

      gsap.fromTo(piece,
        { y: -10, opacity: 1, rotate: 0 },
        {
          y: 200 + Math.random() * 100,
          x: (Math.random() - 0.5) * 180,
          rotate: Math.random() * 540 - 270,
          opacity: 0,
          duration: 1.3 + Math.random() * 0.6,
          ease: 'power1.in',
          onComplete: () => piece.remove(),
        }
      );
    }
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

    // Biografia viva — só pro jogador: careerLog + rival mais quente.
    let profileCtx = {};
    if (isPlayer && this.game.careerLogService) {
      const [topMoments, recentMoments, gameState] = await Promise.all([
        this.game.careerLogService.topByMagnitude(fighter.id, 6),
        this.game.careerLogService.timelineForFighter(fighter.id, { limit: 30 }),
        this.game.db.get('gameState', 'state'),
      ]);
      let rivalryInfo = null;
      if (this.rivalryService) {
        const rivalries = await this.rivalryService.getRivalries(fighter.id);
        if (rivalries.length > 0) {
          const top = rivalries.reduce((a, b) => (b.intensity > a.intensity ? b : a));
          const otherId = top.fighterAId === fighter.id ? top.fighterBId : top.fighterAId;
          const fromFights = fighter.fights.find(f => f.opponentId === otherId)?.opponent;
          const otherFighter = fromFights ? null : await this.game.fighterCtrl.getFighter(otherId);
          rivalryInfo = { rivalry: top, opponentName: fromFights || otherFighter?.name || 'Adversário desconhecido' };
        }
      }
      profileCtx = { topMoments, recentMoments, careerStartedAt: gameState?.startedAt || null, rivalryInfo };
    }

    const html = FighterProfileView.render(fighter, fighter.fights, isPlayer, profileCtx);
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

        if ((f.loyalty || 0) < 40) {
          this.notificationService.add('warning', 'Mudança de Peso', 'Sua lealdade com a academia é muito baixa para mudar de peso.');
          return;
        }

        const result = await this.game.changeWeightClass(fId, newWeightClass);
        if (!result.ok) {
          this.notificationService.add('warning', 'Mudança de Peso', result.reason);
          return;
        }

        this.showFighterProfile(fighterId);
      });
    });

    document.querySelectorAll('.fighter-rename').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fId = btn.dataset.id;
        const f = await this.game.fighterCtrl.getFighter(fId);
        if (!f) return;

        const raw = prompt('Novo nome do lutador:', f.name);
        if (raw == null) return;
        const newName = sanitizePlayerName(raw, { fallback: '' });
        if (!newName) {
          this.notificationService.add('warning', 'Renomear', 'Nome inválido. Use letras e números, sem HTML.');
          return;
        }

        f.name = newName;
        await this.game.fighterCtrl.updateFighter(f);
        this.notificationService.add('success', 'Renomear', `Lutador renomeado para ${newName}.`);
        this.showFighterProfile(fighterId);
      });
    });

    // Edição de aparência pós-criação — mesmo editor da criação de
    // personagem (AppearanceEditor, uma fonte só). Salvar persiste no
    // fighter; cancelar não toca em nada.
    document.querySelectorAll('.fighter-equip-unlock').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fId = btn.dataset.id;
        const unlockId = btn.dataset.unlock;
        const f = await this.game.fighterCtrl.getFighter(fId);
        if (!f || !unlockId) return;
        VisualIdentityService.syncUnlocks(f);
        const base = f.appearance
          ? { ...f.appearance }
          : VisualIdentityService.resolveBaseAppearance(f);
        f.appearance = VisualIdentityService.applyUnlockPatch(base, unlockId);
        f.visualLock = true; // equip manual = look intencional
        await this.game.fighterCtrl.updateFighter(f);
        this.notificationService.add('success', 'Visual', 'Look equipado no retrato.');
        this.showFighterProfile(fId);
      });
    });

    document.querySelectorAll('.fighter-imagine-export').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fId = btn.dataset.id;
        const f = await this.game.fighterCtrl.getFighter(fId);
        if (!f) return;
        const eras = VisualIdentityService.buildEraImaginePrompts(f);
        const identity = VisualIdentityService.describeIdentity(f);
        const text = [
          `# Concept art — ${f.name}`,
          `Arquétipo: ${identity.archetypeLabel} | Era: ${identity.stageLabel}`,
          '',
          ...eras.map(e => `## ${e.label}\n${e.prompt}\n`),
          '---',
          'Uso: cole no Grok Imagine / gerador de concept art (offline). Não roda no jogo.',
        ].join('\n');
        try {
          await navigator.clipboard.writeText(text);
          this.notificationService.add('success', 'Concept art', 'Prompts de 4 eras copiados para a área de transferência.');
        } catch {
          // Fallback download
          const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `concept-${(f.name || 'fighter').replace(/\s+/g, '-').toLowerCase()}.txt`;
          a.click();
          URL.revokeObjectURL(a.href);
          this.notificationService.add('success', 'Concept art', 'Arquivo de prompts baixado.');
        }
      });
    });

    document.querySelectorAll('.fighter-edit-appearance').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fId = btn.dataset.id;
        const f = await this.game.fighterCtrl.getFighter(fId);
        if (!f) return;

        const state = { ...PortraitService.appearanceFor(f) };
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'appearanceEditModal';
        modal.innerHTML = `
          <div class="modal" style="max-width:560px">
            <div class="modal-header">
              <h3>Editar Aparência</h3>
              <button class="modal-close" data-close="appearanceEditModal">&times;</button>
            </div>
            <div id="appearanceEditHost">${AppearanceEditor.render(state, { fighter: f })}</div>
            <div class="modal-actions">
              <button class="btn btn-secondary" data-close="appearanceEditModal">Cancelar</button>
              <button class="btn btn-primary" id="appearanceSaveBtn">Salvar</button>
            </div>
          </div>`;
        document.body.appendChild(modal);
        AppearanceEditor.wire(modal.querySelector('#appearanceEditHost'), state, {
          fighter: f,
          context: {
            age: f.age,
            fightingStyle: f.style || f.fightingStyle,
            popularity: f.popularity,
            totalFights: f.totalFights,
          },
        });

        modal.querySelector('#appearanceSaveBtn').addEventListener('click', async () => {
          f.appearance = { ...state };
          f.visualLock = true; // edição manual trava blend automático
          await this.game.fighterCtrl.updateFighter(f);
          LayoutView.closeModal(modal);
          this.showFighterProfile(fId);
        });
      });
    });

    // Aposentadoria voluntária — a única saída que existia antes era o
    // prompt automático por idade/janela, que pode nunca disparar. Sem
    // isto, uma carreira que o jogador queira encerrar não tinha fim.
    document.querySelectorAll('.fighter-retire').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fId = btn.dataset.id;
        const confirmed = confirm(`Tem certeza que quer aposentar ${e(fighter.name)}? Esta ação não pode ser desfeita — a carreira atual termina aqui.`);
        if (!confirmed) return;

        await this.game.resolveEndCareer(fId, 'dignified');
        this.notificationService.add('success', '👑 Aposentadoria Digna', `${e(fighter.name)} pendurou as luvas.`);
        this.navigateTo('retirement');
      });
    });

    // Task 10: perks teia — aprender perks no perfil
    // Gap #1: equipar/remover golpes
    // Gap #2: troca de estilo
    FighterProfileView.bindEvents(fighter, {
      onPerkLearned: async () => {
        await this.game.fighterCtrl.updateFighter(fighter);
        this.showFighterProfile(fighter.id);
      },
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
    // Task 9 — as até 3 cartas que esta academia oferece pra descoberta,
    // resolvidas a partir de `specialties` e filtradas pelo que o lutador já
    // tem (`fighter.cardPool`) pra nunca oferecer uma carta repetida. Mesmo
    // padrão de weaponOptions acima: computa aqui (onde a Academy de verdade
    // já foi carregada) e passa pronto pra view, que não conhece Academy nem
    // TrainingCamp. Pool esgotado (5/5 já adquiridas) devolve `[]`, e a view
    // já esconde o bloco e a opção 'card_discovery' do select nesse caso.
    const cardOptions = TrainingCamp.getCardDiscoveryOptions(academy, fighter);
    const team = await this.game.partnersService.getTeammates(fighter);
    const html = TrainingCampView.render(fighter, booking, now, weaponOptions, team, cardOptions);
    await LayoutView.render(html);
    this._bindTrainingCamp(fighter, booking, now);
  }

  _bindTrainingCamp(fighter, booking, now) {
    // O bloco da arma só faz sentido quando o foco é instalá-la — mostrar as
    // opções de arma num camp de cardio seria oferecer uma decisão que não
    // existe.
    const specSelect = document.querySelector(`.camp-spec[data-fighter="${fighter.id}"]`);
    const weaponBlock = document.querySelector('[data-weapon-block]');
    // Task 9 — mesmo toggle do bloco de arma, pro bloco de descoberta de carta.
    const cardBlock = document.querySelector('[data-card-block]');
    specSelect?.addEventListener('change', () => {
      if (weaponBlock) weaponBlock.style.display = specSelect.value === 'install_weapon' ? '' : 'none';
      if (cardBlock) cardBlock.style.display = specSelect.value === 'card_discovery' ? '' : 'none';
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
        // Task 9 — mesmo padrão de weaponTarget: só lido/enviado quando o
        // foco selecionado é 'card_discovery'.
        const cardFocus = spec === 'card_discovery'
          ? document.querySelector(`.camp-card-target[data-fighter="${fighter.id}"]`)?.value || null
          : null;
        const partnerId = document.querySelector(`.camp-partner[data-fighter="${fighter.id}"]`)?.value || null;
        const profFocus = document.querySelector('#camp-proficiency-focus')?.value || null;

        TrainingCamp.configureCamp(fighter, intensity, spec || 'striking', partnerId, weaponTarget, profFocus, cardFocus);
        OnboardingService.markCampConfigured(fighter);
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

    document.querySelectorAll('.toggle-service').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fighter = await this.game.getPlayerFighter();
        const key = btn.dataset.service;
        if (!fighter.hiredServices) fighter.hiredServices = [];
        const idx = fighter.hiredServices.indexOf(key);
        if (idx >= 0) {
          fighter.hiredServices.splice(idx, 1);
        } else {
          fighter.hiredServices.push(key);
        }
        await this.game.fighterCtrl.updateFighter(fighter);
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
          this.notificationService.add('success', 'Academia Trocada', `Agora você treina em ${e(result.academy.name)}.`);
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
          this.notificationService.add('success', 'Novo Empresário', `${e(result.manager.name)} agora cuida da sua carreira.`);
        } else {
          this.notificationService.add('warning', 'Contratação Falhou', result.reason);
        }
        this.renderAcademy();
      });
    });
  }

  // Cards clicáveis (stat-card, rank-row, belt-slot...) são <div>, não <a>/
  // <button> — sem isso, navegação inteira (perfil de lutador, detalhe de
  // evento) fica invisível pra teclado e leitor de tela. _makeClickable
  // devolve o mesmo elemento com role="button"/tabindex e Enter/Espaço
  // disparando o click, igual um botão de verdade dispararia.
  _makeClickable(el) {
    el.style.cursor = 'pointer';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    });
    return el;
  }

  _bindFighterClicks(selector = '[data-fighter-click]', dataAttr = 'fighterClick') {
    document.querySelectorAll(selector).forEach(el => {
      this._makeClickable(el).addEventListener('click', () => {
        const id = dataAttr === 'id' ? el.dataset.id : el.dataset.fighterClick;
        this.showFighterProfile(id);
      });
    });
  }

  _bindEventClicks() {
    document.querySelectorAll('[data-event-click]').forEach(el => {
      this._makeClickable(el).addEventListener('click', () => {
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
    let entries = await this.game.db.getAll('hallOfFame');

    // Limpeza de saves poluídos pelo forceInduct antigo, que induzia qualquer
    // aposentado do jogador sem checar critério nenhum. Reavalia cada verbete
    // pelos próprios números e remove quem nunca deveria ter entrado — a
    // cerimônia desses lutadores continua acessível via snapshot no gameState.
    const bogus = entries.filter(e => !HallOfFame.entryIsEligible(e));
    if (bogus.length > 0) {
      for (const e of bogus) await this.game.db.delete('hallOfFame', e.id);
      entries = entries.filter(e => HallOfFame.entryIsEligible(e));
    }

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

    // Snapshot da cerimônia (todo aposentado tem) tem prioridade; entrada do
    // Hall da Fama é fallback pra saves antigos, feitos antes do snapshot
    // existir. Aposentado sem currículo NÃO está mais no Hall — sem o
    // snapshot ele não teria cerimônia nenhuma.
    const ceremonySnapshot = gameState?.meta?.retirementCeremonyEntry;
    const entry = (ceremonySnapshot?.fighterId === fighterId ? ceremonySnapshot : null)
      || await this.game.db.get('hallOfFame', fighterId);
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

    // Cinemática de despedida — só na primeira visita desta sessão; revisitar
    // a página (ou navegar de volta do Hall) não repete o vídeo.
    this._retirementCinematicsShown ||= new Set();
    if (!this._retirementCinematicsShown.has(fighterId)) {
      this._retirementCinematicsShown.add(fighterId);
      CinematicService.play('Retirement', {
        title: entry.name,
        subtitle: `${entry.record.wins}-${entry.record.losses}-${entry.record.draws} · ${entry.careerStats?.titlesWon || 0} cinturão(ões)`,
      });
    }

    document.getElementById('viewFullCareerBtn')?.addEventListener('click', () => {
      this.navigateTo('hall-of-fame');
    });

    document.getElementById('backToHallBtn')?.addEventListener('click', () => {
      this.navigateTo('hall-of-fame');
    });

    // Sem isto, a carreira nunca tinha um jeito de recomeçar: career.
    // playerFighterId continuava apontando pro lutador aposentado pra
    // sempre, getPlayerFighter() nunca voltava null, e a criação de
    // personagem nunca era mostrada de novo. Limpa a identidade e reabre
    // o mesmo fluxo de criação — o mundo, promoções e Hall da Fama
    // continuam intactos.
    document.getElementById('startNewCareerBtn')?.addEventListener('click', async () => {
      await this.game.fighterCtrl.setPlayerFighterId(null);
      this._showCharacterCreation();
    });
  }

  // ===== Configurações =====
  async renderSettings() {
    const monetization = await this.monetizationService.getState();
    const player = await this.game.getPlayerFighter().catch(() => null);
    await LayoutView.render(SettingsView.render(monetization, player));

    const volume = document.getElementById('settingsVolume');
    const volumeLabel = document.getElementById('settingsVolumeLabel');
    volume?.addEventListener('input', () => {
      AudioService.setVolume(volume.value / 100);
      if (volumeLabel) volumeLabel.textContent = `${volume.value}%`;
    });
    volume?.addEventListener('change', () => AudioService.play('click'));

    const ambientToggle = document.getElementById('settingsAmbient');
    document.getElementById('settingsMute')?.addEventListener('change', (e) => {
      AudioService.setMuted(e.target.checked);
      if (volume) volume.disabled = e.target.checked;
      if (ambientToggle) ambientToggle.disabled = e.target.checked;
      if (!e.target.checked) AudioService.play('success');
    });

    ambientToggle?.addEventListener('change', (e) => {
      AudioService.setAmbientEnabled(e.target.checked);
    });

    document.getElementById('settingsTestSound')?.addEventListener('click', () => {
      AudioService.play('bell');
    });

    document.getElementById('settingsReduceMotion')?.addEventListener('change', (e) => {
      localStorage.setItem('reduceMotion', String(e.target.checked));
      // Lenis/ScrollTrigger já estão vivos com o estado antigo — recarregar
      // é o único jeito limpo de aplicar sem estados fantasmas.
      location.reload();
    });

    document.querySelectorAll('[data-set-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.setTheme;
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        this.renderSettings();
      });
    });

    document.getElementById('settingsVisualAutoEvolve')?.addEventListener('change', async (e) => {
      const f = await this.game.getPlayerFighter().catch(() => null);
      if (!f) return;
      f.visualAutoEvolve = !!e.target.checked;
      if (f.visualAutoEvolve) {
        f.visualLock = false;
        // Sync unlocks elegíveis agora (título/pop já conquistados)
        const { newly } = VisualIdentityService.syncUnlocks(f);
        const reward = VisualIdentityService.applyCareerVisualRewards(f, {
          preferUnlockIds: newly,
          forceEquip: false,
        });
        if (newly.length) {
          this.notificationService.add(
            'success',
            'Visual',
            `${newly.length} desbloqueio(s) sincronizado(s). O look pode evoluir daqui pra frente.`
          );
        } else {
          this.notificationService.add('info', 'Visual', 'Evolução automática ligada — conquistas futuras mudam o visual.');
        }
        if (reward.appearance) f.appearance = reward.appearance;
      } else {
        this.notificationService.add('info', 'Visual', 'Evolução automática desligada. Seu visual fica como está.');
      }
      await this.game.fighterCtrl.updateFighter(f);
    });

    document.getElementById('settingsSaveLoad')?.addEventListener('click', () => this.handleSaveLoad());

    document.getElementById('settingsExport')?.addEventListener('click', async () => {
      const json = await this.saveService.exportSave();
      const blob = new Blob([typeof json === 'string' ? json : JSON.stringify(json)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `mma-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      this.notificationService.add('success', 'Backup Exportado', 'Arquivo JSON baixado com o mundo inteiro.');
    });

    const importFile = document.getElementById('settingsImportFile');
    document.getElementById('settingsImport')?.addEventListener('click', () => importFile?.click());
    importFile?.addEventListener('change', async () => {
      const file = importFile.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        await this.saveService.importSave(text);
        this.notificationService.add('success', 'Backup Importado', 'Recarregando o mundo...');
        setTimeout(() => location.reload(), 800);
      } catch (err) {
        this.notificationService.add('warning', 'Importação Falhou', String(err?.message || err));
      }
    });

    document.querySelectorAll('[data-cosmetic-slot]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const result = await this.monetizationService.setEquipped(btn.dataset.cosmeticSlot, btn.dataset.cosmeticItem || null);
        if (!result.ok) this.notificationService.add('warning', 'Loja', result.reason);
        this.renderSettings();
      });
    });

    document.getElementById('supporterCodeRedeem')?.addEventListener('click', async () => {
      const input = document.getElementById('supporterCodeInput');
      const msg = document.getElementById('supporterCodeMsg');
      const result = await this.monetizationService.redeemSupporterCode(input?.value);
      if (result.ok) {
        this.notificationService.add('success', 'Obrigado por apoiar!', 'Todos os cosméticos foram desbloqueados.');
        this.renderSettings();
      } else if (msg) {
        msg.textContent = result.reason;
        msg.style.color = 'var(--red-ink)';
      }
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
        try {
          await this.saveService.saveSave(slot);
          this.notificationService.add('success', 'Save', `Jogo salvo no slot ${slot}!`);
        } catch (err) {
          this.notificationService.add('danger', 'Falha ao salvar', String(err.message || err));
        }
        this.handleSaveLoad();
      });
    });

    document.querySelectorAll('.slot-load-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const slot = parseInt(btn.dataset.slot, 10);
        try {
          await this.saveService.loadSave(slot);
          this.notificationService.add('success', 'Load', `Jogo carregado do slot ${slot}!`);
          window.location.reload();
        } catch (err) {
          this.notificationService.add('danger', 'Falha ao carregar', String(err.message || err));
          this.handleSaveLoad();
        }
      });
    });

    document.querySelectorAll('.slot-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const slot = parseInt(btn.dataset.slot, 10);
        try {
          await this.saveService.deleteSave(slot);
          this.notificationService.add('info', 'Delete', `Save do slot ${slot} deletado.`);
        } catch (err) {
          this.notificationService.add('danger', 'Falha ao deletar', String(err.message || err));
        }
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
                `A provocação na coletiva acirrou a rivalidade com ${e(fighterB.name)}! (Intensidade: ${e(rivalry.intensityLabel)})`);
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

  // ===== Combate por cartas — ponto de entrada standalone/dev (console).
  // O fluxo oficial da semana usa prepareCardFight → WorldService → CombatAdapter. =====
  async runCardFight(fighterA, fighterB, promo, gamePlanKey) {
    await LayoutView.render('<div id="fight-container" class="card-fight-host"></div>');
    const adapter = new CombatAdapter();
    adapter.setContainer(document.getElementById('fight-container'));
    const fiveRounds = promo?.tier === 1;
    return adapter.runFight(fighterA, fighterB, fiveRounds, gamePlanKey, promo?.tier ?? 3, false, true);
  }

  // Standalone meta-progression perks screen — same opt-in/dev-testing
  // spirit as runCardFight above: not called from anywhere else yet, not
  // wired into renderRetirementCeremony or any other live flow (see task-10
  // brief). `service` is passed on the internal re-render after an unlock
  // so we don't re-load() from IndexedDB and race unlockPerk's
  // fire-and-forget save().
  async renderPerksScreen(service = null) {
    if (!service) {
      service = new MetaProgressionService(this.game.db);
      await service.load();
    }

    const html = PerksScreenView.render({
      legacyPoints: service.legacyPoints,
      unlockedPerks: service.unlockedPerks,
    });
    await LayoutView.render(html);

    document.querySelectorAll('.perk-unlock-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const perkId = btn.dataset.perkId;
        const cost = parseInt(btn.dataset.perkCost, 10);
        service.unlockPerk(perkId, cost);
        await this.renderPerksScreen(service);
      });
    });
  }
}

const app = new App();
app.init();

window.app = app;
