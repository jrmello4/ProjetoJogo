import { formatCurrency, getWeightClassShort, getWeightClassName, escapeHtml, e } from '../utils/helpers.js';
import { FIGHTING_STYLES, INJURY_CONFIG, LEVEL_CONFIG, TIER_LABELS, TRAINING_FOCUS_META, TITLE_ROLE, WEEKLY_ACTIVITIES, END_CAREER_CHOICES } from '../config/game-config.js';
import { PodcastService } from '../services/podcast-service.js';
import { YearReviewService } from '../services/year-review-service.js';
import { CrowdService } from '../services/crowd-service.js';

const tierBadgeCls = (tier) => (tier === 1 ? 'badge-danger' : tier === 2 ? 'badge-warning' : 'badge-info');

// Só passos do onboarding com um alvo ESTÁVEL na tela ganham "Mostrar" —
// weighedIn só aparece via prompt na semana da pesagem, não tem elemento
// fixo pra apontar, então fica só com o texto de dica. Exportado pra
// app.js usar o mesmo mapa no handler de clique (uma fonte só).
export const ONBOARDING_SPOTLIGHT = {
  offerAccepted: { selector: '.nav-link[data-view="offers"]', title: '📩 Ofertas de Luta', text: 'Suas propostas aparecem aqui — toda semana livre, promoções te chamam.' },
  campConfigured: { selector: '.nav-link[data-view="training"]', title: '🏋️ Acampamento', text: 'Com luta marcada, escolha intensidade e foco do treino aqui.' },
  firstFight: { selector: '.nav-link[data-view="offers"]', title: '📩 Ofertas de Luta', text: 'Sua primeira luta nasce de uma oferta aceita aqui.' },
};

export class DashboardView {
  // ===== Signature: the fight poster =====
  // Your next booked bout, billed like the real thing. You're always the
  // red corner. With no fight on the books, the poster stays and the slot
  // sits empty — which is exactly the feeling we want you to fix.
  static _renderPoster(data, weekLabel) {
    const { fighter, pendingOffers, bookings, now } = data;
    const booking = bookings[0];

    const arena = `
      <div class="poster-arena" aria-hidden="true">
        <div class="arena-container" id="octagonArena"></div>
      </div>`;

    const status = `
      <header class="poster-status">
        <span class="poster-status-week">${weekLabel}</span>
        <span class="poster-status-gym">${e(fighter.name)} · ${getWeightClassShort(fighter.weightClass)}</span>
      </header>`;

    // Hierarquia: primário (avançar) > secundário (simular) > terciário
    // (salvar, só ícone) — três botões de mesmo peso deixavam o CTA sem foco.
    const actions = `
      <div class="poster-actions">
        <button class="btn btn-primary week-advance" id="weekAdvanceBtn">Avançar semana</button>
        <button class="btn btn-secondary" id="simulatePeriodBtn">Simular período</button>
        <button class="btn btn-secondary btn-only-icon save-load" id="saveLoadBtn" title="Salvar / carregar" aria-label="Salvar ou carregar jogo">💾</button>
      </div>`;

    if (!booking) {
      const waiting = pendingOffers.length;
      // Com oferta na mesa, o vazio vira call to action: a melhor proposta
      // (maior bolsa) ganha um card central com oponente, categoria, valores
      // e um botão com glow — o caminho pro jogador destravar é óbvio.
      const best = waiting > 0
        ? [...pendingOffers].sort((a, b) => (b.purse || 0) - (a.purse || 0))[0]
        : null;
      const offerCta = best ? `
        <div class="poster-offer" data-nav="offers" role="button" tabindex="0">
          ${best.isTitleFight ? `<div class="poster-title-strap"><span class="poster-belt">🏆</span><span>Cinturão em jogo</span><span class="poster-belt">🏆</span></div>` : ''}
          <div class="poster-offer-opponent">
            <span class="poster-offer-silhouette" aria-hidden="true">🥷</span>
            <div>
              <div class="poster-offer-vs">Oferta: você vs</div>
              <div class="poster-offer-name">${e(best.opponentName)}</div>
              <div class="poster-offer-meta">${e(best.promotionName)} · ${TIER_LABELS[best.tier]} · ${getWeightClassShort(best.weightClass || fighter.weightClass)}</div>
            </div>
          </div>
          <div class="poster-offer-terms">
            <span class="poster-offer-purse">${formatCurrency(best.purse)}</span>
            <span class="poster-offer-expiry">expira em ${best.expiresAbsWeek - now} sem${waiting > 1 ? ` · +${waiting - 1} outra${waiting === 2 ? '' : 's'}` : ''}</span>
          </div>
          <button class="btn btn-primary poster-offer-btn" data-nav="offers">Ver oferta</button>
        </div>` : '';
      return `
        <section class="poster poster--empty">
          ${arena}
          <div class="poster-body">
            ${status}
            <h1 class="visually-hidden">${e(fighter.name)} — ${weekLabel}</h1>
            <span class="poster-gymname">${e(fighter.name)}</span>
            <div class="poster-headline ${best ? 'poster-headline--dimmed' : ''}">Sem luta<br>marcada</div>
            ${offerCta || `
            <p class="poster-sub">avance a semana para receber propostas</p>`}
            ${actions}
          </div>
        </section>`;
    }

    const weeksOut = booking.eventAbsWeek - now;
    const orec = booking.opponentRecord;

    const when = weeksOut <= 0
      ? 'Esta semana'
      : `Em ${weeksOut} semana${weeksOut === 1 ? '' : 's'}`;

    const titleStrap = booking.isTitleFight ? `
      <div class="poster-title-strap">
        <span class="poster-belt">🏆</span>
        <span>${booking.interimTitle ? 'Cinturão INTERINO' : booking.titleRole === TITLE_ROLE.VACANT ? 'Cinturão vago' : 'Cinturão'} ${getWeightClassName(booking.weightClass)} em jogo</span>
        <span class="poster-belt">🏆</span>
      </div>` : '';

    const reencounterStrap = booking.isReencounter ? `
      <div class="poster-title-strap" style="background:linear-gradient(135deg, var(--red), var(--red-deep))">
        <span>⚔️ REENCONTRO — ${e(booking.opponentName)} já treinou na sua academia!</span>
      </div>` : '';

    return `
      <section class="poster ${booking.isTitleFight ? 'poster--title' : ''}">
        ${arena}
        <div class="poster-body">
          ${status}
          <h1 class="visually-hidden">${e(fighter.name)} — ${weekLabel}</h1>

          ${titleStrap}
          ${reencounterStrap}

          <div class="poster-billing">
            <span class="poster-promo">${e(booking.promotionName)}</span>
            <span class="badge ${tierBadgeCls(booking.tier)}">${TIER_LABELS[booking.tier]}</span>
            <span class="poster-when">${when}</span>
          </div>

          <div class="poster-bout">
            <div class="poster-fighter poster-fighter--red">
              <span class="poster-corner">Córner vermelho</span>
              <div class="poster-name">${this._posterName(fighter.name)}</div>
              <span class="poster-record">${fighter.record.wins}-${fighter.record.losses}-${fighter.record.draws} · OVR ${fighter.overallRating}</span>
            </div>

            <div class="poster-vs"><span>VS</span></div>

            <div class="poster-fighter poster-fighter--blue">
              <span class="poster-corner">Córner azul</span>
              <div class="poster-name">${this._posterName(booking.opponentName)}</div>
              <span class="poster-record">
                ${orec ? `${orec.wins}-${orec.losses}-${orec.draws} · ` : ''}OVR ${booking.opponentOverall ?? '?'}
              </span>
            </div>
          </div>

          <div class="poster-terms">
            <div class="poster-term">
              <span class="poster-term-label">Bolsa</span>
              <span class="poster-term-value is-money">${formatCurrency(booking.purse)}</span>
            </div>
            <div class="poster-term">
              <span class="poster-term-label">Bônus de vitória</span>
              <span class="poster-term-value">${formatCurrency(booking.winBonus)}</span>
            </div>
            <div class="poster-term">
              <span class="poster-term-label">Divisão</span>
              <span class="poster-term-value">${getWeightClassShort(booking.weightClass)}</span>
            </div>
          </div>

          ${actions}
        </div>
      </section>`;
  }

  static _posterName(name) {
    const parts = String(name).trim().split(/\s+/).map(p => escapeHtml(p));
    if (parts.length < 2) return parts[0] || '—';
    return `${parts[0]}<br>${parts.slice(1).join(' ')}`;
  }

  static render(data, weekLabel) {
    const { fighter, academy, manager, belts = [], contenderStatus, pendingOffers, bookings, promotions, pastEvents, milestones, socialPrompt, rivalryPrompt, narrativePrompt, weighInPrompt, pendingRehab, readiness, now, endCareerPrompt, onboarding, podcastEpisode, yearReview, crowdSnapshot, mediaCompare } = data;

    const tierBadge = (tier) => `<span class="badge ${tierBadgeCls(tier)}">${TIER_LABELS[tier]}</span>`;

    // ===== P7.4: Onboarding guiado — tracker horizontal com checkmarks =====
    const ONBOARDING_ICONS = { offerAccepted: '📩', campConfigured: '🏋️', weighedIn: '⚖️', firstFight: '🥊' };
    const activeSpotlight = onboarding ? ONBOARDING_SPOTLIGHT[onboarding.activeStep?.id] : null;
    const onboardingHtml = onboarding ? `
      <div class="card mb-4 onboarding-tracker" data-reveal style="border-top-color:var(--gold);position:relative">
        <button class="btn btn-sm btn-secondary" data-onboarding-dismiss title="Dispensar dicas" style="position:absolute;top:0.75rem;right:0.75rem">✕</button>
        <div class="card-header">
          <span class="card-title">🎓 Primeiros Passos (${onboarding.progress.done}/${onboarding.progress.total})</span>
        </div>
        <div class="onboarding-steps-row">
          ${(onboarding.steps || []).map((s, i) => `
            <div class="onboarding-step ${s.done ? 'is-done' : ''} ${s.id === onboarding.activeStep?.id ? 'is-active' : ''}" title="${e(s.label)}">
              <span class="onboarding-step-icon">${s.done ? '✓' : ONBOARDING_ICONS[s.id] || i + 1}</span>
              ${i < onboarding.steps.length - 1 ? '<span class="onboarding-step-line" aria-hidden="true"></span>' : ''}
            </div>
          `).join('')}
        </div>
        <p class="text-sm font-bold mb-1">${e(onboarding.activeStep.label)}</p>
        <p class="text-xs text-muted mb-2">${e(onboarding.activeStep.hint)}</p>
        ${activeSpotlight ? `<button class="btn btn-sm btn-secondary" data-onboarding-spotlight="${onboarding.activeStep.id}">👉 Mostrar</button>` : ''}
      </div>
    ` : '';

    // ===== Ofertas pendentes =====
    let offersHtml = '';
    if (pendingOffers.length > 0) {
      offersHtml = `
        <div class="section-label" data-reveal>Decisões Pendentes</div>
        <div class="card mb-4" data-reveal style="border-top-color:var(--accent)">
          <div class="card-header">
            <span class="card-title">📩 Ofertas de Luta (${pendingOffers.length})</span>
            <button class="btn btn-sm btn-primary" data-nav="offers">Ver todas</button>
          </div>
          <div data-reveal-stagger>
            ${pendingOffers.slice(0, 3).map(o => `
              <div class="flex items-center justify-between" style="padding:0.75rem 0;border-bottom:1px solid var(--border)">
                <div>
                  <div class="text-sm font-bold">
                    ${o.isTitleFight ? '<span class="belt-mark">🏆</span> ' : ''}Você vs ${e(o.opponentName)}
                  </div>
                  <div class="text-xs text-muted">${e(o.promotionName)} · Semana ${((o.eventAbsWeek - 1) % 52) + 1} · expira em ${o.expiresAbsWeek - now} sem</div>
                </div>
                <div class="flex items-center gap-2">
                  ${tierBadge(o.tier)}
                  <span class="text-sm font-bold" style="color:var(--success)">${formatCurrency(o.purse)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // ===== Pesagem — a decisão que fecha a preparação =====
    let weighInHtml = '';
    if (weighInPrompt) {
      weighInHtml = `
        ${pendingOffers.length === 0 ? '<div class="section-label" data-reveal>Decisões Pendentes</div>' : ''}
        <div class="card mb-4" data-reveal style="border-top-color:var(--gold)">
          <div class="card-header">
            <span class="card-title">⚖️ Semana da Pesagem</span>
          </div>
          <p class="text-sm text-muted mb-2">Você enfrenta ${e(weighInPrompt.opponentName)} em breve. Defina como vai administrar o corte de peso.</p>
          <div class="flex flex-col gap-2">
            ${weighInPrompt.strategies.map(s => `
              <button class="btn btn-secondary" data-weigh-in-choice="${s.key}" style="text-align:left">
                <strong>${e(s.label)}</strong>
                <span class="text-xs text-muted ml-2">${e(s.description)}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    // ===== P2.2: Reabilitação de lesão =====
    let rehabHtml = '';
    if (pendingRehab) {
      rehabHtml = `
        <div class="card mb-4" data-reveal style="border-top-color:var(--danger)">
          <div class="card-header">
            <span class="card-title">🏥 Reabilitação de Lesão</span>
          </div>
          <p class="text-sm text-muted mb-2">Sua lesão está em fase de reabilitação. Escolha o tipo de tratamento:</p>
          <div class="flex flex-col gap-2">
            <button class="btn btn-secondary" data-rehab-choice="free" style="text-align:left">
              <strong>Fisioterapia gratuita</strong>
              <span class="text-xs text-muted ml-2">(6 semanas — lenta, mas sem custo)</span>
            </button>
            <button class="btn btn-secondary" data-rehab-choice="fast" style="text-align:left">
              <strong>Fisioterapia rápida</strong>
              <span class="text-xs text-muted ml-2">(3 semanas — $${INJURY_CONFIG?.REHAB_FAST_COST * INJURY_CONFIG?.REHAB_FAST_WEEKS || 1500})</span>
            </button>
          </div>
        </div>`;
    }

    // ===== Redes sociais em semana livre (§D.2) =====
    let socialHtml = '';
    if (socialPrompt) {
      socialHtml = `
        ${pendingOffers.length === 0 ? '<div class="section-label" data-reveal>Decisões Pendentes</div>' : ''}
        <div class="card mb-4" data-reveal style="border-top-color:var(--gold)">
          <div class="card-header">
            <span class="card-title">📱 Momento nas Redes</span>
          </div>
          <p class="text-sm text-muted mb-2">Você tem a atenção da mídia social esta semana — como vai se posicionar?</p>
          <div class="flex flex-col gap-2">
            ${socialPrompt.choices.map(c => `
              <button class="btn btn-secondary" data-social-choice="${c.key}" style="text-align:left">
                ${e(c.text)}
                <span class="text-xs text-muted ml-2">(${e(c.hint)})</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    // ===== Rivalidade — prompt semanal =====
    let rivalryHtml = '';
    if (rivalryPrompt) {
      rivalryHtml = `
        ${pendingOffers.length === 0 && !socialPrompt ? '<div class="section-label" data-reveal>Decisões Pendentes</div>' : ''}
        <div class="card mb-4" data-reveal style="border-top-color:var(--danger)">
          <div class="card-header">
            <span class="card-title">⚔️ Rivalidade</span>
          </div>
          <p class="text-sm text-muted mb-2">${rivalryPrompt.rivalName} está provocando você. Como reagir?</p>
          <div class="flex flex-col gap-2">
            ${rivalryPrompt.choices.map(c => `
              <button class="btn btn-secondary rivalry-choice" data-choice="${c.key}" style="text-align:left">${e(c.text)}</button>
            `).join('')}
          </div>
        </div>`;
    }

    // ===== Evento narrativo (Fase 1) =====
    let narrativeHtml = '';
    if (narrativePrompt) {
      narrativeHtml = `
        ${pendingOffers.length === 0 && !socialPrompt && !rivalryPrompt ? '<div class="section-label" data-reveal>Decisões Pendentes</div>' : ''}
        <div class="card mb-4" data-reveal style="border-top-color:var(--gold)">
          <div class="card-header">
            <span class="card-title">📰 Momento da Carreira</span>
          </div>
          <p class="text-sm text-muted mb-2">${e(narrativePrompt.prompt)}</p>
          <div class="flex flex-col gap-2">
            ${narrativePrompt.choices.map(c => `
              <button class="btn btn-secondary narrative-choice" data-narrative-choice="${c.key}" style="text-align:left">
                ${e(c.text)}
              </button>
            `).join('')}
          </div>
        </div>`;
    }

    // ===== P5.3: Fim de carreira — Último Capítulo =====
    const endCareerHtml = endCareerPrompt ? `
      <div class="section-label" data-reveal>🕊️ Último Capítulo</div>
      <div class="card mb-4" data-reveal style="border-top-color:var(--gold);border-width:2px">
        <div class="card-header">
          <span class="card-title">🕊️ Sua Carreira Está Chegando ao Fim</span>
        </div>
        <p class="text-sm text-muted mb-3">Aos ${fighter.age} anos, você precisa decidir como quer encerrar sua jornada no MMA. Esta escolha é definitiva.</p>
        <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0.75rem">
          ${Object.entries(END_CAREER_CHOICES).map(([key, choice]) => `
            <button class="btn btn-secondary end-career-choice" data-end-career="${key}" style="text-align:left;padding:1rem;height:auto;flex-direction:column;align-items:flex-start;gap:0.5rem;border:1px solid var(--border)">
              <div style="font-size:1.5rem;line-height:1">${choice.icon}</div>
              <div>
                <div class="font-bold" style="font-size:0.95rem">${e(choice.label)}</div>
                <div class="text-xs text-muted" style="margin-top:0.25rem">${e(choice.description)}</div>
              </div>
            </button>
          `).join('')}
        </div>
      </div>
    ` : '';

    // ===== Patrocínios =====
    const sponsors = data.sponsors || { active: [], offers: [] };
    let sponsorsHtml = '';
    if (sponsors.offers.length > 0 || sponsors.active.length > 0) {
      const offerRows = sponsors.offers.map(o => `
        <div class="flex items-center justify-between" style="padding:0.75rem 0;border-bottom:1px solid var(--border)">
          <div>
            <div class="text-sm font-bold">🤝 ${o.brandName}</div>
            <div class="text-xs text-muted">${formatCurrency(o.weekly)}/sem + ${formatCurrency(o.bonus)} por ${o.goalWins} vitória${o.goalWins === 1 ? '' : 's'} em ${o.goalWeeks} sem · expira em ${o.expiresAbsWeek - now} sem</div>
          </div>
          <div class="flex items-center gap-2">
            <button class="btn btn-sm btn-success" data-sponsor-accept="${o.id}">Fechar</button>
            <button class="btn btn-sm btn-secondary" data-sponsor-decline="${o.id}">Recusar</button>
          </div>
        </div>
      `).join('');

      const activeRows = sponsors.active.map(c => {
        const winsSince = Math.max(0, fighter.record.wins - c.startWins);
        const weeksLeft = Math.max(0, c.deadlineAbsWeek - now);
        return `
          <div class="flex items-center justify-between" style="padding:0.75rem 0;border-bottom:1px solid var(--border)">
            <div>
              <div class="text-sm font-bold">${c.brandName} <span class="badge badge-success" style="font-size:0.6rem">ATIVO</span></div>
              <div class="text-xs text-muted">${formatCurrency(c.weekly)}/sem · bônus de ${formatCurrency(c.bonus)} em jogo · ${weeksLeft} sem restantes</div>
            </div>
            <div class="flex items-center gap-2">
              <div class="progress-bar" style="width:80px;height:6px">
                <div class="progress-fill ${winsSince >= c.goalWins ? 'high' : 'medium'}" style="width:${Math.min(100, (winsSince / c.goalWins) * 100)}%"></div>
              </div>
              <span class="text-xs text-muted">${winsSince}/${c.goalWins} vit.</span>
            </div>
          </div>
        `;
      }).join('');

      sponsorsHtml = `
        <div class="section-label" data-reveal>Patrocínios</div>
        <div class="card mb-4" data-reveal ${sponsors.offers.length > 0 ? 'style="border-top-color:var(--gold)"' : ''}>
          <div class="card-header"><span class="card-title">💼 Contratos de Marca</span></div>
          ${offerRows}
          ${activeRows}
        </div>
      `;
    }

    // ===== Atividade de lazer (§PRD: vida fora do octógono) =====
    const currentActivity = WEEKLY_ACTIVITIES[fighter.weeklyActivity];
    const activityHtml = `
      <div class="section-label" data-reveal>Vida Pessoal</div>
      <div class="card mb-4" data-reveal>
        <div class="card-header">
          <span class="card-title">🧘 Atividade da Semana</span>
        </div>
        <div class="text-xs text-muted mb-2">Escolha como passar seu tempo livre esta semana. A atividade é consumida no avanço da semana.</div>
        <div class="text-sm mb-2">${currentActivity ? `<strong>Atual:</strong> ${e(currentActivity.label)} — ${e(currentActivity.desc)}` : '<span class="text-muted">Nenhuma atividade definida (padrão: Descansar)</span>'}</div>
        <div class="flex gap-2 flex-wrap" data-reveal-stagger>
          ${Object.entries(WEEKLY_ACTIVITIES).map(([key, act]) => `
            <button class="btn btn-sm ${key === fighter.weeklyActivity ? 'btn-primary' : 'btn-secondary'} weekly-activity-set" data-activity="${key}">
              ${e(act.label)}
            </button>
          `).join('')}
          ${fighter.weeklyActivity ? '<button class="btn btn-sm btn-secondary weekly-activity-set" data-activity="">Limpar</button>' : ''}
        </div>
      </div>
    `;

    // ===== Luta agendada =====
    // Prontidão (item 4): o número fica na cara do jogador toda semana —
    // baixa = você está indo pra guerra sem camp, sem plano, sem estudo.
    let readinessHtml = '';
    if (readiness) {
      const barColor = readiness.player >= 60 ? 'var(--success)' : readiness.player >= 45 ? 'var(--gold)' : 'var(--danger)';
      const missing = readiness.parts.filter(p => p.value === 0 && ['camp', 'plan', 'scouting'].includes(p.key)).map(p => p.label);
      readinessHtml = `
        <div style="padding:0.5rem 0">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs text-muted">🎯 Prontidão para a luta</span>
            <span class="text-xs font-bold" style="color:${barColor}">${readiness.player}%${readiness.opponentKnown ? ` <span class="text-muted" style="font-weight:normal">· dele ~${e(readiness.opponent)}%</span>` : ''}</span>
          </div>
          <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden">
            <div style="width:${readiness.player}%;height:100%;background:${barColor}"></div>
          </div>
          ${missing.length > 0 ? `<div class="text-xs mt-1" style="color:var(--warning)">Faltando: ${missing.join(' · ')}</div>` : ''}
        </div>
      `;
    }

    let bookingsHtml = '';
    if (bookings.length > 0) {
      bookingsHtml = `
        <div class="section-label" data-reveal>Camp de Luta</div>
        <div class="card mb-4" data-reveal>
          <div class="card-header">
            <span class="card-title">🥊 Luta Confirmada</span>
            <button class="btn btn-sm btn-secondary" data-nav="training">Preparar no Camp</button>
          </div>
          ${bookings.map(b => {
            const weeksOut = b.eventAbsWeek - now;
            return `
              <div class="flex items-center justify-between" style="padding:0.75rem 0;border-bottom:1px solid var(--border)">
                <div>
                  <div class="text-sm font-bold">Você vs ${e(b.opponentName)}</div>
                  <div class="text-xs text-muted">${e(b.promotionName)} · bolsa ${formatCurrency(b.purse)} + ${formatCurrency(b.winBonus)} por vitória</div>
                </div>
                <span class="badge ${weeksOut <= 1 ? 'badge-danger' : 'badge-warning'}">${weeksOut <= 0 ? 'Esta semana!' : `em ${weeksOut} sem`}</span>
              </div>
            `;
          }).join('')}
          ${readinessHtml}
        </div>
      `;
    }

    // ===== Seu lutador =====
    const focusMeta = TRAINING_FOCUS_META[fighter.trainingFocus || 'striking'];
    const injured = fighter.status === 'injured';
    const styleCfg = FIGHTING_STYLES[fighter.style] || FIGHTING_STYLES.freestyle;
    const xpPct = Math.round(fighter.xpProgress * 100);
    const fighterHtml = `
      <div class="section-label" data-reveal>Seu Lutador</div>
      <div class="bento-grid mb-4" data-reveal-stagger>
        <div class="card stat-card stat-card--span-4 ${belts.length > 0 ? 'stat-card--champion' : ''}" data-fighter-click="${fighter.id}" style="cursor:pointer">
          <div class="card-header">
            <span class="card-title">${belts.length > 0 ? '<span class="belt-mark">🏆</span> ' : ''}${e(fighter.name)}</span>
            <span class="badge badge-info">${getWeightClassShort(fighter.weightClass)}</span>
          </div>
          ${belts.map(b => `<div class="belt-line">Campeão ${getWeightClassName(b.weightClass)} · ${b.promotionShort}${b.defenses > 0 ? ` · ${b.defenses} defesa${b.defenses === 1 ? '' : 's'}` : ''}</div>`).join('')}
          ${belts.length === 0 && contenderStatus ? `<div class="contender-line">#${contenderStatus.rank} na fila do cinturão · ${contenderStatus.promotionShort}</div>` : ''}
          <div class="flex items-center gap-3 mb-2">
            <span class="stat-value" style="font-size:1.6rem">${fighter.overallRating}</span>
            <div>
              <div class="text-sm font-bold">${fighter.record.wins}-${fighter.record.losses}-${fighter.record.draws}</div>
              <div class="text-xs text-muted">${fighter.age} anos · ${FIGHTING_STYLES[fighter.style]?.label || fighter.fightingStyle}</div>
            </div>
          </div>
          ${injured ? `<div class="text-xs" style="color:var(--accent)">🏥 ${e(fighter.injury?.description || 'Lesionado')}</div>` : bookings[0]
            ? `<div class="text-xs" style="color:var(--gold)">🥊 Luta em ${Math.max(0, bookings[0].eventAbsWeek - now)} sem vs ${e(bookings[0].opponentName)}</div>`
            : fighter.availableFromAbsWeek > now
              ? `<div class="text-xs" style="color:var(--warning)">⏳ Suspensão médica · ${fighter.availableFromAbsWeek - now} sem</div>`
              : '<div class="text-xs text-muted">Sem luta marcada</div>'}

          <div class="flex items-center gap-2 mt-2">
            <span class="badge badge-info">Nv.${fighter.level}</span>
            <span class="badge badge-warning">${e(styleCfg.label)}</span>
            <div style="flex:1"><div class="progress-bar" style="height:6px">
              <div class="progress-fill" style="width:${xpPct}%"></div>
            </div></div>
            <small class="text-xs text-muted">${Math.round(fighter.xp)}/${LEVEL_CONFIG.XP_PER_LEVEL} (${xpPct}%)</small>
          </div>

          <div class="flex items-center gap-2 mt-2">
            <span class="text-xs text-muted">Fadiga</span>
            <div class="progress-bar" style="width:50px;height:5px">
              <div class="progress-fill ${fighter.fatigue >= 60 ? 'low' : fighter.fatigue >= 30 ? 'medium' : 'high'}" style="width:${fighter.fatigue}%"></div>
            </div>
            <span class="text-xs text-muted">Moral</span>
            <div class="progress-bar" style="width:50px;height:5px">
              <div class="progress-fill ${fighter.morale >= 70 ? 'high' : fighter.morale >= 40 ? 'medium' : 'low'}" style="width:${fighter.morale}%"></div>
            </div>
          </div>
          <div class="text-xs mt-2" style="color:var(--text-secondary)">Treino da semana: <strong>${focusMeta.icon} ${e(focusMeta.label)}</strong></div>
        </div>
      </div>
    `;

    // ===== Calendário do mundo =====
    const worldHtml = `
      <div class="section-label" data-reveal>O Mundo do MMA</div>
      <div class="card mb-4" data-reveal>
        <div class="card-header">
          <span class="card-title">Próximos Eventos</span>
          <button class="btn btn-sm btn-secondary" data-nav="events">Ver mundo</button>
        </div>
        <div data-reveal-stagger>
          ${promotions.map(p => {
            const weeksOut = (p.nextEventAbsWeek || 0) - now;
            const hasBooking = bookings.some(b => b.promotionId === p.id && b.eventAbsWeek === p.nextEventAbsWeek);
            const eventName = p.nextEventName ? p.nextEventName() : p.name || 'Evento';
            return `
              <div class="flex items-center justify-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
                <div class="flex items-center gap-2">
                  ${tierBadge(p.tier)}
                  <span class="text-sm font-bold">${eventName}</span>
                  ${hasBooking ? '<span class="badge badge-success" style="font-size:0.6rem">VOCÊ NO CARD</span>' : ''}
                </div>
                <span class="text-xs text-muted">${weeksOut <= 0 ? 'esta semana' : `em ${weeksOut} sem`}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // ===== Objetivos (milestones) =====
    const pendingMilestones = (milestones || []).filter(m => !m.unlocked).slice(0, 3);
    const milestonesHtml = pendingMilestones.length > 0 ? `
      <div class="section-label" data-reveal>Objetivos</div>
      <div class="card mb-4" data-reveal>
        <div class="card-header"><span class="card-title">Próximos Objetivos</span></div>
        ${pendingMilestones.map(m => `
          <div class="flex items-center justify-between" style="padding:0.75rem 0;border-bottom:1px solid var(--border)">
            <div>
              <div class="text-sm font-bold">${e(m.label)}</div>
              <div class="text-xs text-muted">${e(m.desc)}</div>
            </div>
            <div class="flex items-center gap-2">
              <div class="progress-bar" style="width:80px;height:6px">
                <div class="progress-fill" style="width:${Math.min(100, (m.current / m.max) * 100)}%"></div>
              </div>
              <span class="text-xs text-muted">${m.current}/${m.max}</span>
            </div>
          </div>
        `).join('')}
      </div>
    ` : '';

    // ===== Últimos resultados do mundo =====
    const resultsHtml = pastEvents.length > 0 ? `
      <div class="section-label" data-reveal>Últimos Eventos</div>
      <div class="card mb-4" data-reveal>
        ${pastEvents.slice(0, 4).map(ev => {
          // results vem ordenado por billing ascendente (prelim -> main ->
          // título, ver world-service._runEvent); o último item fecha a
          // noite — pegar [0] mostraria sempre uma prelim como se fosse o
          // resultado principal do evento.
          const main = ev.results?.[ev.results.length - 1];
          return `
            <div class="flex items-center justify-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border);cursor:pointer" data-event-click="${ev.id}">
              <div>
                <span class="text-sm font-bold">${e(ev.name)}</span>
                ${main ? `<span class="text-xs text-muted ml-2">${main.isDraw ? `Empate (${e(main.method)})` : `${e(main.winnerName)} venceu por ${e(main.method)}`}</span>` : ''}
              </div>
              <span class="text-xs text-muted">ver card →</span>
            </div>
          `;
        }).join('')}
      </div>
    ` : '';

    return `
      ${this._renderPoster(data, weekLabel)}
      ${onboardingHtml}

      <!-- Stats -->
      <div class="section-label" data-reveal>Visão Geral</div>
      <div class="bento-grid mb-4" data-reveal-stagger>
        <div class="stat-card stat-card--span-3" title="Dinheiro disponível agora — bolsas entram aqui, camp e vida pessoal saem daqui">
          <div class="card-header"><span class="card-title">💵 Caixa</span></div>
          <div class="stat-value ${fighter.cash < 0 ? 'text-danger' : 'stat-value--money'}">${formatCurrency(fighter.cash)}</div>
          <div class="stat-label">Disponível</div>
        </div>
        <div class="stat-card stat-card--span-3" title="Popularidade abre portas: ofertas melhores, bônus de hype e patrocínios">
          <div class="card-header"><span class="card-title">${fighter.popularity >= 70 ? '🔥' : '👥'} Popularidade</span></div>
          <div class="stat-value">${fighter.popularity}</div>
          <div class="stat-label">
            <div class="progress-bar mt-2">
              <div class="progress-fill ${fighter.popularity >= 70 ? 'high' : fighter.popularity >= 40 ? 'medium' : 'low'}" style="width:${fighter.popularity}%"></div>
            </div>
          </div>
        </div>
        <div class="stat-card stat-card--span-3" title="Vitórias-Derrotas na carreira profissional">
          <div class="card-header"><span class="card-title">${belts.length > 0 ? '🏆' : fighter.record.wins >= 3 ? '🔥' : '🥊'} Cartel</span></div>
          <div class="stat-value">${fighter.record.wins}-${fighter.record.losses}</div>
          <div class="stat-label">Vitórias-Derrotas</div>
        </div>
        <div class="stat-card stat-card--span-3" title="Soma de todas as bolsas e bônus recebidos na carreira">
          <div class="card-header"><span class="card-title">💰 Ganhos na Carreira</span></div>
          <div class="stat-value stat-value--money" style="font-size:1.4rem">${formatCurrency(fighter.careerEarnings || 0)}</div>
          <div class="stat-label">Total em bolsas</div>
        </div>
      </div>

      ${offersHtml}
      ${weighInHtml}
      ${rehabHtml}
      ${socialHtml}
      ${rivalryHtml}
      ${narrativeHtml}
      ${endCareerHtml}
      ${crowdSnapshot ? CrowdService.renderReactionCard(crowdSnapshot.reaction, crowdSnapshot.fanMail) : ''}
      ${mediaCompare ? `
      <div class="card mb-4" data-reveal style="border-top-color:var(--danger)">
        <div class="card-header">
          <span class="card-title">📡 Na mídia</span>
          <span class="badge badge-warning">Rivalidade ${mediaCompare.intensity}/10</span>
        </div>
        <p class="text-sm font-bold mb-3">${escapeHtml(mediaCompare.headline)}</p>
        <div class="grid grid-cols-3 gap-3 text-center">
          <div>
            <div class="text-xs text-muted">Você</div>
            <div class="font-bold">${escapeHtml(mediaCompare.yourRecord)}</div>
            <div class="text-xs text-muted">OVR ${mediaCompare.yourOvr} · pop ${mediaCompare.yourPop}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Confronto direto</div>
            <div class="font-bold text-lg">${escapeHtml(mediaCompare.h2h)}</div>
            <div class="text-xs text-muted">vs ${escapeHtml(mediaCompare.rivalName)}</div>
          </div>
          <div>
            <div class="text-xs text-muted">${escapeHtml(mediaCompare.rivalName)}</div>
            <div class="font-bold">${escapeHtml(mediaCompare.rivalRecord)}</div>
            <div class="text-xs text-muted">OVR ${mediaCompare.rivalOvr} · pop ${mediaCompare.rivalPop}</div>
          </div>
        </div>
      </div>` : ''}
      ${PodcastService.renderCard(podcastEpisode)}
      ${YearReviewService.renderCard(yearReview)}
      ${sponsorsHtml}
      ${activityHtml}
      ${bookingsHtml}
      ${fighterHtml}

      <!-- Academia e empresário — links rápidos -->
      <div class="card mb-4" data-reveal>
        <div class="card-header">
          <span class="card-title">🏋️ ${e(academy?.name || 'Sem academia')}</span>
          <button class="btn btn-sm btn-secondary" data-nav="academy">Trocar Academia</button>
        </div>
        <div class="flex items-center gap-2" style="flex-wrap:wrap">
          <span class="badge badge-info">Sinergia ${fighter.coachSynergy}%</span>
          <span class="badge ${manager ? 'badge-success' : 'badge-warning'}">${manager ? e(manager.name) : 'Sem empresário'}</span>
          <span class="text-xs text-muted">+${Math.round((academy?.facility?.trainingBonus || 0) * 100)}% de ganho no treino</span>
        </div>
      </div>

      ${worldHtml}
      ${milestonesHtml}
      ${resultsHtml}
    `;
  }
}
