import { e } from '../utils/helpers.js';
import { PixelIcon } from './pixel-icon.js';

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
    return `<div class="${classes}">
      <div class="calendar-entry-week">${e(entry.label)}</div>
      <div class="calendar-entry-icon">${PixelIcon.render(entry.icon || 'calendar')}</div>
      <div class="calendar-entry-detail">${entry.details ? e(entry.details) : '&nbsp;'}</div>
    </div>`;
  }).join('');

  return `<div class="page-header">
      <h2>${PixelIcon.render('calendar', { size: 'lg' })} Calendário</h2>
      <p class="text-muted text-sm">Próximas semanas da carreira</p>
    </div>
    ${upcomingFight ? `<div class="card" style="border-left:4px solid var(--danger);margin-bottom:1.5rem"><div class="card-body">
      <strong>${PixelIcon.render('fight')} Próxima luta:</strong> ${e(upcomingFight.opponentName)} · ${e(upcomingFight.promotionName)}
      ${upcomingFight.isTitleFight ? ` ${PixelIcon.render('title')} Disputa de cinturão` : ''}
    </div></div>` : `<div class="card" style="margin-bottom:1.5rem"><div class="card-body text-muted text-sm">Nenhuma luta marcada no momento.</div></div>`}
    ${medicalStatus ? `<div class="card" style="border-left:4px solid var(--warning);margin-bottom:1.5rem"><div class="card-body">
      <strong>${PixelIcon.render('injury')} Retorno médico em ${medicalStatus.weeksRemaining} semana${medicalStatus.weeksRemaining === 1 ? '' : 's'}</strong>
      <div class="text-sm text-muted mt-1">${e(medicalStatus.diagnosis)}</div>
      <div class="text-xs text-muted mt-1">Fisioterapia e recuperação reduzem o tempo restante quando disponíveis.</div>
    </div></div>` : ''}
    <div class="calendar-legend" style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;font-size:0.85rem">
      <span>${PixelIcon.render('training')} Treino</span><span>${PixelIcon.render('energy')} Camp</span>
      <span>${PixelIcon.render('rank')} Pesagem</span><span>${PixelIcon.render('fight')} Luta</span>
      <span>${PixelIcon.render('title')} Cinturão</span><span>${PixelIcon.render('injury')} Suspensão</span>
      <span>${PixelIcon.render('events')} Evento</span>
    </div>
    <div class="calendar-grid">${entriesHtml}</div>`;
}
