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
        <div class="card">
          <div class="card-header">
            <span class="card-title">Campeões por Divisão</span>
          </div>
          <div class="grid grid-cols-3 gap-2">
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
        <div class="card">
          <div class="card-header">
            <span class="card-title">Próximo Evento</span>
            <span class="badge badge-warning">${formatDateShort(next.date)}</span>
          </div>
          <div class="stat-value" style="font-size:1.25rem">${next.name}</div>
          <div class="stat-label">${next.totalFights} lutas no card</div>
        </div>
      `;
    } else {
      nextEventHtml = `
        <div class="card">
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
        <div class="card">
          <div class="card-header">
            <span class="card-title">Último Evento</span>
            <span class="badge ${lastProfit >= 0 ? 'badge-success' : 'badge-danger'}">
              ${lastProfit >= 0 ? '+' : ''}${formatCurrency(lastProfit)}
            </span>
          </div>
          <div class="stat-value" style="font-size:1.25rem">${lastEvent.name}</div>
          <div class="stat-label">
            Receita: ${formatCurrency(lastEvent.revenue)} · Despesa: ${formatCurrency(lastEvent.expenses)}
          </div>
        </div>
      `;
    }

    let topFightersHtml = '';
    if (topFighters.length > 0) {
      topFightersHtml = `
        <div class="card">
          <div class="card-header">
            <span class="card-title">Top do Elenco</span>
          </div>
          ${topFighters.map((f, i) => `
            <div class="flex items-center justify-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border)" data-fighter-click="${f.id}">
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
      `;
    }

    return `
      <div class="page-header">
        <h2>Dashboard</h2>
        <p>${organization.name} — ${weekLabel}</p>
      </div>

      <div class="flex gap-2 mb-4">
        <button class="btn btn-primary week-advance" id="weekAdvanceBtn">📅 Avançar Semana</button>
        <button class="btn btn-secondary save-load" id="saveLoadBtn">💾 Salvar/Carregar</button>
      </div>

      <!-- Weekly Focus -->
      <div class="card mb-4">
        <div class="card-header">
          <span class="card-title">🎯 Foco da Semana</span>
        </div>
        <div class="flex gap-2" style="flex-wrap:wrap">
          <button class="btn btn-sm ${data.weeklyFocus === 'striking' ? 'btn-primary' : 'btn-secondary'} weekly-focus" data-focus="striking">🥊 Striking</button>
          <button class="btn btn-sm ${data.weeklyFocus === 'grappling' ? 'btn-primary' : 'btn-secondary'} weekly-focus" data-focus="grappling">🤼 Grappling</button>
          <button class="btn btn-sm ${data.weeklyFocus === 'cardio' ? 'btn-primary' : 'btn-secondary'} weekly-focus" data-focus="cardio">🏃 Cardio</button>
          <button class="btn btn-sm ${data.weeklyFocus === 'recovery' ? 'btn-primary' : 'btn-secondary'} weekly-focus" data-focus="recovery">💊 Recuperação</button>
        </div>
        <div class="text-xs text-muted mt-2">O foco da semana define qual atributo seus lutadores treinam mais.</div>
      </div>

      <div class="grid grid-cols-3 gap-2 mb-4">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Dados do Jogo</span>
          </div>
          <div class="stat-value">${saveInfo.rosterSize} lutadores</div>
          <div class="stat-label">No elenco</div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">Dados do Jogo</span>
          </div>
          <div class="stat-value">${saveInfo.freeAgents} livres</div>
          <div class="stat-label">Mercado</div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">Dados do Jogo</span>
          </div>
          <div class="stat-value">${saveInfo.totalEvents} eventos</div>
          <div class="stat-label">Histórico</div>
        </div>
      </div>

      ${data.milestones ? (() => {
        const pending = data.milestones.filter(m => !m.unlocked).slice(0, 3);
        if (pending.length === 0) return '';
        return `
        <div class="card mb-4">
          <div class="card-header">
            <span class="card-title">🎯 Próximos Objetivos</span>
          </div>
          ${pending.map(m => `
            <div class="flex items-center justify-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
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

      <div class="grid grid-cols-4 mb-4">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Dinheiro</span>
            <span class="stat-icon">💰</span>
          </div>
          <div class="stat-value">${formatCurrency(organization.money)}</div>
          <div class="stat-label">Saldo disponível</div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">Reputação</span>
            <span class="stat-icon">⭐</span>
          </div>
          <div class="stat-value">${organization.reputation}</div>
          <div class="stat-label">
            <div class="progress-bar mt-2">
              <div class="progress-fill ${organization.reputation >= 70 ? 'high' : organization.reputation >= 40 ? 'medium' : 'low'}" style="width:${organization.reputation}%"></div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">Elenco</span>
            <span class="stat-icon">👥</span>
          </div>
          <div class="stat-value">${roster.length}</div>
          <div class="stat-label">Lutadores contratados</div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">Eventos</span>
            <span class="stat-icon">🏆</span>
          </div>
          <div class="stat-value">${organization.eventsHosted}</div>
          <div class="stat-label">Eventos realizados</div>
        </div>
      </div>

      <div class="grid grid-cols-2 mb-4">
        ${nextEventHtml}

        ${data.orgStandings ? `
        <div class="card">
          <div class="card-header">
            <span class="card-title">🏢 Ranking de Organizações</span>
          </div>
          ${data.orgStandings.map((o, i) => `
            <div class="flex items-center justify-between" style="padding:0.4rem 0;border-bottom:1px solid var(--border)">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold" style="color:${i === 0 ? 'var(--gold,#d4a843)' : 'var(--text-muted)'}">#${i + 1}</span>
                <span class="text-sm ${o.isPlayer ? 'font-bold' : ''}">${o.name}</span>
                ${o.isPlayer ? '<span class="badge badge-info" style="font-size:0.6rem">VOCÊ</span>' : ''}
              </div>
              <div class="flex items-center gap-3">
                <span class="text-xs">⭐${o.rep}</span>
                <span class="text-xs text-muted">${o.events} eventos</span>
              </div>
            </div>
          `).join('')}
        </div>
        ` : ''}
        ${lastResultHtml}
      </div>

      ${championsHtml}

      <div class="mt-4">
        ${topFightersHtml}
      </div>
    `;
  }
}
