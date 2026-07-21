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
  // Fase 8 — rivalidade como recorte de jornal esportivo: cabeçalho de
  // veículo, manchete que escala com a intensidade, coluna de bastidores
  // (o arco) e um medidor de calor. Não é um card de stats — é imprensa.
  static _renderNewsClip(r, nameA, nameB) {
    const typeInfo = rivalryTypeInfo(r.type);
    const headline = r.intensity >= 7
      ? `${nameA} × ${nameB}: guerra declarada`
      : r.intensity >= 4
        ? `${nameA} provoca ${nameB} e o clima esquenta`
        : `Nasce a rivalidade: ${nameA} × ${nameB}`;
    const arc = (r.history || []).slice(-4).reverse();
    const body = arc.length
      ? arc.map(h => `<p class="news-para">${e(h.description || h.type || '')}</p>`).join('')
      : '<p class="news-para news-para--muted">Os bastidores ainda estão quietos. Uma luta pode mudar isso.</p>';
    return `
      <article class="news-clip" data-reveal>
        <div class="news-masthead">
          <span class="news-outlet">O Globo do Octógono</span>
          <span class="news-edition">${typeInfo.icon} ${e(typeInfo.label)} · calor ${r.intensity}/10</span>
        </div>
        <h3 class="news-headline">${e(headline)}</h3>
        <div class="news-byline">Coluna de bastidores · ${(r.history || []).length} capítulo${(r.history || []).length === 1 ? '' : 's'}</div>
        <div class="news-body">${body}</div>
        <div class="news-meter" aria-hidden="true"><div class="news-meter-fill" style="width:${r.intensity * 10}%"></div></div>
      </article>
    `;
  }

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
        ${rivalries.map(r => this._renderNewsClip(r, getFighterName(r.fighterAId), getFighterName(r.fighterBId))).join('')}
      </div>
    `;
  }
}