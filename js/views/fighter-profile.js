import { formatCurrency, formatDate, getWeightClassShort, getNationalityFlag } from '../utils/helpers.js';

export class FighterProfileView {
  static render(fighter, fightHistory = []) {
    const displayHistory = fightHistory.length > 0 ? fightHistory : fighter.fights || [];

    const attrBars = (attrs, label, colorClass) => {
      return `
        <div class="attr-item">
          <div class="attr-label">
            <span>${label}</span>
            <span class="attr-value">${attrs}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${colorClass}" style="width:${attrs}%"></div>
          </div>
        </div>
      `;
    };

    const historyHtml = displayHistory.length > 0
      ? `
        <div class="card">
          <div class="card-header">
            <span class="card-title">Histórico de Lutas</span>
          </div>
          <div class="timeline">
            ${displayHistory.slice(0, 20).map(f => `
              <div class="timeline-item">
                <div class="timeline-date">${formatDate(f.date)}</div>
                <div class="timeline-content">
                  <span class="badge ${f.won ? 'badge-success' : 'badge-danger'}">${f.result}</span>
                  <span class="text-sm"> vs ${f.opponent} — ${f.method} (R${f.round})</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `
      : `
        <div class="card">
          <div class="empty-state">
            <p>Nenhuma luta registrada.</p>
          </div>
        </div>
      `;

    const contractHtml = fighter.contract
      ? `
        <div class="card">
          <div class="card-header">
            <span class="card-title">Contrato</span>
          </div>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <div class="text-xs text-muted">Bolsa/Luta</div>
              <div class="text-sm font-bold">${formatCurrency(fighter.contract.pursePerFight)}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Lutas Restantes</div>
              <div class="text-sm font-bold">${fighter.contract.fightsRemaining}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Bônus Vitória</div>
              <div class="text-sm font-bold">${formatCurrency(fighter.contract.victoryBonus)}</div>
            </div>
          </div>
        </div>
      `
      : '';

    return `
      <div class="page-header">
        <h2>${getNationalityFlag(fighter.nationality.code)} ${fighter.name}</h2>
        <p>${fighter.nationality.name} · ${fighter.age} anos · ${fighter.fightingStyle}</p>
      </div>

      <div class="grid grid-cols-4 mb-4">
        <div class="card">
          <div class="card-title">Recorde</div>
          <div class="stat-value">${fighter.record.wins}-${fighter.record.losses}-${fighter.record.draws}</div>
          <div class="stat-label">${fighter.totalFights} lutas · ${fighter.winRate.toFixed(1)}% win rate</div>
        </div>
        <div class="card">
          <div class="card-title">OVR</div>
          <div class="stat-value">${fighter.overallRating}</div>
          <div class="stat-label">Overall Rating</div>
        </div>
        <div class="card">
          <div class="card-title">Divisão</div>
          <div class="stat-value" style="font-size:1.25rem">${getWeightClassShort(fighter.weightClass)}</div>
          <div class="stat-label">${fighter.weightClass}</div>
        </div>
        <div class="card">
          <div class="card-title">Status</div>
          <div class="stat-value" style="font-size:1.25rem">
            <span class="badge ${fighter.status === 'roster' ? 'badge-success' : 'badge-warning'}">${fighter.status === 'roster' ? 'Contratado' : 'Agente Livre'}</span>
          </div>
          <div class="stat-label">Fadiga: ${fighter.fatigue}% · Moral: ${fighter.morale}%</div>
        </div>
      </div>

      <div class="grid grid-cols-2 mb-4">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Atributos</span>
          </div>
          <div class="attr-grid">
            ${attrBars(fighter.attributes.boxing, 'Boxing', fighter.attributes.boxing >= 70 ? 'high' : fighter.attributes.boxing >= 40 ? 'medium' : 'low')}
            ${attrBars(fighter.attributes.kickboxing, 'Kickboxing', fighter.attributes.kickboxing >= 70 ? 'high' : fighter.attributes.kickboxing >= 40 ? 'medium' : 'low')}
            ${attrBars(fighter.attributes.muayThai, 'Muay Thai', fighter.attributes.muayThai >= 70 ? 'high' : fighter.attributes.muayThai >= 40 ? 'medium' : 'low')}
            ${attrBars(fighter.attributes.wrestling, 'Wrestling', fighter.attributes.wrestling >= 70 ? 'high' : fighter.attributes.wrestling >= 40 ? 'medium' : 'low')}
            ${attrBars(fighter.attributes.bjj, 'BJJ', fighter.attributes.bjj >= 70 ? 'high' : fighter.attributes.bjj >= 40 ? 'medium' : 'low')}
            ${attrBars(fighter.attributes.cardio, 'Cardio', fighter.attributes.cardio >= 70 ? 'high' : fighter.attributes.cardio >= 40 ? 'medium' : 'low')}
            ${attrBars(fighter.attributes.chin, 'Chin', fighter.attributes.chin >= 70 ? 'high' : fighter.attributes.chin >= 40 ? 'medium' : 'low')}
            ${attrBars(fighter.attributes.fightIQ, 'Fight IQ', fighter.attributes.fightIQ >= 70 ? 'high' : fighter.attributes.fightIQ >= 40 ? 'medium' : 'low')}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">Estatísticas</span>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <div class="text-xs text-muted">Técnica</div>
              <div class="text-sm font-bold">${Math.round(fighter.techniqueScore)}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Striking</div>
              <div class="text-sm font-bold">${Math.round(fighter.strikingScore)}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Grappling</div>
              <div class="text-sm font-bold">${Math.round(fighter.grapplingScore)}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Média Atributos</div>
              <div class="text-sm font-bold">${Math.round(fighter.averageSkill)}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Taxa de Vitória</div>
              <div class="text-sm font-bold">${fighter.winRate.toFixed(1)}%</div>
            </div>
            <div>
              <div class="text-xs text-muted">Estilo</div>
              <div class="text-sm font-bold">${fighter.fightingStyle}</div>
            </div>
          </div>

          <div class="mt-4">
            <div class="card-title mb-2">Fadiga</div>
            <div class="progress-bar" style="height:10px">
              <div class="progress-fill ${fighter.fatigue >= 60 ? 'low' : fighter.fatigue >= 30 ? 'medium' : 'high'}" style="width:${fighter.fatigue}%"></div>
            </div>
            <div class="text-xs text-muted mt-2">${fighter.fatigue}%</div>
          </div>

          <div class="mt-4">
            <div class="card-title mb-2">Moral</div>
            <div class="progress-bar" style="height:10px">
              <div class="progress-fill ${fighter.morale >= 70 ? 'high' : fighter.morale >= 40 ? 'medium' : 'low'}" style="width:${fighter.morale}%"></div>
            </div>
            <div class="text-xs text-muted mt-2">${fighter.morale}%</div>
          </div>
        </div>
      </div>

      ${contractHtml}

      <div class="mt-4">
        ${historyHtml}
      </div>

      <div class="flex gap-2 mt-4">
        <button class="btn btn-secondary fighter-back">Voltar</button>
      </div>
    `;
  }
}
