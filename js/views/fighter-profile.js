import { formatCurrency, formatDate, getWeightClassShort, getWeightClassLabel, getNationalityFlag, getAdjacentWeightClasses, clamp } from '../utils/helpers.js';

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
          <div class="stat-label">${getWeightClassLabel(fighter.weightClass)}</div>
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
            <span class="card-title">🥊 Em Pé</span>
          </div>
          <div class="attr-grid">
            ${fighter.attributes.boxing !== undefined ? attrBars(fighter.attributes.boxing, 'Boxing', fighter.attributes.boxing >= 70 ? 'high' : fighter.attributes.boxing >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.kickboxing !== undefined ? attrBars(fighter.attributes.kickboxing, 'Kickboxing', fighter.attributes.kickboxing >= 70 ? 'high' : fighter.attributes.kickboxing >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.muayThai !== undefined ? attrBars(fighter.attributes.muayThai, 'Muay Thai', fighter.attributes.muayThai >= 70 ? 'high' : fighter.attributes.muayThai >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.power !== undefined ? attrBars(fighter.attributes.power, 'Power', fighter.attributes.power >= 70 ? 'high' : fighter.attributes.power >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.footwork !== undefined ? attrBars(fighter.attributes.footwork, 'Footwork', fighter.attributes.footwork >= 70 ? 'high' : fighter.attributes.footwork >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.headMovement !== undefined ? attrBars(fighter.attributes.headMovement, 'Head Movement', fighter.attributes.headMovement >= 70 ? 'high' : fighter.attributes.headMovement >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.clinch !== undefined ? attrBars(fighter.attributes.clinch, 'Clinch', fighter.attributes.clinch >= 70 ? 'high' : fighter.attributes.clinch >= 40 ? 'medium' : 'low') : ''}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">🤼 Chão</span>
          </div>
          <div class="attr-grid">
            ${fighter.attributes.wrestling !== undefined ? attrBars(fighter.attributes.wrestling, 'Wrestling', fighter.attributes.wrestling >= 70 ? 'high' : fighter.attributes.wrestling >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.bjj !== undefined ? attrBars(fighter.attributes.bjj, 'BJJ', fighter.attributes.bjj >= 70 ? 'high' : fighter.attributes.bjj >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.takedowns !== undefined ? attrBars(fighter.attributes.takedowns, 'Takedowns', fighter.attributes.takedowns >= 70 ? 'high' : fighter.attributes.takedowns >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.takedownDefense !== undefined ? attrBars(fighter.attributes.takedownDefense, 'TD Defense', fighter.attributes.takedownDefense >= 70 ? 'high' : fighter.attributes.takedownDefense >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.groundControl !== undefined ? attrBars(fighter.attributes.groundControl, 'Ground Control', fighter.attributes.groundControl >= 70 ? 'high' : fighter.attributes.groundControl >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.submissionOffense !== undefined ? attrBars(fighter.attributes.submissionOffense, 'Sub Offense', fighter.attributes.submissionOffense >= 70 ? 'high' : fighter.attributes.submissionOffense >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.submissionDefense !== undefined ? attrBars(fighter.attributes.submissionDefense, 'Sub Defense', fighter.attributes.submissionDefense >= 70 ? 'high' : fighter.attributes.submissionDefense >= 40 ? 'medium' : 'low') : ''}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">💪 Físico</span>
          </div>
          <div class="attr-grid">
            ${attrBars(fighter.attributes.cardio, 'Cardio', fighter.attributes.cardio >= 70 ? 'high' : fighter.attributes.cardio >= 40 ? 'medium' : 'low')}
            ${attrBars(fighter.attributes.chin, 'Chin', fighter.attributes.chin >= 70 ? 'high' : fighter.attributes.chin >= 40 ? 'medium' : 'low')}
            ${fighter.attributes.strength !== undefined ? attrBars(fighter.attributes.strength, 'Strength', fighter.attributes.strength >= 70 ? 'high' : fighter.attributes.strength >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.speed !== undefined ? attrBars(fighter.attributes.speed, 'Speed', fighter.attributes.speed >= 70 ? 'high' : fighter.attributes.speed >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.durability !== undefined ? attrBars(fighter.attributes.durability, 'Durability', fighter.attributes.durability >= 70 ? 'high' : fighter.attributes.durability >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.recovery !== undefined ? attrBars(fighter.attributes.recovery, 'Recovery', fighter.attributes.recovery >= 70 ? 'high' : fighter.attributes.recovery >= 40 ? 'medium' : 'low') : ''}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">🧠 Mental</span>
          </div>
          <div class="attr-grid">
            ${attrBars(fighter.attributes.fightIQ, 'Fight IQ', fighter.attributes.fightIQ >= 70 ? 'high' : fighter.attributes.fightIQ >= 40 ? 'medium' : 'low')}
            ${fighter.attributes.composure !== undefined ? attrBars(fighter.attributes.composure, 'Composure', fighter.attributes.composure >= 70 ? 'high' : fighter.attributes.composure >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.aggression !== undefined ? attrBars(fighter.attributes.aggression, 'Aggression', fighter.attributes.aggression >= 70 ? 'high' : fighter.attributes.aggression >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.adaptability !== undefined ? attrBars(fighter.attributes.adaptability, 'Adaptability', fighter.attributes.adaptability >= 70 ? 'high' : fighter.attributes.adaptability >= 40 ? 'medium' : 'low') : ''}
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

      <!-- DNA Traits -->
      <div class="card mt-4">
        <div class="card-header">
          <span class="card-title">DNA Oculto</span>
        </div>
        <div class="flex gap-2 flex-wrap">
          ${fighter.dnaTraits.length > 0
            ? fighter.dnaTraits.map(t => `<span class="badge badge-info">${t.label}</span>`).join('')
            : '<span class="text-xs text-muted">Nenhum trait especial detectado</span>'
          }
        </div>
      </div>

      <!-- Popularidade -->
      <div class="card mt-4">
        <div class="card-header">
          <span class="card-title">Popularidade</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="progress-bar flex-1" style="height:12px">
            <div class="progress-fill ${fighter.popularity >= 70 ? 'high' : fighter.popularity >= 40 ? 'medium' : 'low'}" style="width:${fighter.popularity}%"></div>
          </div>
          <span class="text-sm font-bold">${fighter.popularity}</span>
          <span class="badge ${fighter.popularity >= 80 ? 'badge-success' : fighter.popularity >= 60 ? 'badge-info' : 'badge-warning'}">${fighter.popularityTier}</span>
        </div>
      </div>

      <!-- Épico E1: Corte de Peso e Mudança de Divisão -->
      <div class="card mt-4">
        <div class="card-header">
          <span class="card-title">Divisão de Peso</span>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <div class="text-xs text-muted">Divisão Atual</div>
            <div class="text-sm font-bold">${getWeightClassLabel(fighter.weightClass)}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Facilidade de Corte</div>
            <div class="text-sm font-bold">${fighter.weightCut.ease}%</div>
            <div class="progress-bar mt-1" style="height:6px">
              <div class="progress-fill ${fighter.weightCut.ease >= 60 ? 'high' : fighter.weightCut.ease >= 40 ? 'medium' : 'low'}" style="width:${fighter.weightCut.ease}%"></div>
            </div>
          </div>
        </div>
        ${fighter.status === 'roster' ? (() => {
          const adj = getAdjacentWeightClasses(fighter.weightClass);
          const options = [];
          if (adj.up) options.push({ dir: 'up', label: `Subir para ${getWeightClassShort(adj.up)} (menos peso)`, cost: 5000, attrPenalty: 'power -3, strength -2', attrBonus: 'speed +2, cardio +1' });
          if (adj.down) options.push({ dir: 'down', label: `Descer para ${getWeightClassShort(adj.down)} (mais peso)`, cost: 3000, attrPenalty: 'speed -2, cardio -2', attrBonus: 'power +2, strength +3' });
          return options.length > 0 ? `
            <div class="mt-3">
              <div class="text-xs text-muted mb-2">Mudar de divisão (custa $${Math.max(...options.map(o => o.cost)).toLocaleString()}):</div>
              <div class="flex gap-2 flex-wrap">
                ${options.map(opt => `
                  <button class="btn btn-sm btn-secondary change-weight-class" data-dir="${opt.dir}" data-fighter="${fighter.id}">
                    ${opt.label}
                    <div class="text-xs text-muted mt-1">${opt.attrPenalty} · ${opt.attrBonus}</div>
                  </button>
                `).join('')}
              </div>
            </div>
          ` : '';
        })() : ''}
      </div>

      <div class="mt-4">
        ${historyHtml}
      </div>

      <div class="flex gap-2 mt-4">
        <button class="btn btn-secondary fighter-back">Voltar</button>
      </div>
    `;
  }
}
