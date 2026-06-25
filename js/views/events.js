import { formatCurrency, formatDate, formatDateShort, getWeightClassShort } from '../utils/helpers.js';

export class EventsView {
  static async render(events, roster, upcomingEvents, seasonService) {
    const weekLabel = seasonService ? await seasonService.getWeekLabel() : 'Semana 1';
    const isWeekBlocked = seasonService ? await seasonService.isWeekBlocked() : false;
    let upcomingHtml = '';
    if (upcomingEvents.length > 0) {
      upcomingHtml = `
        <div class="card mb-4">
          <div class="card-header">
            <span class="card-title">Eventos Agendados</span>
          </div>
          ${upcomingEvents.map(e => `
            <div class="flex items-center justify-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
              <div>
                <span class="font-bold">${e.name}</span>
                <span class="text-xs text-muted ml-2">${formatDate(e.date)} · ${e.totalFights} lutas</span>
              </div>
              <div class="flex gap-2">
                <button class="btn btn-sm btn-primary event-simulate" data-id="${e.id}">Simular Evento</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    let pastHtml = '';
    if (events.length > 0) {
      pastHtml = `
        <div class="table-container mt-4">
          <table>
            <thead>
              <tr>
                <th>Evento</th>
                <th>Data</th>
                <th>Lutas</th>
                <th>Receita</th>
                <th>Despesa</th>
                <th>Lucro</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${events.map(e => {
                const profit = e.revenue - e.expenses;
                return `
                  <tr>
                    <td class="font-bold">${e.name}</td>
                    <td>${formatDateShort(e.date)}</td>
                    <td>${e.totalFights}</td>
                    <td>${formatCurrency(e.revenue)}</td>
                    <td>${formatCurrency(e.expenses)}</td>
                    <td class="${profit >= 0 ? 'text-success' : 'text-danger'} font-bold">
                      ${profit >= 0 ? '+' : ''}${formatCurrency(profit)}
                    </td>
                    <td><span class="badge ${e.status === 'completed' ? 'badge-success' : 'badge-warning'}">${e.status === 'completed' ? 'Concluído' : 'Agendado'}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    return `
      <div class="page-header">
        <h2>Eventos</h2>
        <p>${weekLabel} ${isWeekBlocked ? '<span class="badge badge-warning">Bloqueado</span>' : ''}</p>
      </div>

      ${isWeekBlocked ? `
        <div class="alert alert-warning mb-4">
          <strong>⚠️ Semana Bloqueada</strong> - Não é possível criar ou simular eventos nesta semana. Avance a semana para continuar.
        </div>
      ` : ''}

      <div class="flex gap-2 mb-4">
        <button class="btn btn-primary event-create">+ Criar Novo Evento</button>
      </div>

      ${upcomingHtml}
      ${pastHtml}
    `;
  }

  static async renderCreateModal(roster, seasonService) {
    const weekLabel = seasonService ? await seasonService.getWeekLabel() : 'Semana 1';
    const isWeekBlocked = seasonService ? await seasonService.isWeekBlocked() : false;

    if (isWeekBlocked) {
      return `
        <div class="alert alert-warning">
          <strong>⚠️ Semana Bloqueada</strong> - Não é possível criar eventos nesta semana.
        </div>
      `;
    }

    const byWeight = {};
    roster.forEach(f => {
      if (!byWeight[f.weightClass]) byWeight[f.weightClass] = [];
      byWeight[f.weightClass].push(f);
    });

    let fighterSelectHtml = '';
    for (const [wc, fighters] of Object.entries(byWeight)) {
      fighterSelectHtml += `
        <optgroup label="${wc}">
          ${fighters.sort((a, b) => b.overallRating - a.overallRating).map(f => `
            <option value="${f.id}">${f.name} (${f.record.wins}-${f.record.losses}-${f.record.draws}) — OVR ${f.overallRating}</option>
          `).join('')}
        </optgroup>
      `;
    }

    return `
      <div class="modal-overlay" id="createEventModal">
        <div class="modal" style="max-width:700px">
          <div class="modal-header">
            <h3>Criar Novo Evento</h3>
            <button class="modal-close" data-close="createEventModal">&times;</button>
          </div>

          <div class="form-group">
            <label class="form-label">Nome do Evento</label>
            <input type="text" class="form-input" id="eventName" placeholder="Ex: Fight Night 1" value="Fight Night ${Date.now().toString().slice(-4)}">
          </div>

          <div class="form-group">
            <label class="form-label">Data</label>
            <input type="date" class="form-input" id="eventDate" value="${new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}">
          </div>

          <div class="mb-4">
            <h4 class="mb-2" style="font-size:0.9rem">Card Principal</h4>
            <div id="mainCardFights">
              <div class="flex gap-2 mb-2 fight-slot" data-slot="main-0">
                <select class="form-select fight-select" data-card="main">${fighterSelectHtml}</select>
                <span class="flex items-center text-muted">vs</span>
                <select class="form-select fight-select" data-card="main">${fighterSelectHtml}</select>
                <button class="btn btn-sm btn-danger remove-fight">&times;</button>
              </div>
            </div>
            <div class="flex gap-2 mb-2">
              <button class="btn btn-sm btn-secondary add-fight" data-card="main">+ Adicionar Luta</button>
              <button class="btn btn-sm btn-primary auto-fill-main">🎯 Auto-Match Card Principal</button>
            </div>
          </div>

          <div class="mb-4">
            <h4 class="mb-2" style="font-size:0.9rem">Card Preliminar</h4>
            <div id="prelimCardFights">
              <div class="flex gap-2 mb-2 fight-slot" data-slot="prelim-0">
                <select class="form-select fight-select" data-card="prelim">${fighterSelectHtml}</select>
                <span class="flex items-center text-muted">vs</span>
                <select class="form-select fight-select" data-card="prelim">${fighterSelectHtml}</select>
                <button class="btn btn-sm btn-danger remove-fight">&times;</button>
              </div>
            </div>
            <div class="flex gap-2 mb-2">
              <button class="btn btn-sm btn-secondary add-fight" data-card="prelim">+ Adicionar Luta</button>
              <button class="btn btn-sm btn-primary auto-fill-prelim">🎯 Auto-Match Card Preliminar</button>
            </div>
          </div>

          <div class="mb-4">
            <button class="btn btn-primary auto-fill-all" style="width:100%">⚡ Auto-Match Completo (Preenche Tudo)</button>
          </div>

          <div class="modal-actions">
            <button class="btn btn-secondary" data-close="createEventModal">Cancelar</button>
            <button class="btn btn-primary event-confirm-create">Criar Evento</button>
          </div>
        </div>
      </div>
    `;
  }

  static renderSimulation(event, results) {
    const bonuses = event.bonuses || [];

    const bonusesHtml = bonuses.length > 0 ? `
      <div class="mb-4">
        ${bonuses.map(b => `
          <div class="card" style="border-top-color:var(--gold,#d4a843);margin-bottom:0.5rem">
            <div class="flex items-center gap-2">
              <span style="font-size:1.5rem">🏆</span>
              <div>
                <div class="font-bold" style="color:var(--gold,#d4a843)">${b.type}</div>
                <div class="text-sm">${b.winner} — bônus de ${formatCurrency(b.amount)}</div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    ` : '';

    return `
      <div class="page-header">
        <h2>${event.name}</h2>
        <p>Resultados — ${formatDate(event.date)}</p>
      </div>

      <div class="grid grid-cols-3 mb-4">
        <div class="card">
          <div class="card-title">Receita</div>
          <div class="stat-value text-success">${formatCurrency(event.revenue)}</div>
        </div>
        <div class="card">
          <div class="card-title">Despesa</div>
          <div class="stat-value text-danger">${formatCurrency(event.expenses)}</div>
        </div>
        <div class="card">
          <div class="card-title">Lucro</div>
          <div class="stat-value ${event.revenue - event.expenses >= 0 ? 'text-success' : 'text-danger'}">
            ${event.revenue - event.expenses >= 0 ? '+' : ''}${formatCurrency(event.revenue - event.expenses)}
          </div>
        </div>
      </div>

      ${bonusesHtml}

      <div class="mb-4">
        ${results.map((r, i) => `
          <div class="card mb-2 fight-result-card" style="cursor:pointer" data-expand="fight-${i}">
            <div class="flex items-center justify-between mb-2">
              <div>
                <span class="badge ${r.card === 'main' ? 'badge-info' : 'badge-warning'}">${r.card === 'main' ? 'Main Card' : 'Prelim'}</span>
                <span class="text-xs text-muted ml-2">${r.method} · R${r.round}</span>
              </div>
              <span class="text-xs text-muted">Clique para detalhes ▼</span>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2" style="flex:1">
                <span class="font-bold ${r.winnerId === r.fighterAId ? 'text-success' : ''}">${r.fighterAName}</span>
                ${r.winnerId === r.fighterAId ? '<span class="badge badge-success" style="font-size:0.65rem">VENCEDOR</span>' : ''}
              </div>
              <span class="text-muted" style="font-size:0.8rem">vs</span>
              <div class="flex items-center gap-2" style="flex:1;text-align:right">
                ${r.winnerId === r.fighterBId ? '<span class="badge badge-success" style="font-size:0.65rem">VENCEDOR</span>' : ''}
                <span class="font-bold ${r.winnerId === r.fighterBId ? 'text-success' : ''}">${r.fighterBName}</span>
              </div>
            </div>

            <!-- Expandable details -->
            <div id="fight-${i}" style="display:none;margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">
              <!-- Round scores -->
              ${r.rounds ? `
              <div class="mb-3">
                <div class="text-xs font-bold mb-1" style="text-transform:uppercase;letter-spacing:0.05em">Scorecards por Round</div>
                <table style="width:100%;font-size:0.8rem">
                  <thead>
                    <tr>
                      <th style="text-align:left">Round</th>
                      <th style="text-align:center">${r.fighterAName}</th>
                      <th style="text-align:center">${r.fighterBName}</th>
                      <th style="text-align:center">Destaque</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${r.rounds.map(rd => `
                      <tr>
                        <td style="text-align:left">${rd.round}</td>
                        <td style="text-align:center;font-weight:bold;color:${rd.scoreA > rd.scoreB ? 'var(--success,#2ecc71)' : ''}">${rd.scoreA}</td>
                        <td style="text-align:center;font-weight:bold;color:${rd.scoreB > rd.scoreA ? 'var(--success,#2ecc71)' : ''}">${rd.scoreB}</td>
                        <td style="text-align:center;font-size:0.75rem">
                          ${rd.knockdownsA > 0 ? '🔴 KD' : ''}
                          ${rd.knockdownsB > 0 ? '🔵 KD' : ''}
                          ${rd.subAttemptsA > 0 ? '🔴 Sub' : ''}
                          ${rd.subAttemptsB > 0 ? '🔵 Sub' : ''}
                          ${rd.finished ? '💥 Finalização' : ''}
                          ${!rd.knockdownsA && !rd.knockdownsB && !rd.subAttemptsA && !rd.subAttemptsB && !rd.finished ? '—' : ''}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              ` : ''}

              <!-- Fight stats -->
              ${r.stats ? `
              <div>
                <div class="text-xs font-bold mb-1" style="text-transform:uppercase;letter-spacing:0.05em">Estatísticas da Luta</div>
                <div class="grid grid-cols-2 gap-2" style="font-size:0.8rem">
                  <div class="card" style="padding:0.5rem">
                    <div class="font-bold">${r.fighterAName}</div>
                    <div class="text-muted">Socos: ${r.stats.sigStrikesA}</div>
                    <div class="text-muted">Quedas: ${r.stats.takedownsA}</div>
                    <div class="text-muted">KDs: ${r.stats.knockdownsA}</div>
                    <div class="text-muted">Subs: ${r.stats.subAttemptsA}</div>
                  </div>
                  <div class="card" style="padding:0.5rem">
                    <div class="font-bold">${r.fighterBName}</div>
                    <div class="text-muted">Socos: ${r.stats.sigStrikesB}</div>
                    <div class="text-muted">Quedas: ${r.stats.takedownsB}</div>
                    <div class="text-muted">KDs: ${r.stats.knockdownsB}</div>
                    <div class="text-muted">Subs: ${r.stats.subAttemptsB}</div>
                  </div>
                </div>
              </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>

      <div class="flex gap-2 mt-4">
        <button class="btn btn-primary event-back">Voltar aos Eventos</button>
      </div>
    `;
  }
}
