import { formatDate, getWeightClassName } from '../utils/helpers.js';

export class HallOfFameView {
  static render(entries) {
    if (entries.length === 0) {
      return `
        <div class="page-header">
          <h2>Hall da Fama</h2>
          <p>Lutadores imortais da história</p>
        </div>
        <div class="empty-state">
          <p>Nenhum lutador no Hall da Fama ainda.</p>
          <p class="text-xs text-muted">Lutadores são induzidos automaticamente ao atingir marcos históricos.</p>
        </div>
      `;
    }

    const sorted = [...entries].sort((a, b) => b.peakRating - a.peakRating);

    return `
      <div class="page-header">
        <h2>Hall da Fama</h2>
        <p>${sorted.length} lendas imortalizadas</p>
      </div>

      <div class="grid grid-cols-3 gap-4">
        ${sorted.map((entry, i) => `
          <div class="card hof-card">
            <div class="text-center mb-2">
              <span class="text-xs font-bold" style="color:${i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : '#CD7F32'}">
                #${i + 1}
              </span>
            </div>
            <div class="text-center">
              <div class="font-bold text-lg">${entry.name}</div>
              <div class="text-xs text-muted">${entry.nationality?.name || ''} · ${getWeightClassName(entry.weightClass)}</div>
            </div>
            <div class="grid grid-cols-2 gap-2 mt-3">
              <div class="text-center">
                <div class="text-xs text-muted">Recorde</div>
                <div class="font-bold">${entry.record.wins}-${entry.record.losses}-${entry.record.draws}</div>
              </div>
              <div class="text-center">
                <div class="text-xs text-muted">OVR Pico</div>
                <div class="font-bold">${entry.peakRating}</div>
              </div>
            </div>
            <div class="mt-3">
              <div class="text-xs text-muted mb-1">Conquistas</div>
              ${entry.achievements.map(a => `
                <span class="badge badge-success text-xs block mb-1">${a}</span>
              `).join('')}
            </div>
            <div class="text-xs text-muted text-center mt-2">
              Induzido em ${formatDate(entry.inductionDate)}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
}