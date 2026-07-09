import { formatDate, getWeightClassName, formatCurrency } from '../utils/helpers.js';

// G5: Cerimônia de aposentadoria — exibe a carreira completa do atleta que
// pendurou as luvas, com destaques, estatísticas e um banner de despedida.
export class RetirementCeremonyView {
  static render(entry) {
    const stats = entry.careerStats || {};
    const totalFights = (stats.finishes || 0) + (stats.decisions?.length || 0);

    return `
      <div class="page-header">
        <h2>🏆 Aposentadoria</h2>
        <p>${entry.name} pendurou as luvas</p>
      </div>

      <div class="card" style="text-align:center;padding:2rem;background:linear-gradient(135deg,var(--bg),#1a1a2e);border:2px solid var(--belt)">
        <div style="font-size:3rem;margin-bottom:0.5rem">🏆</div>
        <h1 style="font-size:1.75rem;margin-bottom:0.25rem">${entry.name}</h1>
        <p class="text-muted">${getWeightClassName(entry.weightClass)} · ${entry.nationality} · ${stats.ageAtInduction} anos</p>

        <div class="grid grid-cols-3 gap-3" style="max-width:400px;margin:1.5rem auto">
          <div>
            <div class="stat-value">${entry.record.wins}-${entry.record.losses}-${entry.record.draws}</div>
            <div class="text-xs text-muted">Recorde</div>
          </div>
          <div>
            <div class="stat-value">${entry.peakRating}</div>
            <div class="text-xs text-muted">OVR Pico</div>
          </div>
          <div>
            <div class="stat-value">${(stats.titlesWon || 0)}</div>
            <div class="text-xs text-muted">Cinturões</div>
          </div>
        </div>

        <p class="text-muted" style="font-style:italic;max-width:500px;margin:1rem auto">
          "${entry.name} se despede do esporte após ${totalFights} lutas,
          deixando um legado de ${entry.record.wins} vitórias e
          ${(entry.achievements || []).length} conquistas históricas.
          O mundo do MMA não será o mesmo."
        </p>

        <div style="margin-top:1.5rem">
          <button class="btn btn-secondary" id="viewFullCareerBtn" data-fighter-id="${entry.fighterId}">Ver Carreira Completa</button>
          <button class="btn btn-secondary" id="backToHallBtn" style="margin-left:0.5rem">Hall da Fama</button>
        </div>
      </div>

      <!-- Destaques da carreira -->
      <div class="card mt-4">
        <div class="card-header">
          <span class="card-title">📊 Estatísticas da Carreira</span>
        </div>
        <div class="grid grid-cols-2 gap-4 mt-2" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
          <div>
            <div class="text-xs text-muted">Lutas Totais</div>
            <div class="font-bold text-lg">${totalFights}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Finalizações</div>
            <div class="font-bold text-lg">${stats.finishes || 0} (${stats.finishRate || 0}%)</div>
          </div>
          <div>
            <div class="text-xs text-muted">Nocaute/TKO</div>
            <div class="font-bold text-lg">${stats.kos?.length || 0}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Finalizações (Sub)</div>
            <div class="font-bold text-lg">${stats.subs?.length || 0}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Decisões</div>
            <div class="font-bold text-lg">${stats.decisions?.length || 0}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Maior Streak</div>
            <div class="font-bold text-lg">${stats.maxWinStreak || 0}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Cinturões Conquistados</div>
            <div class="font-bold text-lg">${stats.titlesWon || 0}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Bônus de Luta</div>
            <div class="font-bold text-lg">${(stats.fightNightBonuses || 0) + (stats.performanceBonuses || 0)}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Ganhos na Carreira</div>
            <div class="font-bold text-lg">${formatCurrency(stats.careerEarnings || 0)}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Induzido ao Hall da Fama</div>
            <div class="font-bold text-lg">${formatDate(entry.inductionDate)}</div>
          </div>
        </div>
      </div>

      ${stats.belts?.length > 0 ? `
      <div class="card mt-4">
        <div class="card-header">
          <span class="card-title">🏆 Cinturões</span>
        </div>
        <div class="flex gap-2 flex-wrap mt-2">
          ${stats.belts.map(b => `
            <span class="badge badge-warning" style="font-size:0.7rem">${b.promotionShort || b.name} — ${getWeightClassName(b.weightClass)}</span>
          `).join('')}
        </div>
      </div>` : ''}

      ${(entry.achievements || []).length > 0 ? `
      <div class="card mt-4">
        <div class="card-header">
          <span class="card-title">🏅 Conquistas</span>
        </div>
        <div class="flex gap-1 flex-wrap mt-2">
          ${entry.achievements.map(a => `
            <span class="badge badge-success" style="font-size:0.7rem">${a}</span>
          `).join('')}
        </div>
      </div>` : ''}
    `;
  }
}
