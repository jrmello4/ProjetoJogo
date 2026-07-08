import { getWeightClassName } from '../utils/helpers.js';
import { GYM_CONFIG } from '../config/game-config.js';

export class TrainingCampView {
  static render(roster) {
    const fighters = roster.filter(f => f.gymId === GYM_CONFIG.ID);

    return `
      <div class="page-header">
        <h2>Acampamento de Treinamento</h2>
        <p>Melhore os atributos dos seus lutadores</p>
      </div>

      <div class="card mb-4">
        <div class="card-header">
          <span class="card-title">Selecionar Lutador</span>
        </div>
        <div class="form-group">
          <label>Lutador</label>
          <select id="trainingFighterSelect" class="form-select">
            <option value="">-- Selecione um lutador --</option>
            ${fighters.map(f => `
              <option value="${f.id}">${f.name} (${getWeightClassName(f.weightClass)})</option>
            `).join('')}
          </select>
        </div>
      </div>

      <div id="trainingOptions" class="card mb-4" style="display:none">
        <div class="card-header">
          <span class="card-title">Configurar Treinamento</span>
        </div>

        <div class="form-group mb-4">
          <label class="text-sm font-bold text-secondary">Intensidade</label>
          <div class="flex gap-2 training-intensity-group">
            <button class="btn btn-sm btn-secondary training-intensity" data-intensity="light">
              Leve (baixo risco)
            </button>
            <button class="btn btn-sm btn-secondary training-intensity" data-intensity="medium">
              Média (risco moderado)
            </button>
            <button class="btn btn-sm btn-secondary training-intensity" data-intensity="heavy">
              Pesada (alto risco)
            </button>
          </div>
        </div>

        <div class="form-group mb-4">
          <label class="text-sm font-bold text-secondary">Especialização</label>
          <div class="flex gap-2 training-spec-group">
            <button class="btn btn-sm btn-secondary training-spec" data-spec="striking">
              🥊 Striking
            </button>
            <button class="btn btn-sm btn-secondary training-spec" data-spec="grappling">
              🤼 Grappling
            </button>
            <button class="btn btn-sm btn-secondary training-spec" data-spec="cardio">
              🏃 Cardio
            </button>
            <button class="btn btn-sm btn-secondary training-spec" data-spec="chin">
              🛡️ Resistência
            </button>
          </div>
        </div>

        <button class="btn btn-primary" id="startTrainingBtn" disabled>
          Iniciar Treinamento
        </button>
      </div>

      <div id="trainingResult" class="card" style="display:none">
        <div class="card-header">
          <span class="card-title">Resultado do Treinamento</span>
        </div>
        <div id="trainingResultContent"></div>
      </div>
    `;
  }

  static renderResult(result, fighter) {
    const gainRows = Object.entries(result.gains)
      .filter(([, v]) => v > 0)
      .map(([attr, val]) => `
        <tr>
          <td>${attr}</td>
          <td class="text-success">+${val}</td>
        </tr>
      `).join('');

    let statusHtml = '';
    if (result.injured) {
      statusHtml += `<div class="text-danger font-bold">⚠️ Lesão! O lutador ficou fora de combate.</div>`;
    }
    if (result.overtrained) {
      statusHtml += `<div class="text-warning font-bold">⚠️ Super-treinado! Moral e energia reduzidos.</div>`;
    }
    if (!result.injured && !result.overtrained) {
      statusHtml += `<div class="text-success font-bold">✅ Treinamento concluído com sucesso!</div>`;
    }

    return `
      <div class="mb-4">
        <h3 class="text-lg font-bold">${fighter.name}</h3>
        ${statusHtml}
      </div>
      ${gainRows ? `
        <table class="mb-4">
          <thead>
            <tr><th>Atributo</th><th>Ganho</th></tr>
          </thead>
          <tbody>${gainRows}</tbody>
        </table>
      ` : ''}
      <div class="flex gap-2">
        <div class="stat-box">
          <div class="stat-label">Fadiga</div>
          <div class="stat-value">${fighter.fatigue}%</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Moral</div>
          <div class="stat-value">${fighter.morale}%</div>
        </div>
      </div>
    `;
  }
}
