import { formatCurrency, getWeightClassShort, getWeightClassName, getNationalityFlag, renderAttrRange } from '../utils/helpers.js';
import { CORE_WEIGHT_CLASSES, POTENTIAL_TIERS } from '../config/game-config.js';
import { ScoutingService } from '../services/scouting-service.js';

// Recrutamento: agentes livres que podem se juntar à academia do jogador.
// Cartões em vez de tabela densa — a mesma informação, mais fácil de ler.
export class MarketView {
  static render(fighters, gym, teamSize, filter = '', searchTerm = '', feeOf = () => 0, knowledge = {}) {
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
          <strong>Sem olheiro.</strong> Você só enxerga faixas grosseiras dos atributos e nenhum potencial. Contrate um olheiro na Academia para enxergar quem vale a pena.
        </div>
      ` : ''}
      ${filterButtons}
    `;

    if (sorted.length === 0) {
      return `
        ${header}
        <div class="empty-state">
          <p>${filter ? `Nenhum agente livre na divisão ${getWeightClassName(filter)}.` : 'Mercado vazio hoje. Novos nomes aparecem toda semana — alguns viram estrelas, outros viram história.'}</p>
        </div>
      `;
    }

    return `
      ${header}
      <div class="roster-cards" data-reveal-stagger>
        ${sorted.map(f => this._renderCard(f, feeOf(f), gym, slotsFull, knowledge[f.id] ?? 0)).join('')}
      </div>
    `;
  }

  static _renderCard(f, fee, gym, slotsFull, level) {
    const canAfford = gym.cash >= fee;

    // Sem olheiro você nem sabe o OVR direito — só uma faixa.
    const ovr = ScoutingService.blur(f.overallRating, level);
    const potentialHtml = ScoutingService.revealsPotential(level)
      ? this._potentialBadge(f.hidden.potential)
      : '<span class="badge badge-warning" style="font-size:0.65rem">??? não revelado</span>';

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
            <div class="stat-value ${ovr.exact ? '' : 'stat-value--fuzzy'}" style="font-size:${ovr.exact ? '1.75rem' : '1.1rem'}">${ovr.exact ? ovr.value : `${ovr.min}–${ovr.max}`}</div>
            <div class="text-xs text-muted">OVR</div>
          </div>
        </div>

        <div class="flex items-center gap-2 my-3" style="flex-wrap:wrap">
          <span class="badge badge-info" style="font-size:0.75rem">${f.record.wins}-${f.record.losses}-${f.record.draws}</span>
          <span class="text-xs text-muted">Potencial:</span>
          ${potentialHtml}
        </div>

        <div class="attr-grid mt-2">
          ${renderAttrRange('Striking', ScoutingService.blur(f.strikingScore, level))}
          ${renderAttrRange('Grappling', ScoutingService.blur(f.grapplingScore, level))}
          ${renderAttrRange('Cardio', ScoutingService.blur(f.attributes.cardio, level))}
          ${renderAttrRange('Fight IQ', ScoutingService.blur(f.attributes.fightIQ, level))}
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
