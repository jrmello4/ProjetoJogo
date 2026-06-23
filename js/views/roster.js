import { getWeightClassShort, getNationalityFlag } from '../utils/helpers.js';

const WEIGHT_CLASSES = [
  'Strawweight', 'Flyweight', 'Bantamweight', 'Featherweight',
  'Lightweight', 'Welterweight', 'Middleweight', 'Light Heavyweight', 'Heavyweight',
];

export class RosterView {
  static render(fighters, filter = '') {
    const filtered = filter
      ? fighters.filter(f => f.weightClass === filter)
      : fighters;

    const sorted = [...filtered].sort((a, b) => b.overallRating - a.overallRating);

    if (sorted.length === 0) {
      return `
        <div class="page-header">
          <h2>Elenco</h2>
          <p>Lutadores da sua organização</p>
        </div>
        <div class="empty-state">
          <p>Nenhum lutador no elenco.</p>
        </div>
      `;
    }

    return `
      <div class="page-header">
        <h2>Elenco</h2>
        <p>${sorted.length} lutadores · ${fighters.length} total</p>
      </div>

      <div class="flex gap-2 mb-4" style="flex-wrap:wrap">
        <button class="btn btn-sm ${!filter ? 'btn-primary' : 'btn-secondary'} roster-filter" data-filter="">Todos</button>
        ${WEIGHT_CLASSES.map(wc => `
          <button class="btn btn-sm ${filter === wc ? 'btn-primary' : 'btn-secondary'} roster-filter" data-filter="${wc}">
            ${getWeightClassShort(wc)}
          </button>
        `).join('')}
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Lutador</th>
              <th>Divisão</th>
              <th>Recorde</th>
              <th>OVR</th>
              <th>STR</th>
              <th>GRP</th>
              <th>Cardio</th>
              <th>IQ</th>
              <th>Fadiga</th>
              <th>Moral</th>
              <th>Contrato</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(f => `
              <tr>
                <td>
                  <div class="flex items-center gap-2">
                    <span>${getNationalityFlag(f.nationality.code)}</span>
                    <span class="font-bold fighter-row" data-id="${f.id}">${f.name}</span>
                  </div>
                </td>
                <td><span class="badge badge-info">${getWeightClassShort(f.weightClass)}</span></td>
                <td class="font-bold">${f.record.wins}-${f.record.losses}-${f.record.draws}</td>
                <td class="font-bold">${f.overallRating}</td>
                <td>${Math.round(f.strikingScore)}</td>
                <td>${Math.round(f.grapplingScore)}</td>
                <td>${f.attributes.cardio}</td>
                <td>${f.attributes.fightIQ}</td>
                <td>
                  <div class="flex items-center gap-1">
                    <div class="progress-bar" style="width:40px">
                      <div class="progress-fill ${f.fatigue >= 60 ? 'low' : f.fatigue >= 30 ? 'medium' : 'high'}" style="width:${f.fatigue}%"></div>
                    </div>
                    <span class="text-xs">${f.fatigue}%</span>
                  </div>
                </td>
                <td>
                  <div class="flex items-center gap-1">
                    <div class="progress-bar" style="width:40px">
                      <div class="progress-fill ${f.morale >= 70 ? 'high' : f.morale >= 40 ? 'medium' : 'low'}" style="width:${f.morale}%"></div>
                    </div>
                    <span class="text-xs">${f.morale}%</span>
                  </div>
                </td>
                <td class="text-xs">${f.contract ? `${f.contract.fightsRemaining} lutas` : '—'}</td>
                <td>
                  <button class="btn btn-sm btn-danger roster-fire" data-id="${f.id}">Demitir</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}
