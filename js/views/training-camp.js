export class TrainingCampView {
  static render(fighters, selectedId = null) {
    const available = fighters.filter(f => f.status === 'roster' && f.status !== 'injured');

    return `
      <div class="page-header">
        <h2>Acampamento de Treinamento</h2>
        <p>Prepare seus lutadores para as próximas lutas</p>
      </div>

      <div class="card mb-4">
        <div class="form-group">
          <label class="form-label">Selecionar Lutador</label>
          <select class="form-select" id="trainingFighterSelect">
            <option value="">— Escolha um lutador —</option>
            ${available.map(f => `
              <option value="${f.id}" ${f.id === selectedId ? 'selected' : ''}>
                ${f.name} — OVR ${f.overallRating} · ${f.weightClass}
              </option>
            `).join('')}
          </select>
        </div>

        <div id="trainingOptions" style="display:none">
          <div class="form-group">
            <label class="form-label">Intensidade</label>
            <div class="flex gap-2" id="intensityButtons">
              <button class="btn btn-sm btn-secondary training-intensity" data-intensity="light">
                Leve — Ganhos pequenos, risco mínimo
              </button>
              <button class="btn btn-sm btn-secondary training-intensity" data-intensity="medium">
                Médio — Ganhos moderados, risco baixo
              </button>
              <button class="btn btn-sm btn-secondary training-intensity" data-intensity="hard">
                Intenso — Ganhos grandes, risco alto
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Especialização</label>
            <div class="flex gap-2" id="specButtons">
              <button class="btn btn-sm btn-secondary training-spec" data-spec="striking">
                Striking
              </button>
              <button class="btn btn-sm btn-secondary training-spec" data-spec="grappling">
                Grappling
              </button>
              <button class="btn btn-sm btn-secondary training-spec" data-spec="cardio">
                Cardio
              </button>
              <button class="btn btn-sm btn-secondary training-spec" data-spec="chin">
                Chin
              </button>
            </div>
          </div>

          <div class="mt-4">
            <button class="btn btn-primary training-start" id="startTrainingBtn" disabled>
              Iniciar Treinamento
            </button>
          </div>

          <div id="trainingResult" class="mt-4"></div>
        </div>
      </div>
    `;
  }

  static renderResult(result, fighter) {
    let html = '<div class="card">';
    html += '<div class="card-header"><span class="card-title">Resultado do Treinamento</span></div>';

    if (result.injured) {
      html += '<div class="text-danger font-bold mb-2">⚠️ Lesão! Lutador está fora de combate.</div>';
    }
    if (result.overtrained) {
      html += '<div class="text-warning font-bold mb-2">⚠️ Overtraining! Moral e energia reduzidos.</div>';
    }
    if (!result.injured && !result.overtrained) {
      html += '<div class="text-success font-bold mb-2">✅ Treinamento concluído com sucesso!</div>';
    }

    html += '<div class="grid grid-cols-2 gap-2">';
    for (const [attr, gain] of Object.entries(result.gains)) {
      const labels = {
        boxing: 'Boxing', kickboxing: 'Kickboxing', muayThai: 'Muay Thai',
        wrestling: 'Wrestling', bjj: 'BJJ', cardio: 'Cardio', chin: 'Chin',
      };
      html += `
        <div>
          <span class="text-xs text-muted">${labels[attr] || attr}</span>
          <span class="text-success font-bold ml-1">+${gain}</span>
        </div>
      `;
    }
    html += '</div></div>';

    return html;
  }
}