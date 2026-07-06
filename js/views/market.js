import { formatCurrency, getWeightClassShort, getNationalityFlag, renderAttrBar } from '../utils/helpers.js';
import { CORE_WEIGHT_CLASSES, POTENTIAL_TIERS } from '../config/game-config.js';

// Recrutamento: agentes livres que podem se juntar à academia do jogador.
// Cartões em vez de tabela densa — a mesma informação, mais fácil de ler.
export class MarketView {
  static render(fighters, gym, teamSize, filter = '', searchTerm = '', feeOf = () => 0) {
    let filtered = filter
      ? fighters.filter(f => f.weightClass === filter)
      : fighters;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(f => f.name.toLowerCase().includes(term));
    }

    const sorted = [...filtered].sort((a, b) => b.overallRating - a.overallRating);
    const slotsFull = teamSize >= gym.maxTeamSize;
    const scouted = gym.scoutLevel > 0;

    const filterButtons = `
      <div class="flex gap-2 mb-3" style="flex-wrap:wrap">
        <button class="btn btn-sm ${!filter ? 'btn-primary' : 'btn-secondary'} market-filter" data-filter="">Todos</button>
        ${CORE_WEIGHT_CLASSES.map(wc => `
          <button class="btn btn-sm ${filter === wc ? 'btn-primary' : 'btn-secondary'} market-filter" data-filter="${wc}">
            ${getWeightClassShort(wc)}
          </button>
        `).join('')}
        <input type="text" class="form-input market-search" placeholder="Buscar por nome..." value="${searchTerm}" style="max-width:200px;margin-left:auto">
      </div>
    `;

    const header = `
      <div class="page-header">
        <h2>Recrutamento</h2>
        <p>Agentes livres em busca de uma academia · Vagas: ${teamSize}/${gym.maxTeamSize} · Caixa: ${formatCurrency(gym.cash)}</p>
      </div>
      ${slotsFull ? `
        <div class="alert alert-warning mb-4">
          <strong>Academia lotada.</strong> Dispense um atleta em Minha Equipe ou faça upgrade da estrutura na Academia.
        </div>
      ` : ''}
      ${!scouted ? `
        <div class="alert alert-warning mb-4">
          <strong>Sem olheiro.</strong> O potencial oculto de cada agente livre é desconhecido. Contrate um olheiro na Academia para revelá-lo antes de recrutar.
        </div>
      ` : ''}
      ${filterButtons}
    `;

    if (sorted.length === 0) {
      return `
        ${header}
        <div class="empty-state">
          <p>${filter ? `Nenhum agente livre na divisão ${filter}.` : 'Nenhum agente livre disponível. Avance a semana — novos nomes aparecem no mercado.'}</p>
        </div>
      `;
    }

    return `
      ${header}
      <div class="roster-cards" data-reveal-stagger>
        ${sorted.map(f => this._renderCard(f, feeOf(f), gym, scouted, slotsFull)).join('')}
      </div>
    `;
  }

  static _renderCard(f, fee, gym, scouted, slotsFull) {
    const canAfford = gym.cash >= fee;
    const potentialHtml = scouted ? this._potentialBadge(f.hidden.potential) : '<span class="badge badge-warning" style="font-size:0.65rem">??? não revelado</span>';

    return `
      <div class="card roster-card" data-reveal>
        <div class="roster-card-header">
          <div>
            <div class="flex items-center gap-2">
              <span>${getNationalityFlag(f.nationality?.code)}</span>
              <span class="fighter-name-link" data-fighter-click="${f.id}">${f.name}</span>
            </div>
            <div class="text-xs text-muted mt-1">${f.age} anos · ${getWeightClassShort(f.weightClass)} · ${f.fightingStyle}</div>
          </div>
          <div class="text-right">
            <div class="stat-value" style="font-size:1.75rem">${f.overallRating}</div>
            <div class="text-xs text-muted">OVR</div>
          </div>
        </div>

        <div class="flex items-center gap-2 my-3" style="flex-wrap:wrap">
          <span class="badge badge-info" style="font-size:0.75rem">${f.record.wins}-${f.record.losses}-${f.record.draws}</span>
          <span class="text-xs text-muted">Potencial:</span>
          ${potentialHtml}
        </div>

        <div class="attr-grid mt-2">
          ${renderAttrBar('Striking', f.strikingScore)}
          ${renderAttrBar('Grappling', f.grapplingScore)}
          ${renderAttrBar('Cardio', f.attributes.cardio)}
          ${renderAttrBar('Fight IQ', f.attributes.fightIQ)}
        </div>

        <div class="cost-row mt-3" style="border-top:1px solid var(--border);padding-top:0.75rem">
          <div>
            <div class="text-xs text-muted">Taxa de recrutamento</div>
            <div class="text-sm font-bold ${canAfford ? '' : 'text-danger'}">${formatCurrency(fee)}</div>
          </div>
          <button class="btn btn-sm btn-success market-recruit" data-id="${f.id}" ${slotsFull || !canAfford ? 'disabled' : ''}>Recrutar</button>
        </div>
      </div>
    `;
  }

  static _potentialBadge(potential) {
    const tier = POTENTIAL_TIERS.find(t => potential >= t.min) || POTENTIAL_TIERS[POTENTIAL_TIERS.length - 1];
    return `<span class="badge ${tier.cls}" style="font-size:0.65rem">${tier.label} (${potential})</span>`;
  }
}
