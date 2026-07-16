export function renderCalendar(calendarData) {
  if (!calendarData) {
    return `<div class="card"><div class="card-body"><p class="text-center text-muted">Nenhum dado disponível.</p></div></div>`;
  }

  const { entries, upcomingFight } = calendarData;

  const entriesHtml = entries.map(e => {
    const classes = [
      'calendar-entry',
      e.isCurrentWeek ? 'calendar-entry--current' : '',
      e.isPastWeek ? 'calendar-entry--past' : '',
      e.isFightWeek ? 'calendar-entry--fight' : '',
      `calendar-entry--${e.weekType}`,
    ].filter(Boolean).join(' ');

    return `
      <div class="${classes}">
        <div class="calendar-entry-week">${e.label}</div>
        <div class="calendar-entry-icon">${e.icon}</div>
        <div class="calendar-entry-detail">${e.details || '&nbsp;'}</div>
      </div>`;
  }).join('');

  return `
    <div class="page-header">
      <h2>📅 Calendário</h2>
      <p class="text-muted text-sm">Próximas semanas da carreira</p>
    </div>
    ${upcomingFight ? `
      <div class="card" style="border-left:4px solid var(--danger, #e74c3c);margin-bottom:1.5rem">
        <div class="card-body">
          <strong>🥊 Próxima Luta:</strong> ${upcomingFight.opponentName} · ${upcomingFight.promotionName}
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
