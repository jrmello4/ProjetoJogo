import { formatDate, getWeightClassName, formatCurrency } from '../utils/helpers.js';

// G5: Hall da Fama enriquecido com estatísticas de carreira
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

    const sorted = [...entries].sort((a, b) => {
      // Ordenar por: número de cinturões > total de lutas
      const aBelts = a.careerStats?.titlesWon || 0;
      const bBelts = b.careerStats?.titlesWon || 0;
      if (aBelts !== bBelts) return bBelts - aBelts;
      return (b.peakRating || 0) - (a.peakRating || 0);
    });

    return `
      <div class="page-header">
        <h2>Hall da Fama</h2>
        <p>${sorted.length} lendas imortalizadas</p>
      </div>

      <div class="hof-gallery" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:1rem">
        ${sorted.map((entry, i) => `
          <div class="card hof-card" data-reveal>
            <div class="card-header">
              <span class="card-title">
                #${i + 1} · ${entry.name}
                <span class="badge badge-info" style="font-size:0.55rem">${getWeightClassName(entry.weightClass)}</span>
              </span>
            </div>
            <div class="card-body">
              <div class="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div class="text-xs text-muted">Recorde</div>
                  <div class="font-bold text-lg">${entry.record.wins}-${entry.record.losses}-${entry.record.draws}</div>
                </div>
                <div>
                  <div class="text-xs text-muted">OVR Pico</div>
                  <div class="font-bold text-lg">${entry.peakRating}</div>
                </div>
                <div>
                  <div class="text-xs text-muted">Finalizações</div>
                  <div class="font-bold text-lg">${entry.careerStats?.finishRate || 0}%</div>
                </div>
              </div>

              ${entry.careerStats ? `
                <div class="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div>
                    <div class="text-xs text-muted">Cinturões</div>
                    <div class="font-bold">${entry.careerStats.titlesWon}</div>
                  </div>
                  <div>
                    <div class="text-xs text-muted">Maior Streak</div>
                    <div class="font-bold">${entry.careerStats.maxWinStreak}</div>
                  </div>
                  <div>
                    <div class="text-xs text-muted">Ganhos</div>
                    <div class="font-bold" style="font-size:0.75rem">${formatCurrency(entry.careerStats.careerEarnings)}</div>
                  </div>
                </div>
                <div class="grid grid-cols-3 gap-2 mt-2 text-center">
                  <div>
                    <div class="text-xs text-muted">Lutas Totais</div>
                    <div class="font-bold">${(entry.careerStats?.finishes || 0) + (entry.careerStats?.decisions?.length || 0)}</div>
                  </div>
                  <div>
                    <div class="text-xs text-muted">Bônus</div>
                    <div class="font-bold">${(entry.careerStats?.fightNightBonuses || 0) + (entry.careerStats?.performanceBonuses || 0)}</div>
                  </div>
                  <div>
                    <div class="text-xs text-muted">Finalizações</div>
                    <div class="font-bold">KO/TKO: ${entry.careerStats?.kos?.length || 0} · Sub: ${entry.careerStats?.subs?.length || 0}</div>
                  </div>
                </div>
              ` : ''}

              <div class="mt-3">
                <div class="text-xs text-muted mb-1">Conquistas</div>
                <div class="flex gap-1 flex-wrap">
                  ${(entry.achievements || []).map(a =>
                    `<span class="badge badge-success text-xs">${a}</span>`
                  ).join('')}
                </div>
              </div>
            </div>
            <div class="card-footer text-xs text-muted" style="text-align:center">
              Induzido em ${formatDate(entry.inductionDate)} · ${entry.careerStats?.ageAtInduction || '?'} anos
            </div>
          </div>
        `).join('')}
      </div>

      <div class="card" style="margin-top:2rem;padding:1.5rem;text-align:center;border-color:rgba(232,226,217,0.06)">
        <div style="font-family:'Archivo',sans-serif;font-size:1.1rem;font-weight:700;color:#f4f2ef;margin-bottom:0.25rem">
          Construa dinastias. Destrua legados.
        </div>
        <div class="text-xs text-muted" style="margin-bottom:1rem">
          MMA Manager — o simulador que coloca você no córner.
        </div>
        <button class="btn btn-primary btn-sm hall-of-fame-share" data-share="hall-of-fame">
          📤 Compartilhar Minha Jornada
        </button>
        <div class="text-xs" style="margin-top:1rem;color:#4a4438">
          Conhece um fã de MMA? Manda esse link pra ele. 👊
        </div>
      </div>
    `;
  }
}
