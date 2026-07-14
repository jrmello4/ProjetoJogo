import { formatCurrency, getWeightClassShort, getWeightClassName } from '../utils/helpers.js';
import { TIER_LABELS, TRAINING_FOCUS_META, TITLE_ROLE } from '../config/game-config.js';

const tierBadgeCls = (tier) => (tier === 1 ? 'badge-danger' : tier === 2 ? 'badge-warning' : 'badge-info');

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
        <span class="poster-status-gym">${fighter.name} · ${getWeightClassShort(fighter.weightClass)}</span>
      </header>`;

    const actions = `
      <div class="poster-actions">
        <button class="btn btn-primary week-advance" id="weekAdvanceBtn">Avançar semana</button>
        <button class="btn btn-secondary" id="simulatePeriodBtn">Simular período</button>
        <button class="btn btn-secondary save-load" id="saveLoadBtn">Salvar / carregar</button>
      </div>`;

    if (!booking) {
      const waiting = pendingOffers.length;
      return `
        <section class="poster poster--empty">
          ${arena}
          <div class="poster-body">
            ${status}
            <h1 class="visually-hidden">${fighter.name} — ${weekLabel}</h1>
            <span class="poster-gymname">${fighter.name}</span>
            <div class="poster-headline">Sem luta<br>marcada</div>
            <p class="poster-sub">
              ${waiting > 0
                ? `${waiting} oferta${waiting === 1 ? '' : 's'} na mesa esperando resposta`
                : 'avance a semana para receber propostas'}
            </p>
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
        <span>${booking.titleRole === TITLE_ROLE.VACANT ? 'Cinturão vago' : 'Cinturão'} ${getWeightClassName(booking.weightClass)} em jogo</span>
        <span class="poster-belt">🏆</span>
      </div>` : '';

    const reencounterStrap = booking.isReencounter ? `
      <div class="poster-title-strap" style="background:linear-gradient(135deg, var(--red), #c0392b)">
        <span>⚔️ REENCONTRO — ${booking.opponentName} já treinou na sua academia!</span>
      </div>` : '';

    return `
      <section class="poster ${booking.isTitleFight ? 'poster--title' : ''}">
        ${arena}
        <div class="poster-body">
          ${status}
          <h1 class="visually-hidden">${fighter.name} — ${weekLabel}</h1>

          ${titleStrap}
          ${reencounterStrap}

          <div class="poster-billing">
            <span class="poster-promo">${booking.promotionName}</span>
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
    const parts = String(name).trim().split(/\s+/);
    if (parts.length < 2) return parts[0] || '—';
    return `${parts[0]}<br>${parts.slice(1).join(' ')}`;
  }

  static render(data, weekLabel) {
    const { fighter, academy, manager, belts = [], contenderStatus, pendingOffers, bookings, promotions, pastEvents, milestones, socialPrompt, rivalryPrompt, pendingApproach, weighInPrompt, now } = data;

    const tierBadge = (tier) => `<span class="badge ${tierBadgeCls(tier)}">${TIER_LABELS[tier]}</span>`;

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
                    ${o.isTitleFight ? '<span class="belt-mark">🏆</span> ' : ''}Você vs ${o.opponentName}
                  </div>
                  <div class="text-xs text-muted">${o.promotionName} · Semana ${((o.eventAbsWeek - 1) % 52) + 1} · expira em ${o.expiresAbsWeek - now} sem</div>
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
          <p class="text-sm text-muted mb-2">Você enfrenta ${weighInPrompt.opponentName} em breve. Defina como vai administrar o corte de peso.</p>
          <div class="flex flex-col gap-2">
            ${weighInPrompt.strategies.map(s => `
              <button class="btn btn-secondary" data-weigh-in-choice="${s.key}" style="text-align:left">
                <strong>${s.label}</strong>
                <span class="text-xs text-muted ml-2">${s.description}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
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
                ${c.text}
                <span class="text-xs text-muted ml-2">(${c.hint})</span>
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
              <button class="btn btn-secondary rivalry-choice" data-choice="${c.key}" style="text-align:left">${c.text}</button>
            `).join('')}
          </div>
        </div>`;
    }

    // ===== Sondagem de retenção (§A.4/§C.1) =====
    let approachHtml = '';
    if (pendingApproach) {
      const isAcademy = pendingApproach.targetType === 'academy';
      const deadline = pendingApproach.deadlineAbsWeek - now;
      approachHtml = `
        ${pendingOffers.length === 0 && !socialPrompt ? '<div class="section-label" data-reveal>Decisões Pendentes</div>' : ''}
        <div class="card mb-4" data-reveal style="border-top-color:var(--danger)">
          <div class="card-header">
            <span class="card-title">🔍 Sondagem — ${pendingApproach.rivalName}</span>
            <span class="badge badge-danger">${deadline <= 0 ? 'última semana' : `${deadline} sem restantes`}</span>
          </div>
          ${pendingApproach.contextMessage ? `<p class="text-sm text-muted mb-2">${pendingApproach.contextMessage}</p>` : ''}
          <p class="text-sm text-muted mb-2">
            ${isAcademy
              ? `${pendingApproach.rivalName} quer te treinar. Como você reage?`
              : `${pendingApproach.rivalName} quer ser seu empresário. Como você reage?`}
          </p>
          <div class="flex flex-col gap-2">
            <button class="btn btn-secondary" data-approach-respond="renegotiate" data-approach-id="${pendingApproach.id}" style="text-align:left">
              Renegociar ${isAcademy ? 'com o técnico' : 'o corte'}
              <span class="text-xs text-muted ml-2">(sem custo, ${isAcademy ? 'sinergia' : 'corte'} e moral melhoram)</span>
            </button>
            <button class="btn btn-secondary" data-approach-respond="stay_bonus" data-approach-id="${pendingApproach.id}" style="text-align:left">
              Pedir bônus de permanência
              <span class="text-xs text-muted ml-2">(dinheiro agora, lealdade e moral sobem bastante)</span>
            </button>
            <button class="btn btn-secondary" data-approach-respond="promise" data-approach-id="${pendingApproach.id}" style="text-align:left">
              Fazer uma promessa
              <span class="text-xs text-muted ml-2">(sem custo agora — quebrar depois custa caro)</span>
            </button>
            <button class="btn btn-danger" data-approach-respond="let_go" data-approach-id="${pendingApproach.id}" style="text-align:left">
              Aceitar e trocar agora
              <span class="text-xs text-muted ml-2">(troca imediata para ${pendingApproach.rivalName})</span>
            </button>
          </div>
        </div>
      `;
    }

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

    // ===== Luta agendada =====
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
                  <div class="text-sm font-bold">Você vs ${b.opponentName}</div>
                  <div class="text-xs text-muted">${b.promotionName} · bolsa ${formatCurrency(b.purse)} + ${formatCurrency(b.winBonus)} por vitória</div>
                </div>
                <span class="badge ${weeksOut <= 1 ? 'badge-danger' : 'badge-warning'}">${weeksOut <= 0 ? 'Esta semana!' : `em ${weeksOut} sem`}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // ===== Seu lutador =====
    const focusMeta = TRAINING_FOCUS_META[fighter.trainingFocus || 'striking'];
    const injured = fighter.status === 'injured';
    const fighterHtml = `
      <div class="section-label" data-reveal>Seu Lutador</div>
      <div class="bento-grid mb-4" data-reveal-stagger>
        <div class="card stat-card stat-card--span-4 ${belts.length > 0 ? 'stat-card--champion' : ''}" data-fighter-click="${fighter.id}" style="cursor:pointer">
          <div class="card-header">
            <span class="card-title">${belts.length > 0 ? '<span class="belt-mark">🏆</span> ' : ''}${fighter.name}</span>
            <span class="badge badge-info">${getWeightClassShort(fighter.weightClass)}</span>
          </div>
          ${belts.map(b => `<div class="belt-line">Campeão ${getWeightClassName(b.weightClass)} · ${b.promotionShort}${b.defenses > 0 ? ` · ${b.defenses} defesa${b.defenses === 1 ? '' : 's'}` : ''}</div>`).join('')}
          ${belts.length === 0 && contenderStatus ? `<div class="contender-line">#${contenderStatus.rank} na fila do cinturão · ${contenderStatus.promotionShort}</div>` : ''}
          <div class="flex items-center gap-3 mb-2">
            <span class="stat-value" style="font-size:1.6rem">${fighter.overallRating}</span>
            <div>
              <div class="text-sm font-bold">${fighter.record.wins}-${fighter.record.losses}-${fighter.record.draws}</div>
              <div class="text-xs text-muted">${fighter.age} anos · ${fighter.fightingStyle}</div>
            </div>
          </div>
          ${injured ? `<div class="text-xs" style="color:var(--accent)">🏥 ${fighter.injury?.description || 'Lesionado'}</div>` : bookings[0]
            ? `<div class="text-xs" style="color:var(--gold,#d4a843)">🥊 Luta em ${Math.max(0, bookings[0].eventAbsWeek - now)} sem vs ${bookings[0].opponentName}</div>`
            : fighter.availableFromAbsWeek > now
              ? `<div class="text-xs" style="color:var(--warning)">⏳ Suspensão médica · ${fighter.availableFromAbsWeek - now} sem</div>`
              : '<div class="text-xs text-muted">Sem luta marcada</div>'}
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
          <div class="text-xs mt-2" style="color:var(--text-secondary)">Treino da semana: <strong>${focusMeta.icon} ${focusMeta.label}</strong></div>
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
            const weeksOut = p.nextEventAbsWeek - now;
            const hasBooking = bookings.some(b => b.promotionId === p.id && b.eventAbsWeek === p.nextEventAbsWeek);
            return `
              <div class="flex items-center justify-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
                <div class="flex items-center gap-2">
                  ${tierBadge(p.tier)}
                  <span class="text-sm font-bold">${p.nextEventName()}</span>
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
              <div class="text-sm font-bold">${m.label}</div>
              <div class="text-xs text-muted">${m.desc}</div>
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
        ${pastEvents.slice(0, 4).map(e => {
          const main = e.results?.[0];
          return `
            <div class="flex items-center justify-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border);cursor:pointer" data-event-click="${e.id}">
              <div>
                <span class="text-sm font-bold">${e.name}</span>
                ${main ? `<span class="text-xs text-muted ml-2">${main.isDraw ? `Empate (${main.method})` : `${main.winnerName} venceu por ${main.method}`}</span>` : ''}
              </div>
              <span class="text-xs text-muted">ver card →</span>
            </div>
          `;
        }).join('')}
      </div>
    ` : '';

    return `
      ${this._renderPoster(data, weekLabel)}

      <!-- Stats -->
      <div class="section-label" data-reveal>Visão Geral</div>
      <div class="bento-grid mb-4" data-reveal-stagger>
        <div class="stat-card stat-card--span-3">
          <div class="card-header"><span class="card-title">Caixa</span></div>
          <div class="stat-value ${fighter.cash < 0 ? 'text-danger' : ''}">${formatCurrency(fighter.cash)}</div>
          <div class="stat-label">Disponível</div>
        </div>
        <div class="stat-card stat-card--span-3">
          <div class="card-header"><span class="card-title">Popularidade</span></div>
          <div class="stat-value">${fighter.popularity}</div>
          <div class="stat-label">
            <div class="progress-bar mt-2">
              <div class="progress-fill ${fighter.popularity >= 70 ? 'high' : fighter.popularity >= 40 ? 'medium' : 'low'}" style="width:${fighter.popularity}%"></div>
            </div>
          </div>
        </div>
        <div class="stat-card stat-card--span-3">
          <div class="card-header"><span class="card-title">Cartel</span></div>
          <div class="stat-value">${fighter.record.wins}-${fighter.record.losses}</div>
          <div class="stat-label">Vitórias-Derrotas</div>
        </div>
        <div class="stat-card stat-card--span-3">
          <div class="card-header"><span class="card-title">Ganhos na Carreira</span></div>
          <div class="stat-value" style="font-size:1.4rem">${formatCurrency(fighter.careerEarnings || 0)}</div>
          <div class="stat-label">Total em bolsas</div>
        </div>
      </div>

      ${offersHtml}
      ${weighInHtml}
      ${socialHtml}
      ${rivalryHtml}
      ${approachHtml}
      ${sponsorsHtml}
      ${bookingsHtml}
      ${fighterHtml}

      <!-- Academia e empresário — links rápidos -->
      <div class="card mb-4" data-reveal>
        <div class="card-header">
          <span class="card-title">🏋️ ${academy?.name || 'Sem academia'}</span>
          <button class="btn btn-sm btn-secondary" data-nav="academy">Trocar Academia</button>
        </div>
        <div class="flex items-center gap-2" style="flex-wrap:wrap">
          <span class="badge badge-info">Sinergia ${fighter.coachSynergy}%</span>
          <span class="badge ${manager ? 'badge-success' : 'badge-warning'}">${manager ? manager.name : 'Sem empresário'}</span>
          <span class="text-xs text-muted">+${Math.round((academy?.facility?.trainingBonus || 0) * 100)}% de ganho no treino</span>
        </div>
      </div>

      ${worldHtml}
      ${milestonesHtml}
      ${resultsHtml}
    `;
  }
}
