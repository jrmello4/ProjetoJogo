import { formatCurrency, formatDateShort, getWeightClassShort } from '../utils/helpers.js';

export class DashboardView {
  static render(data, weekLabel, saveInfo) {
    const { organization, roster, upcomingEvents, pastEvents, champions } = data;

    const lastEvent = pastEvents[0];
    const lastProfit = lastEvent ? lastEvent.revenue - lastEvent.expenses : 0;

    const topFighters = [...roster].sort((a, b) => b.overallRating - a.overallRating).slice(0, 5);

    let championsHtml = '';
    const champEntries = Object.entries(champions);
    if (champEntries.length > 0) {
      championsHtml = `
        <div class="section-label" data-reveal>Campeões</div>
        <div class="card mb-4" data-reveal>
          <div class="card-header">
            <span class="card-title">Campeões por Divisão</span>
          </div>
          <div class="grid grid-cols-3 gap-2" data-reveal-stagger>
            ${champEntries.slice(0, 9).map(([wc, champ]) => `
              <div class="flex items-center gap-2">
                <span class="badge badge-info">${getWeightClassShort(wc)}</span>
                <span class="text-sm">${champ ? champ.name : '—'}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    let nextEventHtml = '';
    if (upcomingEvents.length > 0) {
      const next = upcomingEvents[0];
      nextEventHtml = `
        <div class="card stat-card stat-card--span-6" data-reveal>
          <div class="card-header">
            <span class="card-title">Próximo Evento</span>
            <span class="badge badge-warning">${formatDateShort(next.date)}</span>
          </div>
          <div class="stat-value" style="font-size:1.5rem">${next.name}</div>
          <div class="stat-label">${next.totalFights} lutas no card</div>
        </div>
      `;
    } else {
      nextEventHtml = `
        <div class="card stat-card stat-card--span-6" data-reveal>
          <div class="card-header">
            <span class="card-title">Próximo Evento</span>
          </div>
          <div class="text-center text-muted text-sm">Nenhum evento agendado</div>
        </div>
      `;
    }

    let lastResultHtml = '';
    if (lastEvent) {
      lastResultHtml = `
        <div class="card stat-card stat-card--span-6" data-reveal>
          <div class="card-header">
            <span class="card-title">Último Evento</span>
            <span class="badge ${lastProfit >= 0 ? 'badge-success' : 'badge-danger'}">
              ${lastProfit >= 0 ? '+' : ''}${formatCurrency(lastProfit)}
            </span>
          </div>
          <div class="stat-value" style="font-size:1.5rem">${lastEvent.name}</div>
          <div class="stat-label">
            Receita: ${formatCurrency(lastEvent.revenue)} · Despesa: ${formatCurrency(lastEvent.expenses)}
          </div>
        </div>
      `;
    }

    let topFightersHtml = '';
    if (topFighters.length > 0) {
      topFightersHtml = `
        <div class="section-label" data-reveal>Elenco</div>
        <div class="card" data-reveal>
          <div class="card-header">
            <span class="card-title">Top do Elenco</span>
          </div>
          <div data-reveal-stagger>
            ${topFighters.map((f, i) => `
              <div class="flex items-center justify-between" style="padding:0.75rem 0;border-bottom:1px solid var(--border)" data-fighter-click="${f.id}">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold" style="color:var(--accent)">#${i + 1}</span>
                  <span class="text-sm font-bold">${f.name}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="badge badge-info">${getWeightClassShort(f.weightClass)}</span>
                  <span class="text-xs text-muted">${f.record.wins}-${f.record.losses}-${f.record.draws}</span>
                  <span class="text-xs font-bold">${f.overallRating} OVR</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return `
      <!-- Cinematic Hero — Three.js Octagon -->
      <section class="hero-section">
        <div class="hero-arena">
          <div class="arena-container" id="octagonArena">
            <div class="arena-hint">Arraste para rotacionar</div>
          </div>
        </div>
        <div class="hero-content">
          <div class="hero-rive">
            <div class="rive-slot rive-slot--hero" data-rive="octagon"></div>
          </div>
          <div>
            <div class="hero-eyebrow">${weekLabel}</div>
            <h1 class="hero-title">${organization.name}</h1>
            <p class="hero-subtitle">Arena principal com ${roster.length} lutadores. Gerencie contratos, monte cards e domine o cenário do MMA.</p>
          </div>
          <div class="hero-actions">
            <button class="btn btn-primary week-advance" id="weekAdvanceBtn">
              <span class="rive-slot" data-rive="week"></span>
              Avançar Semana
            </button>
            <button class="btn btn-secondary save-load" id="saveLoadBtn">Salvar / Carregar</button>
          </div>
        </div>
      </section>

      <!-- Weekly Focus -->
      <div class="section-label" data-reveal>Foco Semanal</div>
      <div class="card mb-4" data-reveal>
        <div class="card-header">
          <span class="card-title">Foco da Semana</span>
        </div>
        <div class="flex gap-2" style="flex-wrap:wrap">
          <button class="btn btn-sm ${data.weeklyFocus === 'striking' ? 'btn-primary' : 'btn-secondary'} weekly-focus" data-focus="striking">Striking</button>
          <button class="btn btn-sm ${data.weeklyFocus === 'grappling' ? 'btn-primary' : 'btn-secondary'} weekly-focus" data-focus="grappling">Grappling</button>
          <button class="btn btn-sm ${data.weeklyFocus === 'cardio' ? 'btn-primary' : 'btn-secondary'} weekly-focus" data-focus="cardio">Cardio</button>
          <button class="btn btn-sm ${data.weeklyFocus === 'recovery' ? 'btn-primary' : 'btn-secondary'} weekly-focus" data-focus="recovery">Recuperação</button>
        </div>
        <div class="text-xs text-muted mt-2">O foco da semana define qual atributo seus lutadores treinam mais.</div>
      </div>

      <!-- Bento Stats Grid -->
      <div class="section-label" data-reveal>Visão Geral</div>
      <div class="bento-grid mb-4" data-reveal-stagger>
        <div class="stat-card stat-card--span-3">
          <div class="card-header">
            <span class="card-title">Saldo</span>
          </div>
          <div class="stat-value">${formatCurrency(organization.money)}</div>
          <div class="stat-label">Disponível</div>
        </div>
        <div class="stat-card stat-card--span-3">
          <div class="card-header">
            <span class="card-title">Reputação</span>
          </div>
          <div class="stat-value">${organization.reputation}</div>
          <div class="stat-label">
            <div class="progress-bar mt-2">
              <div class="progress-fill ${organization.reputation >= 70 ? 'high' : organization.reputation >= 40 ? 'medium' : 'low'}" style="width:${organization.reputation}%"></div>
            </div>
          </div>
        </div>
        <div class="stat-card stat-card--span-3">
          <div class="card-header">
            <span class="card-title">Elenco</span>
          </div>
          <div class="stat-value">${roster.length}</div>
          <div class="stat-label">Lutadores</div>
        </div>
        <div class="stat-card stat-card--span-3">
          <div class="card-header">
            <span class="card-title">Eventos</span>
          </div>
          <div class="stat-value">${organization.eventsHosted}</div>
          <div class="stat-label">Realizados</div>
        </div>
      </div>

      <div class="bento-grid mb-4" data-reveal-stagger>
        <div class="stat-card stat-card--span-4">
          <div class="card-header">
            <span class="card-title">Elenco</span>
          </div>
          <div class="stat-value">${saveInfo.rosterSize}</div>
          <div class="stat-label">Contratados</div>
        </div>
        <div class="stat-card stat-card--span-4">
          <div class="card-header">
            <span class="card-title">Mercado</span>
          </div>
          <div class="stat-value">${saveInfo.freeAgents}</div>
          <div class="stat-label">Agentes livres</div>
        </div>
        <div class="stat-card stat-card--span-4">
          <div class="card-header">
            <span class="card-title">Histórico</span>
          </div>
          <div class="stat-value">${saveInfo.totalEvents}</div>
          <div class="stat-label">Eventos totais</div>
        </div>
      </div>

      ${data.milestones ? (() => {
        const pending = data.milestones.filter(m => !m.unlocked).slice(0, 3);
        if (pending.length === 0) return '';
        return `
        <div class="section-label" data-reveal>Objetivos</div>
        <div class="card mb-4" data-reveal>
          <div class="card-header">
            <span class="card-title">Próximos Objetivos</span>
          </div>
          ${pending.map(m => `
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
        </div>`;
      })() : ''}

      <div class="section-label" data-reveal>Eventos</div>
      <div class="bento-grid mb-4">
        ${nextEventHtml}
        ${lastResultHtml}
        ${data.orgStandings ? `
        <div class="card stat-card stat-card--span-12" data-reveal>
          <div class="card-header">
            <span class="card-title">Ranking de Organizações</span>
          </div>
          <div data-reveal-stagger>
            ${data.orgStandings.map((o, i) => `
              <div class="flex items-center justify-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold" style="color:${i === 0 ? 'var(--gold)' : 'var(--text-muted)'}">#${i + 1}</span>
                  <span class="text-sm ${o.isPlayer ? 'font-bold' : ''}">${o.name}</span>
                  ${o.isPlayer ? '<span class="badge badge-info" style="font-size:0.6rem">VOCÊ</span>' : ''}
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-xs">${o.rep} rep</span>
                  <span class="text-xs text-muted">${o.events} eventos</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
      </div>

      ${championsHtml}

      <div class="mt-4">
        ${topFightersHtml}
      </div>
    `;
  }
}
