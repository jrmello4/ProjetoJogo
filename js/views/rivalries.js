// §D.3 — origem/identidade da rivalidade: rótulo curto + ícone pra dar
// contexto rápido ao lado da intensidade. 'personal' é o tipo legado (nascido
// de hype de coletiva, ver RivalryService.addPressConferenceHeat) — não faz
// parte da derivação nova, mas ainda pode existir em rivalidades já salvas.
const RIVALRY_TYPE_INFO = {
  grudge: { icon: '🔥', label: 'Grudge' },
  robbery: { icon: '⚖️', label: 'Roubada' },
  competitive: { icon: '🥊', label: 'Competitiva' },
  personal: { icon: '😤', label: 'Pessoal' },
};

function rivalryTypeInfo(type) {
  return RIVALRY_TYPE_INFO[type] || { icon: '🥊', label: type || 'Competitiva' };
}

export class RivalriesView {
  static render(rivalries, fighters) {
    if (rivalries.length === 0) {
      return `
        <div class="page-header">
          <h2>Rivalidades</h2>
          <p>Conflitos e rivalidades entre lutadores</p>
        </div>
        <div class="empty-state">
          <p>Nenhuma rivalidade ativa. Rivalidades se formam após lutas intensas.</p>
        </div>
      `;
    }

    const getFighterName = (id) => {
      const f = fighters.find(f => f.id === id);
      return f ? f.name : 'Desconhecido';
    };

    return `
      <div class="page-header">
        <h2>Rivalidades</h2>
        <p>${rivalries.length} rivalidades ativas</p>
      </div>

      <div class="grid grid-cols-2 gap-4">
        ${rivalries.map(r => {
          const typeInfo = rivalryTypeInfo(r.type);
          return `
          <div class="card">
            <div class="flex items-center justify-between mb-3">
              <span class="badge ${r.intensity >= 7 ? 'badge-danger' : r.intensity >= 4 ? 'badge-warning' : 'badge-info'}">
                ${r.intensityLabel} (${r.intensity}/10)
              </span>
              <span class="text-xs text-muted" title="Origem da rivalidade">${typeInfo.icon} ${typeInfo.label}</span>
            </div>
            <div class="flex items-center justify-between">
              <div class="text-center">
                <div class="font-bold">${getFighterName(r.fighterAId)}</div>
              </div>
              <div class="text-danger font-bold">⚔️</div>
              <div class="text-center">
                <div class="font-bold">${getFighterName(r.fighterBId)}</div>
              </div>
            </div>
            <div class="progress-bar mt-2" style="height:8px">
              <div class="progress-fill ${r.intensity >= 7 ? 'low' : r.intensity >= 4 ? 'medium' : 'high'}" style="width:${r.intensity * 10}%"></div>
            </div>
            <div class="text-xs text-muted mt-2">
              ${r.history.length} eventos · ${r.history.length > 0 ? r.history[r.history.length - 1].description : ''}
            </div>
          </div>
        `;
        }).join('')}
      </div>
    `;
  }
}