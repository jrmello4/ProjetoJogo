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
        <button class="btn btn-secondary auto-matchmaker" id="autoMatchmakerBtn">🎲 Auto-Matchmaker</button>
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
            <button class="btn btn-sm btn-secondary add-fight" data-card="main">+ Adicionar Luta</button>
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
            <button class="btn btn-sm btn-secondary add-fight" data-card="prelim">+ Adicionar Luta</button>
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

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Card</th>
              <th>Luta</th>
              <th>Vencedor</th>
              <th>Método</th>
              <th>Round</th>
            </tr>
          </thead>
          <tbody>
            ${results.map((r, i) => `
              <tr>
                <td><span class="badge ${i < 2 ? 'badge-info' : 'badge-warning'}">${i < 2 ? 'Main' : 'Prelim'}</span></td>
                <td>${r.fighterAName} <span class="text-muted">vs</span> ${r.fighterBName}</td>
                <td class="font-bold text-success">${r.winnerName}</td>
                <td>${r.method}</td>
                <td>R${r.round}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="flex gap-2 mt-4">
        <button class="btn btn-primary event-back">Voltar aos Eventos</button>
      </div>
    `;
  }
}
