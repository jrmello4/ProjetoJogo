import { getWeightClassLabel, getNationalityFlag } from '../utils/helpers.js';

const DIVISION_ORDER = [
  'Heavyweight', 'Light Heavyweight', 'Middleweight', 'Welterweight',
  'Lightweight', 'Featherweight', 'Bantamweight', 'Flyweight', 'Strawweight',
];

export class RankingsView {
  static render(rankings) {
    // Agrupa por divisão preservando a ordem do ranking global
    const byDivision = {};
    for (const entry of rankings) {
      const wc = entry.fighter.weightClass;
      if (!byDivision[wc]) byDivision[wc] = [];
      byDivision[wc].push(entry);
    }

    const divisions = DIVISION_ORDER.filter(wc => byDivision[wc]?.length > 0);

    if (divisions.length === 0) {
      return `
        <div class="page-header">
          <h2>Rankings</h2>
          <p>Classificação oficial por divisão</p>
        </div>
        <div class="empty-state">
          <p>Nenhum lutador ranqueado ainda. Realize eventos para gerar o ranking.</p>
          <button class="btn btn-primary mt-4" onclick="window.dispatchEvent(new CustomEvent('navigate',{detail:{view:'events'}}))">Ir para Eventos</button>
        </div>
      `;
    }

    const divisionsHtml = divisions.map(wc => {
      const entries = byDivision[wc].slice(0, 11); // campeão + top 10
      const [champ, ...contenders] = entries;

      const streakOf = (f) => {
        let s = 0;
        for (const fight of f.fights) {
          if (fight.won) s++;
          else break;
        }
        return s;
      };

      const champStreak = streakOf(champ.fighter);

      return `
        <div class="rank-division" data-reveal>
          <div class="rank-division-header">
            <span class="rank-division-title">${getWeightClassLabel(wc)}</span>
            <span class="text-xs text-muted">${byDivision[wc].length} lutadores ativos</span>
          </div>

          <div class="rank-champion" data-fighter-click="${champ.fighter.id}">
            <span class="rank-belt">🏆</span>
            <div style="flex:1">
              <div class="rank-champion-label">Campeão</div>
              <div class="rank-champion-name">${champ.fighter.name}</div>
            </div>
            <div class="text-xs text-muted" style="text-align:right">
              ${champ.fighter.record.wins}-${champ.fighter.record.losses}-${champ.fighter.record.draws}
              ${champStreak >= 2 ? `<div class="rank-streak">${champStreak} vitórias seguidas</div>` : ''}
            </div>
            ${champ.fighter.organizationId === 'org-001' ? '<span class="badge badge-info">SEU ATLETA</span>' : ''}
          </div>

          <div class="card" style="padding:0.5rem 0.25rem">
            ${contenders.map((c, i) => `
              <div class="rank-row ${c.fighter.organizationId === 'org-001' ? 'rank-row--mine' : ''}" data-fighter-click="${c.fighter.id}">
                <span class="rank-number">#${i + 1}</span>
                <span class="text-sm font-bold" style="flex:1">
                  ${c.fighter.nationality?.code ? getNationalityFlag(c.fighter.nationality.code) + ' ' : ''}${c.fighter.name}
                  ${c.fighter.organizationId === 'org-001' ? '<span class="badge badge-info ml-2" style="font-size:0.6rem">SEU</span>' : ''}
                </span>
                <span class="text-xs text-muted">${c.fighter.record.wins}-${c.fighter.record.losses}-${c.fighter.record.draws}</span>
                <span class="text-xs font-bold" style="width:3.5rem;text-align:right">${c.fighter.overallRating} OVR</span>
              </div>
            `).join('')}
            ${contenders.length === 0 ? '<div class="text-center text-muted text-sm" style="padding:0.75rem">Sem desafiantes ranqueados</div>' : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="page-header">
        <h2>Rankings</h2>
        <p>Classificação oficial por divisão — campeões e top 10</p>
      </div>
      ${divisionsHtml}
    `;
  }
}
