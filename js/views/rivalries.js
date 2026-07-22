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
  static _renderNewsClip(rivalry, nameA, nameB, { archived = false } = {}) {
    const typeInfo = rivalryTypeInfo(rivalry.type);
    const intensity = Math.max(0, Math.min(10, Number(rivalry.intensity) || 0));
    const headline = archived
      ? `${nameA} × ${nameB}: capítulo encerrado`
      : intensity >= 7
        ? `${nameA} × ${nameB}: guerra declarada`
        : intensity >= 4
          ? `${nameA} provoca ${nameB} e o clima esquenta`
          : `Nasce a rivalidade: ${nameA} × ${nameB}`;
    const arc = (rivalry.history || []).slice(-4).reverse();
    const body = arc.length
      ? arc.map(item => `<p class="news-para">${e(item.description || item.type || '')}</p>`).join('')
      : '<p class="news-para news-para--muted">Os bastidores ainda estão quietos. Uma luta pode mudar isso.</p>';

    return `
      <article class="news-clip ${archived ? 'rivalry-dossier--archived' : ''}" data-reveal>
        <div class="news-masthead">
          <span class="news-outlet">${archived ? 'Arquivo de Carreira' : 'O Globo do Octógono'}</span>
          <span class="news-edition">${typeInfo.icon} ${e(typeInfo.label)} · calor ${intensity}/10</span>
        </div>
        <h3 class="news-headline">${e(headline)}</h3>
        <div class="news-byline">Coluna de bastidores · ${(rivalry.history || []).length} capítulo${(rivalry.history || []).length === 1 ? '' : 's'}</div>
        <div class="news-body">${body}</div>
        <div class="news-meter" aria-hidden="true"><div class="news-meter-fill" style="width:${intensity * 10}%"></div></div>
      </article>
    `;
  }

  static render(rivalries = [], fighters = [], archived = []) {
    const getFighterName = (id) => {
      const fighter = fighters.find(item => item.id === id);
      return fighter ? fighter.name : 'Desconhecido';
    };
    const clip = (rivalry, options) => this._renderNewsClip(
      rivalry,
      getFighterName(rivalry.fighterAId),
      getFighterName(rivalry.fighterBId),
      options,
    );
    const activeHtml = rivalries.length
      ? `<div class="grid grid-cols-2 gap-4">${rivalries.map(rivalry => clip(rivalry)).join('')}</div>`
      : '<div class="empty-state"><p>Nenhuma rivalidade ativa. Rivalidades se formam após lutas intensas.</p></div>';
    const archiveHtml = archived.length
      ? `
        <section class="rivalry-archive">
          <div class="section-label mt-4">Arquivo de Rivalidades Encerradas</div>
          <p class="text-xs text-muted mb-2">Conflitos encerrados continuam na memória da carreira.</p>
          <div class="grid grid-cols-2 gap-4">${archived.slice(0, 8).map(rivalry => clip(rivalry, { archived: true })).join('')}</div>
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
