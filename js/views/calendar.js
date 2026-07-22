import { e } from '../utils/helpers.js';
export function renderCalendar(calendarData) {
  if (!calendarData) {
    return `<div class="card"><div class="card-body"><p class="text-center text-muted">Nenhum dado disponível.</p></div></div>`;
  }

  const { entries, upcomingFight, medicalStatus } = calendarData;

  const entriesHtml = entries.map(entry => {
    const classes = [
      'calendar-entry',
      entry.isCurrentWeek ? 'calendar-entry--current' : '',
      entry.isPastWeek ? 'calendar-entry--past' : '',
      entry.isFightWeek ? 'calendar-entry--fight' : '',
      `calendar-entry--${entry.weekType}`,
    ].filter(Boolean).join(' ');

    return `
      <div class="${classes}">
        <div class="calendar-entry-week">${e(entry.label)}</div>
        <div class="calendar-entry-icon">${entry.icon || ''}</div>
      <div class="calendar-entry-detail">${entry.details ? e(entry.details) : '&nbsp;'}</div>
      </div>`;
  }).join('');

  return `
    <div class="page-header">
      <h2>📅 Calendário</h2>
      <p class="text-muted text-sm">Próximas semanas da carreira</p>
    </div>
    ${upcomingFight ? `
      <div class="card" style="border-left:4px solid var(--danger);margin-bottom:1.5rem">
        <div class="card-body">
          <strong>🥊 Próxima Luta:</strong> ${e(upcomingFight.opponentName)} · ${e(upcomingFight.promotionName)}
          ${upcomingFight.isTitleFight ? ' 🏆 Disputa de Cinturão' : ''}
        </div>
      </div>
    ` : `
      <div class="card" style="margin-bottom:1.5rem">
        <div class="card-body text-muted text-sm">
          Nenhuma luta marcada no momento.
        </div>
      </div>
    `}
    ${medicalStatus ? `
      <div class="card" style="border-left:4px solid var(--warning);margin-bottom:1.5rem">
        <div class="card-body">
          <strong>⏳ Retorno médico em ${medicalStatus.weeksRemaining} semana${medicalStatus.weeksRemaining === 1 ? '' : 's'}</strong>
          <div class="text-sm text-muted mt-1">${e(medicalStatus.diagnosis)}</div>
          <div class="text-xs text-muted mt-1">Fisioterapia e recuperação reduzem o tempo restante quando disponíveis.</div>
        </div>
      </div>` : ''}
    <div class="calendar-legend" style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;font-size:0.85rem">
      <span>💪 Treino</span>
      <span>🔥 Camp</span>
      <span>⚖️ Pesagem</span>
      <span>🥊 Luta</span>
      <span>🏆 Cinturão</span>
      <span>❌ Suspensão</span>
      <span>📰 Evento</span>
    </div>
    <div class="calendar-grid">
      ${entriesHtml}
    </div>`;
}
