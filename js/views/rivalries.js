import { e } from '../utils/helpers.js';

const RIVALRY_TYPE_INFO = {
  grudge: { icon: 'Fogo', label: 'Grudge' },
  robbery: { icon: 'Juizes', label: 'Roubada' },
  competitive: { icon: 'Ranking', label: 'Competitiva' },
  personal: { icon: 'Pessoal', label: 'Pessoal' },
};

function rivalryTypeInfo(type) {
  return RIVALRY_TYPE_INFO[type] || { icon: 'Ranking', label: type || 'Competitiva' };
}

export class RivalriesView {
  static render(rivalries = [], fighters = [], archived = []) {
    const getFighterName = (id) => {
      const fighter = fighters.find(item => item.id === id);
      return fighter ? fighter.name : 'Desconhecido';
    };

    const renderDossier = (rivalry, { archived: isArchived = false } = {}) => {
      const typeInfo = rivalryTypeInfo(rivalry.type);
      const history = rivalry.history || [];
      const intensity = Math.max(0, Math.min(10, Number(rivalry.intensity) || 0));
      const lastEvent = history[history.length - 1];
      return `
        <article class="card rivalry-dossier ${isArchived ? 'rivalry-dossier--archived' : ''}">
          <div class="document-kicker">${isArchived ? 'ARQUIVO DE CONFLITOS' : 'DOSSIÊ DE CONFLITO'}</div>
          <div class="flex items-center justify-between mb-3">
            <span class="badge ${intensity >= 7 ? 'badge-danger' : intensity >= 4 ? 'badge-warning' : 'badge-info'}">
              ${e(rivalry.intensityLabel || 'Rivalidade')} (${intensity}/10)
            </span>
            <span class="text-xs text-muted" title="Origem da rivalidade">${e(typeInfo.icon)} · ${e(typeInfo.label)}</span>
          </div>
          <div class="flex items-center justify-between">
            <div class="text-center"><div class="font-bold">${e(getFighterName(rivalry.fighterAId))}</div></div>
            <div class="text-danger font-bold">VS</div>
            <div class="text-center"><div class="font-bold">${e(getFighterName(rivalry.fighterBId))}</div></div>
          </div>
          <div class="progress-bar mt-2" style="height:8px">
            <div class="progress-fill ${intensity >= 7 ? 'low' : intensity >= 4 ? 'medium' : 'high'}" style="width:${intensity * 10}%"></div>
          </div>
          <div class="text-xs text-muted mt-2">
            ${history.length} eventos · ${lastEvent ? e(lastEvent.description || lastEvent.type || '') : 'Sem eventos registrados'}
          </div>
          ${history.length ? `
          <div class="rivalry-history mt-2">
            <div class="text-xs text-muted mb-1">Linha do arco</div>
            ${history.slice(-4).reverse().map(event => `
              <div class="text-xs rivalry-history__entry">• ${e(event.description || event.type || '')}</div>
            `).join('')}
          </div>` : ''}
        </article>
      `;
    };

    const activeHtml = rivalries.length
      ? `<div class="grid grid-cols-2 gap-4">${rivalries.map(rivalry => renderDossier(rivalry)).join('')}</div>`
      : `<div class="empty-state"><p>Nenhuma rivalidade ativa. Rivalidades se formam apos lutas intensas.</p></div>`;
    const archiveHtml = archived.length
      ? `
        <section class="rivalry-archive">
          <div class="section-label mt-4">Arquivo de Rivalidades Encerradas</div>
          <p class="text-xs text-muted mb-2">Conflitos encerrados continuam na memoria da carreira.</p>
          <div class="grid grid-cols-2 gap-4">${archived.slice(0, 8).map(rivalry => renderDossier(rivalry, { archived: true })).join('')}</div>
        </section>`
      : '';

    return `
      <div class="page-header">
        <h2>Rivalidades</h2>
        <p>${rivalries.length} ativas${archived.length ? ` · ${archived.length} no arquivo` : ''}</p>
      </div>
      ${activeHtml}
      ${archiveHtml}
    `;
  }
}
