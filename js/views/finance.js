import { formatCurrency } from '../utils/helpers.js';
import { absWeekToLabel, LIFESTYLE_TIERS } from '../config/game-config.js';

// Finanças pessoais (§A.2/§E.1): caixa, custo de vida, mensalidade da
// academia e extrato — não existe mais "caixa da academia".
export class FinanceView {
  static render(fighter, academy, manager) {
    const lifestyle = LIFESTYLE_TIERS[fighter.lifestyleTier] || LIFESTYLE_TIERS.modest;
    const academyFee = academy?.weeklyFee || 0;
    const fixedOutflow = academyFee + lifestyle.weeklyCost;

    const runway = fixedOutflow > 0 ? Math.floor(fighter.cash / fixedOutflow) : Infinity;
    const runwayClass = runway >= 12 ? 'runway-badge--ok' : runway >= 5 ? 'runway-badge--warn' : 'runway-badge--critical';
    const runwayLabel = runway === Infinity ? '∞' : String(Math.max(0, runway));

    const ledgerHtml = fighter.ledger.length === 0
      ? '<div class="text-center text-muted text-sm" style="padding:1rem">Sem movimentações ainda. Avance a semana para o fluxo começar.</div>'
      : fighter.ledger.slice(0, 20).map(t => `
          <div class="cost-row">
            <span>
              <span class="font-bold">${t.label}</span>
              <span class="text-xs text-muted ml-2">${absWeekToLabel(t.absWeek)}</span>
            </span>
            <span class="font-bold ${t.amount >= 0 ? 'text-success' : 'text-danger'}">${t.amount >= 0 ? '+' : ''}${formatCurrency(t.amount)}</span>
          </div>
        `).join('');

    const lifestyleOptions = Object.entries(LIFESTYLE_TIERS).map(([key, tier]) => `
      <button class="btn btn-sm ${key === fighter.lifestyleTier ? 'btn-primary' : 'btn-secondary'} lifestyle-set" data-tier="${key}">
        ${tier.label} — ${formatCurrency(tier.weeklyCost)}/sem
      </button>
    `).join('');

    return `
      <div class="page-header">
        <h2>Finanças</h2>
        <p>Seu caixa pessoal, fluxo semanal e extrato</p>
      </div>

      <div class="grid grid-cols-3 mb-4" data-reveal-stagger>
        <div class="card stat-card">
          <div class="card-header"><span class="card-title">Caixa</span></div>
          <div class="stat-value ${fighter.cash >= 0 ? '' : 'text-danger'}">${formatCurrency(fighter.cash)}</div>
          <div class="stat-label">Disponível agora</div>
        </div>
        <div class="card stat-card">
          <div class="card-header"><span class="card-title">Saída Fixa Semanal</span></div>
          <div class="stat-value text-danger">−${formatCurrency(fixedOutflow)}</div>
          <div class="stat-label">Academia + custo de vida</div>
        </div>
        <div class="card stat-card">
          <div class="card-header"><span class="card-title">Fôlego de Caixa</span></div>
          <div class="runway-badge ${runwayClass}">${runwayLabel}</div>
          <div class="stat-label">semanas sem lutas</div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <div class="card mb-4" data-reveal>
            <div class="card-header"><span class="card-title">Saída Fixa</span></div>
            ${academyFee > 0 ? `<div class="cost-row"><span>Mensalidade — ${academy.name}</span><span class="font-bold text-danger">−${formatCurrency(academyFee)}</span></div>` : ''}
            <div class="cost-row"><span>Custo de vida (${lifestyle.label})</span><span class="font-bold text-danger">−${formatCurrency(lifestyle.weeklyCost)}</span></div>
            ${manager ? `<div class="cost-row"><span>Empresário (${manager.name}) — corte por bolsa</span><span class="font-bold">${Math.round(manager.cut * 100)}%</span></div>` : ''}
          </div>

          <div class="card" data-reveal>
            <div class="card-header"><span class="card-title">Padrão de Vida</span></div>
            <div class="text-xs text-muted mb-2">Subir de padrão dá um empurrão pequeno em moral/popularidade, mas descer depois de ter subido custa moral.</div>
            <div class="flex gap-2" style="flex-wrap:wrap">${lifestyleOptions}</div>
          </div>
        </div>

        <div class="card" data-reveal>
          <div class="card-header"><span class="card-title">Extrato</span></div>
          ${ledgerHtml}
        </div>
      </div>
    `;
  }
}
