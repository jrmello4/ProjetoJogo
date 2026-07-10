import { formatCurrency } from '../utils/helpers.js';
import { absWeekToLabel } from '../config/game-config.js';

// Finanças da academia: caixa, fluxo semanal e extrato (ledger).
export class FinanceView {
  static render(gym, team) {
    const teamSize = Array.isArray(team) ? team.length : (team || 0);
    const expenses = gym.weeklyExpenses(teamSize);
    const income = gym.weeklyIncome();
    const net = income.total - expenses.total;

    // Épico A: o corte real é 1 - fighter.purseShare (varia por atleta
    // conforme renegociações de retenção), não mais o managerCut fixo da
    // academia — média do elenco atual pra dar uma noção honesta.
    const cuts = Array.isArray(team) ? team.map(f => 1 - (f.purseShare ?? (1 - gym.managerCut))) : [];
    const avgCut = cuts.length > 0 ? cuts.reduce((a, b) => a + b, 0) / cuts.length : gym.managerCut;

    // Fôlego: semanas até o caixa zerar só com o fluxo fixo (sem bolsas)
    const runway = net < 0 ? Math.floor(gym.cash / Math.abs(net)) : Infinity;
    const runwayClass = runway >= 12 ? 'runway-badge--ok' : runway >= 5 ? 'runway-badge--warn' : 'runway-badge--critical';
    const runwayLabel = runway === Infinity ? '∞' : String(Math.max(0, runway));

    const ledgerHtml = gym.ledger.length === 0
      ? '<div class="text-center text-muted text-sm" style="padding:1rem">Sem movimentações ainda. Avance a semana para o fluxo começar.</div>'
      : gym.ledger.slice(0, 20).map(t => `
          <div class="cost-row">
            <span>
              <span class="font-bold">${t.label}</span>
              <span class="text-xs text-muted ml-2">${absWeekToLabel(t.absWeek)}</span>
            </span>
            <span class="font-bold ${t.amount >= 0 ? 'text-success' : 'text-danger'}">${t.amount >= 0 ? '+' : ''}${formatCurrency(t.amount)}</span>
          </div>
        `).join('');

    return `
      <div class="page-header">
        <h2>Finanças</h2>
        <p>Caixa da academia, fluxo semanal e extrato</p>
      </div>

      <div class="grid grid-cols-4 mb-4" data-reveal-stagger>
        <div class="card stat-card">
          <div class="card-header"><span class="card-title">Caixa</span></div>
          <div class="stat-value ${gym.cash >= 0 ? '' : 'text-danger'}">${formatCurrency(gym.cash)}</div>
          <div class="stat-label">Disponível agora</div>
        </div>
        <div class="card stat-card">
          <div class="card-header"><span class="card-title">Fluxo Semanal</span></div>
          <div class="stat-value ${net >= 0 ? 'text-success' : 'text-danger'}">${net >= 0 ? '+' : ''}${formatCurrency(net)}</div>
          <div class="stat-label">Sem contar bolsas de luta</div>
        </div>
        <div class="card stat-card">
          <div class="card-header"><span class="card-title">Comissões Totais</span></div>
          <div class="stat-value text-success">${formatCurrency(gym.totalPurseEarnings)}</div>
          <div class="stat-label">~${Math.round(avgCut * 100)}% média de cada bolsa</div>
        </div>
        <div class="card stat-card">
          <div class="card-header"><span class="card-title">Fôlego de Caixa</span></div>
          <div class="runway-badge ${runwayClass}">${runwayLabel}</div>
          <div class="stat-label">semanas sem lutas</div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="card" data-reveal>
          <div class="card-header">
            <span class="card-title">Fluxo Fixo Semanal</span>
            <span class="badge ${net >= 0 ? 'badge-success' : 'badge-danger'}">${net >= 0 ? '+' : ''}${formatCurrency(net)}/sem</span>
          </div>
          <div class="cost-row"><span>Mensalidades de alunos</span><span class="font-bold text-success">+${formatCurrency(income.students)}</span></div>
          <div class="cost-row"><span>Aluguel do espaço</span><span class="font-bold text-danger">−${formatCurrency(expenses.rent)}</span></div>
          <div class="cost-row"><span>Equipe médica e suporte (${teamSize} atleta${teamSize === 1 ? '' : 's'})</span><span class="font-bold text-danger">−${formatCurrency(expenses.coaching)}</span></div>
          ${expenses.coaches > 0 ? `<div class="cost-row"><span>Comissão técnica</span><span class="font-bold text-danger">−${formatCurrency(expenses.coaches)}</span></div>` : ''}
          ${expenses.scout > 0 ? `<div class="cost-row"><span>Olheiro</span><span class="font-bold text-danger">−${formatCurrency(expenses.scout)}</span></div>` : ''}
          <div class="text-xs text-muted mt-2">Mensalidades crescem com a reputação da academia. Vitórias trazem alunos novos; comissões de bolsa são o grande salto de receita.</div>
        </div>

        <div class="card" data-reveal>
          <div class="card-header"><span class="card-title">Extrato</span></div>
          ${ledgerHtml}
        </div>
      </div>
    `;
  }
}
