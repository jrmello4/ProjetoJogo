import { formatCurrency, getWeightClassShort, getNationalityFlag } from '../utils/helpers.js';

const WEIGHT_CLASSES = [
  'Strawweight', 'Flyweight', 'Bantamweight', 'Featherweight',
  'Lightweight', 'Welterweight', 'Middleweight', 'Light Heavyweight', 'Heavyweight',
];

export class MarketView {
  static render(fighters, filter = '') {
    const filtered = filter
      ? fighters.filter(f => f.weightClass === filter)
      : fighters;

    const sorted = [...filtered].sort((a, b) => b.overallRating - a.overallRating);

    if (sorted.length === 0) {
      return `
        <div class="page-header">
          <h2>Mercado</h2>
          <p>Agentes Livres</p>
        </div>
        <div class="empty-state">
          <p>Nenhum agente livre disponível.</p>
        </div>
      `;
    }

    return `
      <div class="page-header">
        <h2>Mercado</h2>
        <p>${sorted.length} agentes livres disponíveis</p>
      </div>

      <div class="flex gap-2 mb-4" style="flex-wrap:wrap">
        <button class="btn btn-sm ${!filter ? 'btn-primary' : 'btn-secondary'} market-filter" data-filter="">Todos</button>
        ${WEIGHT_CLASSES.map(wc => `
          <button class="btn btn-sm ${filter === wc ? 'btn-primary' : 'btn-secondary'} market-filter" data-filter="${wc}">
            ${getWeightClassShort(wc)}
          </button>
        `).join('')}
        <button class="btn btn-sm btn-secondary market-refresh">🔄 Renovar</button>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Lutador</th>
              <th>Nacionalidade</th>
              <th>Divisão</th>
              <th>Recorde</th>
              <th>OVR</th>
              <th>STR</th>
              <th>GRP</th>
              <th>Cardio</th>
              <th>IQ</th>
              <th>Idade</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(f => `
              <tr>
                <td>
                  <span class="font-bold fighter-row" data-id="${f.id}">${f.name}</span>
                </td>
                <td>${getNationalityFlag(f.nationality.code)} ${f.nationality.name}</td>
                <td><span class="badge badge-info">${getWeightClassShort(f.weightClass)}</span></td>
                <td class="font-bold">${f.record.wins}-${f.record.losses}-${f.record.draws}</td>
                <td class="font-bold">${f.overallRating}</td>
                <td>${Math.round(f.strikingScore)}</td>
                <td>${Math.round(f.grapplingScore)}</td>
                <td>${f.attributes.cardio}</td>
                <td>${f.attributes.fightIQ}</td>
                <td>${f.age} anos</td>
                <td>
                  <button class="btn btn-sm btn-success market-hire" data-id="${f.id}">Contratar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  static renderHireModal(fighter) {
    const basePurse = Math.round(fighter.overallRating * 200 + 5000);

    return `
      <div class="modal-overlay" id="hireModal">
        <div class="modal">
          <div class="modal-header">
            <h3>Contratar ${fighter.name}</h3>
            <button class="modal-close" data-close="hireModal">&times;</button>
          </div>

          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div class="text-xs text-muted">Divisão</div>
              <div class="text-sm">${fighter.weightClass}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Recorde</div>
              <div class="text-sm">${fighter.record.wins}-${fighter.record.losses}-${fighter.record.draws}</div>
            </div>
            <div>
              <div class="text-xs text-muted">OVR</div>
              <div class="text-sm font-bold">${fighter.overallRating}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Idade</div>
              <div class="text-sm">${fighter.age} anos</div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Bolsa por Luta</label>
            <input type="number" class="form-input" id="hirePurse" value="${basePurse}" min="5000" step="1000">
          </div>

          <div class="form-group">
            <label class="form-label">Duração (lutas)</label>
            <select class="form-select" id="hireDuration">
              <option value="1">1 luta</option>
              <option value="3" selected>3 lutas</option>
              <option value="5">5 lutas</option>
              <option value="10">10 lutas</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Bônus de Vitória</label>
            <input type="number" class="form-input" id="hireBonus" value="${Math.round(basePurse * 0.5)}" min="0" step="1000">
          </div>

          <div class="card mt-2" style="background:var(--bg-tertiary)">
            <div class="flex justify-between">
              <span class="text-sm text-muted">Custo total estimado:</span>
              <span class="text-sm font-bold" id="hireTotalCost">${formatCurrency(basePurse * 3 + Math.round(basePurse * 0.5) * 3)}</span>
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn btn-secondary" data-close="hireModal">Cancelar</button>
            <button class="btn btn-success market-confirm-hire" data-id="${fighter.id}">Confirmar Contratação</button>
          </div>
        </div>
      </div>
    `;
  }
}
