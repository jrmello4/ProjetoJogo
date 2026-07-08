import { formatCurrency, getWeightClassShort, getWeightClassName } from '../utils/helpers.js';
import { TIER_LABELS, TRAINING_FOCUS_META, TITLE_ROLE, absWeekToLabel } from '../config/game-config.js';

const tierBadgeCls = (tier) => (tier === 1 ? 'badge-danger' : tier === 2 ? 'badge-warning' : 'badge-info');

export class DashboardView {
  // ===== Signature: the fight poster =====
  // Your next booked bout, billed like the real thing. Your gym is always
  // the red corner. With no fight on the books, the poster stays and the
  // slot sits empty — which is exactly the feeling we want you to fix.
  static _renderPoster(data, weekLabel) {
    const { gym, pendingOffers, bookings, team, now } = data;
    const booking = bookings[0];

    const arena = `
      <div class="poster-arena" aria-hidden="true">
        <div class="arena-container" id="octagonArena"></div>
      </div>`;

    const status = `
      <header class="poster-status">
        <span class="poster-status-week">${weekLabel}</span>
        <span class="poster-status-gym">${gym.name} · ${gym.facility.name}</span>
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
            <h1 class="visually-hidden">${gym.name} — ${weekLabel}</h1>
            <span class="poster-gymname">${gym.name}</span>
            <div class="poster-headline">Sem luta<br>marcada</div>
            <p class="poster-sub">
              ${waiting > 0
                ? `${waiting} oferta${waiting === 1 ? '' : 's'} na mesa esperando resposta`
                : `${team.length} atleta${team.length === 1 ? '' : 's'} em treino · avance a semana para receber propostas`}
            </p>
            ${actions}
          </div>
        </section>`;
    }

    const fighter = team.find(f => f.id === booking.fighterId);
    const weeksOut = booking.eventAbsWeek - now;
    const orec = booking.opponentRecord;

    const when = weeksOut <= 0
      ? 'Esta semana'
      : `Em ${weeksOut} semana${weeksOut === 1 ? '' : 's'}`;

    // Cinturão em jogo: o pôster inteiro muda de tom. É a única coisa que
    // merece dourado nesta tela.
    const titleStrap = booking.isTitleFight ? `
      <div class="poster-title-strap">
        <span class="poster-belt">🏆</span>
        <span>${booking.titleRole === TITLE_ROLE.VACANT ? 'Cinturão vago' : 'Cinturão'} ${getWeightClassName(booking.weightClass)} em jogo</span>
        <span class="poster-belt">🏆</span>
      </div>` : '';

    return `
      <section class="poster ${booking.isTitleFight ? 'poster--title' : ''}">
        ${arena}
        <div class="poster-body">
          ${status}
          <h1 class="visually-hidden">${gym.name} — ${weekLabel}</h1>

          ${titleStrap}

          <div class="poster-billing">
            <span class="poster-promo">${booking.promotionName}</span>
            <span class="badge ${tierBadgeCls(booking.tier)}">${TIER_LABELS[booking.tier]}</span>
            <span class="poster-when">${when}</span>
          </div>

          <div class="poster-bout">
            <div class="poster-fighter poster-fighter--red">
              <span class="poster-corner">Córner vermelho</span>
              <div class="poster-name">${this._posterName(fighter ? fighter.name : '—')}</div>
              <span class="poster-record">
                ${fighter ? `${fighter.record.wins}-${fighter.record.losses}-${fighter.record.draws} · OVR ${fighter.overallRating}` : ''}
              </span>
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

  // Fight posters break the name after the first word: given name up top,
  // surname below, both flush to the corner.
  static _posterName(name) {
    const parts = String(name).trim().split(/\s+/);
    if (parts.length < 2) return parts[0] || '—';
    return `${parts[0]}<br>${parts.slice(1).join(' ')}`;
  }

  static render(data, weekLabel) {
    const { gym, team, teamBelts = {}, teamContenderStatus = {}, pendingOffers, bookings, promotions, pastEvents, milestones, now } = data;

    const tierBadge = (tier) => `<span class="badge ${tierBadgeCls(tier)}">${TIER_LABELS[tier]}</span>`;

    // ===== Ofertas pendentes (a decisão da semana) =====
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
            ${pendingOffers.slice(0, 3).map(o => {
              const fighter = team.find(f => f.id === o.fighterId);
              return `
                <div class="flex items-center justify-between" style="padding:0.75rem 0;border-bottom:1px solid var(--border)">
                  <div>
                    <div class="text-sm font-bold">
                      ${o.isTitleFight ? '<span class="belt-mark">🏆</span> ' : ''}${fighter ? fighter.name : '—'} vs ${o.opponentName}
                    </div>
                    <div class="text-xs text-muted">${o.promotionName} · Semana ${((o.eventAbsWeek - 1) % 52) + 1} · expira em ${o.expiresAbsWeek - now} sem</div>
                  </div>
                  <div class="flex items-center gap-2">
                    ${tierBadge(o.tier)}
                    <span class="text-sm font-bold" style="color:var(--success)">${formatCurrency(o.purse)}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // ===== Patrocínios: propostas na mesa + contratos com meta =====
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
        const winsSince = Math.max(0, gym.wins - c.startWins);
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
          <div class="card-header">
            <span class="card-title">💼 Contratos de Marca</span>
          </div>
          ${offerRows}
          ${activeRows}
        </div>
      `;
    }

    // ===== Lutas agendadas =====
    let bookingsHtml = '';
    if (bookings.length > 0) {
      bookingsHtml = `
        <div class="section-label" data-reveal>Camp de Luta</div>
        <div class="card mb-4" data-reveal>
          <div class="card-header">
            <span class="card-title">🥊 Lutas Confirmadas</span>
            <button class="btn btn-sm btn-secondary" data-nav="training">Preparar no Camp</button>
          </div>
          ${bookings.map(b => {
            const fighter = team.find(f => f.id === b.fighterId);
            const weeksOut = b.eventAbsWeek - now;
            return `
              <div class="flex items-center justify-between" style="padding:0.75rem 0;border-bottom:1px solid var(--border)">
                <div>
                  <div class="text-sm font-bold">${fighter ? fighter.name : '—'} vs ${b.opponentName}</div>
                  <div class="text-xs text-muted">${b.promotionName} · bolsa ${formatCurrency(b.purse)} + ${formatCurrency(b.winBonus)} por vitória</div>
                </div>
                <span class="badge ${weeksOut <= 1 ? 'badge-danger' : 'badge-warning'}">${weeksOut <= 0 ? 'Esta semana!' : `em ${weeksOut} sem`}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // ===== Equipe =====
    const teamHtml = `
      <div class="section-label" data-reveal>Minha Equipe</div>
      <div class="bento-grid mb-4" data-reveal-stagger>
        ${team.map(f => {
          const booking = bookings.find(b => b.fighterId === f.id);
          const injured = f.status === 'injured';
          const focusMeta = TRAINING_FOCUS_META[f.trainingFocus || 'striking'];
          const belts = teamBelts[f.id] || [];
          return `
            <div class="card stat-card stat-card--span-4 ${belts.length > 0 ? 'stat-card--champion' : ''}" data-fighter-click="${f.id}" style="cursor:pointer">
              <div class="card-header">
                <span class="card-title">${belts.length > 0 ? '<span class="belt-mark">🏆</span> ' : ''}${f.name}</span>
                <span class="badge badge-info">${getWeightClassShort(f.weightClass)}</span>
              </div>
              ${belts.map(b => `<div class="belt-line">Campeão ${getWeightClassName(b.weightClass)} · ${b.promotionShort}${b.defenses > 0 ? ` · ${b.defenses} defesa${b.defenses === 1 ? '' : 's'}` : ''}</div>`).join('')}
              ${belts.length === 0 && teamContenderStatus[f.id] ? `<div class="contender-line">#${teamContenderStatus[f.id].rank} na fila do cinturão · ${teamContenderStatus[f.id].promotionShort}</div>` : ''}
              <div class="flex items-center gap-3 mb-2">
                <span class="stat-value" style="font-size:1.6rem">${f.overallRating}</span>
                <div>
                  <div class="text-sm font-bold">${f.record.wins}-${f.record.losses}-${f.record.draws}</div>
                  <div class="text-xs text-muted">${f.age} anos · ${f.fightingStyle}</div>
                </div>
              </div>
              ${injured ? `<div class="text-xs" style="color:var(--accent)">🏥 ${f.injury?.description || 'Lesionado'}</div>` : booking
                ? `<div class="text-xs" style="color:var(--gold,#d4a843)">🥊 Luta em ${Math.max(0, booking.eventAbsWeek - now)} sem vs ${booking.opponentName}</div>`
                : f.availableFromAbsWeek > now
                  ? `<div class="text-xs" style="color:var(--warning)">⏳ Suspensão médica · ${f.availableFromAbsWeek - now} sem</div>`
                  : '<div class="text-xs text-muted">Sem luta marcada</div>'}
              <div class="flex items-center gap-2 mt-2">
                <span class="text-xs text-muted">Fadiga</span>
                <div class="progress-bar" style="width:50px;height:5px">
                  <div class="progress-fill ${f.fatigue >= 60 ? 'low' : f.fatigue >= 30 ? 'medium' : 'high'}" style="width:${f.fatigue}%"></div>
                </div>
                <span class="text-xs text-muted">Moral</span>
                <div class="progress-bar" style="width:50px;height:5px">
                  <div class="progress-fill ${f.morale >= 70 ? 'high' : f.morale >= 40 ? 'medium' : 'low'}" style="width:${f.morale}%"></div>
                </div>
              </div>
              <div class="text-xs mt-2" style="color:var(--text-secondary)">Treino da semana: <strong>${focusMeta.icon} ${focusMeta.label}</strong></div>
            </div>
          `;
        }).join('')}
        ${team.length < gym.maxTeamSize ? `
          <div class="card stat-card stat-card--span-4" data-nav="market" style="cursor:pointer;display:flex;align-items:center;justify-content:center;min-height:120px;border-style:dashed">
            <div class="text-center">
              <div style="font-size:1.5rem">➕</div>
              <div class="text-sm text-muted">Recrutar lutador (${team.length}/${gym.maxTeamSize})</div>
            </div>
          </div>
        ` : ''}
      </div>
      <div class="text-xs text-muted mb-4">Ajuste o foco de treino de cada atleta em <strong>Minha Equipe</strong>.</div>
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
                  ${hasBooking ? '<span class="badge badge-success" style="font-size:0.6rem">SEU ATLETA NO CARD</span>' : ''}
                </div>
                <span class="text-xs text-muted">${weeksOut <= 0 ? 'esta semana' : `em ${weeksOut} sem`}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // ===== Ranking de Academias — a rivalidade que dá gás pra competir =====
    const standingsHtml = data.gymStandings ? `
      <div class="section-label" data-reveal>Rivalidade</div>
      <div class="card mb-4" data-reveal>
        <div class="card-header"><span class="card-title">Ranking de Academias</span></div>
        <div data-reveal-stagger>
          ${data.gymStandings.map((s, i) => `
            <div class="flex items-center justify-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold" style="color:${i === 0 ? 'var(--gold)' : 'var(--text-muted)'}">#${i + 1}</span>
                <span class="text-sm ${s.isPlayer ? 'font-bold' : ''}">${s.name}</span>
                ${s.isPlayer ? '<span class="badge badge-info" style="font-size:0.6rem">VOCÊ</span>' : ''}
              </div>
              <span class="text-xs text-muted">${s.reputation} rep</span>
            </div>
          `).join('')}
        </div>
        <div class="text-xs text-muted mt-2">Academias rivais disputam os mesmos agentes livres e podem seduzir atletas com moral baixa. Mantenha o time motivado.</div>
      </div>
    ` : '';

    // ===== Objetivos =====
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
                ${main ? `<span class="text-xs text-muted ml-2">${main.winnerName} venceu por ${main.method}</span>` : ''}
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
          <div class="stat-value ${gym.cash < 0 ? 'text-danger' : ''}">${formatCurrency(gym.cash)}</div>
          <div class="stat-label">Disponível</div>
        </div>
        <div class="stat-card stat-card--span-3">
          <div class="card-header"><span class="card-title">Reputação</span></div>
          <div class="stat-value">${gym.reputation}</div>
          <div class="stat-label">
            <div class="progress-bar mt-2">
              <div class="progress-fill ${gym.reputation >= 70 ? 'high' : gym.reputation >= 40 ? 'medium' : 'low'}" style="width:${gym.reputation}%"></div>
            </div>
          </div>
        </div>
        <div class="stat-card stat-card--span-3">
          <div class="card-header"><span class="card-title">Cartel da Equipe</span></div>
          <div class="stat-value">${gym.wins}-${gym.losses}</div>
          <div class="stat-label">Vitórias-Derrotas</div>
        </div>
        <div class="stat-card stat-card--span-3">
          <div class="card-header"><span class="card-title">Comissões</span></div>
          <div class="stat-value" style="font-size:1.4rem">${formatCurrency(gym.totalPurseEarnings)}</div>
          <div class="stat-label">Total em bolsas</div>
        </div>
      </div>

      ${offersHtml}
      ${sponsorsHtml}
      ${bookingsHtml}
      ${teamHtml}

      <!-- Academia — link rápido para estrutura/treinadores/olheiro -->
      <div class="card mb-4" data-reveal>
        <div class="card-header">
          <span class="card-title">🏋️ ${gym.facility.name} · Nível ${gym.level}</span>
          <button class="btn btn-sm btn-secondary" data-nav="academy">Gerenciar Academia</button>
        </div>
        <div class="flex items-center gap-2" style="flex-wrap:wrap">
          <span class="badge badge-info">${gym.hiredCoachCount}/${gym.facility.coachSlots} treinadores</span>
          <span class="badge ${gym.scoutLevel > 0 ? 'badge-success' : 'badge-warning'}">${gym.scoutLevel > 0 ? 'Olheiro ativo' : 'Sem olheiro'}</span>
          <span class="text-xs text-muted">+${Math.round(gym.facility.trainingBonus * 100)}% de ganho no treino</span>
        </div>
      </div>

      ${worldHtml}
      ${standingsHtml}
      ${milestonesHtml}
      ${resultsHtml}
    `;
  }
}
