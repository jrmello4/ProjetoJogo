import { formatCurrency } from '../utils/helpers.js';
import { absWeekToLabel, LIFESTYLE_TIERS, OPTIONAL_SERVICES } from '../config/game-config.js';

// Finanças pessoais (§A.2/§E.1/§PRD): caixa, despesas detalhadas,
// serviços opcionais e extrato.
export class FinanceView {
  static render(fighter, academy, manager) {
    const lifestyle = LIFESTYLE_TIERS[fighter.lifestyleTier] || LIFESTYLE_TIERS.modest;
    const academyFee = academy?.weeklyFee || 0;

    // Quebra do custo de vida
    const rentPct = 0.45;
    const foodPct = 0.25;
    const transportPct = 0.15;
    const leisurePct = 0.15;
    const rent = Math.round(lifestyle.weeklyCost * rentPct);
    const food = Math.round(lifestyle.weeklyCost * foodPct);
    const transport = Math.round(lifestyle.weeklyCost * transportPct);
    const leisure = lifestyle.weeklyCost - rent - food - transport;

    // Serviços opcionais
    const serviceCost = OPTIONAL_SERVICES;
    const hiredServices = fighter.hiredServices || [];
    const totalServices = hiredServices.reduce((sum, k) => sum + (serviceCost[k]?.weeklyCost || 0), 0);

    const fixedOutflow = academyFee + lifestyle.weeklyCost + totalServices;

    const runway = fixedOutflow > 0 ? Math.floor((fighter.cash || 0) / fixedOutflow) : Infinity;
    const runwayClass = runway >= 12 ? 'runway-badge--ok' : runway >= 5 ? 'runway-badge--warn' : 'runway-badge--critical';
    const runwayLabel = runway === Infinity ? '∞' : String(Math.max(0, runway));

    const ledgerHtml = !fighter.ledger || fighter.ledger.length === 0
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

    // Botões de serviço opcional
    const serviceButtons = Object.entries(OPTIONAL_SERVICES).map(([key, svc]) => {
      const active = hiredServices.includes(key);
      return `
        <div class="cost-row" style="border-bottom:1px solid var(--border);padding:0.5rem 0">
          <div style="flex:1">
            <div class="font-bold text-sm">${svc.label}</div>
            <div class="text-xs text-muted">${svc.desc}</div>
          </div>
          <button class="btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'} toggle-service" data-service="${key}" style="margin-left:0.5rem">
            ${active ? 'Ativo' : 'Contratar'} — ${formatCurrency(svc.weeklyCost)}/sem
          </button>
        </div>`;
    }).join('');

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
          <div class="stat-label">Academia + despesas + serviços</div>
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
            <div class="card-header"><span class="card-title">Despesas Semanais</span></div>
            ${academyFee > 0 ? `<div class="cost-row"><span>Mensalidade — ${academy.name}</span><span class="font-bold text-danger">−${formatCurrency(academyFee)}</span></div>` : ''}
            <div class="cost-row"><span>Aluguel (${lifestyle.label})</span><span class="font-bold text-danger">−${formatCurrency(rent)}</span></div>
            <div class="cost-row"><span>Alimentação (${lifestyle.label})</span><span class="font-bold text-danger">−${formatCurrency(food)}</span></div>
            <div class="cost-row"><span>Transporte (${lifestyle.label})</span><span class="font-bold text-danger">−${formatCurrency(transport)}</span></div>
            <div class="cost-row"><span>Lazer (${lifestyle.label})</span><span class="font-bold text-danger">−${formatCurrency(leisure)}</span></div>
            ${totalServices > 0 ? `<div class="cost-row"><span>Serviços contratados</span><span class="font-bold text-danger">−${formatCurrency(totalServices)}</span></div>` : ''}
            <div class="cost-row" style="border-top:2px solid var(--border);margin-top:0.25rem;padding-top:0.25rem">
              <span class="font-bold">Total</span><span class="font-bold text-danger">−${formatCurrency(fixedOutflow)}</span>
            </div>
            ${manager ? `<div class="cost-row"><span>Empresário (${manager.name}) — corte por bolsa</span><span class="font-bold">${Math.round(manager.cut * 100)}%</span></div>` : ''}
          </div>

          <div class="card mb-4" data-reveal>
            <div class="card-header"><span class="card-title">Padrão de Vida</span></div>
            <div class="text-xs text-muted mb-2">Subir de padrão dá um empurrão pequeno em moral/popularidade, mas descer depois de ter subido custa moral.</div>
            <div class="flex gap-2" style="flex-wrap:wrap">${lifestyleOptions}</div>
          </div>

          <div class="card" data-reveal>
            <div class="card-header"><span class="card-title">Serviços Opcionais</span></div>
            <div class="text-xs text-muted mb-2">Contrate profissionais para melhorar sua preparação. Custam por semana.</div>
            ${serviceButtons}
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
