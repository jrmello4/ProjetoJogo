// §D.3 — origem/identidade da rivalidade: rótulo curto + ícone pra dar
// contexto rápido ao lado da intensidade. 'personal' é o tipo legado (nascido
// de hype de coletiva, ver RivalryService.addPressConferenceHeat) — não faz
// parte da derivação nova, mas ainda pode existir em rivalidades já salvas.
import { e } from '../utils/helpers.js';
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
                ${e(r.intensityLabel)} (${r.intensity}/10)
              </span>
              <span class="text-xs text-muted" title="Origem da rivalidade">${typeInfo.icon} ${e(typeInfo.label)}</span>
            </div>
            <div class="flex items-center justify-between">
              <div class="text-center">
                <div class="font-bold">${e(getFighterName(r.fighterAId))}</div>
              </div>
              <div class="text-danger font-bold">⚔️</div>
              <div class="text-center">
                <div class="font-bold">${e(getFighterName(r.fighterBId))}</div>
              </div>
            </div>
            <div class="progress-bar mt-2" style="height:8px">
              <div class="progress-fill ${r.intensity >= 7 ? 'low' : r.intensity >= 4 ? 'medium' : 'high'}" style="width:${r.intensity * 10}%"></div>
            </div>
            <div class="text-xs text-muted mt-2">
              ${r.history.length} eventos · ${r.history.length > 0 ? e(r.history[r.history.length - 1].description) : ''}
            </div>
            ${r.history?.length ? `
            <div class="mt-2" style="border-top:1px solid var(--border);padding-top:0.5rem;max-height:7rem;overflow:auto">
              <div class="text-xs text-muted mb-1">📖 Arco</div>
              ${r.history.slice(-4).reverse().map(h => `
                <div class="text-xs" style="line-height:1.35;margin-bottom:0.25rem">• ${e(h.description || h.type || '')}</div>
              `).join('')}
            </div>` : ''}
          </div>
        `;
        }).join('')}
      </div>
    `;
  }
}