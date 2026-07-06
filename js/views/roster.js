import { getWeightClassShort, getNationalityFlag, formatCurrency, renderAttrBar } from '../utils/helpers.js';
import { TRAINING_FOCUS_META } from '../config/game-config.js';

// Minha Equipe: cartão por atleta com atributos legíveis e o seletor de
// foco de treino individual — o coração da gestão do treinador.
export class RosterView {
  static render(fighters, bookings = [], now = 1) {
    const sorted = [...fighters].sort((a, b) => b.overallRating - a.overallRating);

    if (sorted.length === 0) {
      return `
        <div class="page-header">
          <h2>Minha Equipe</h2>
          <p>Os atletas da sua academia</p>
        </div>
        <div class="empty-state">
          <p>Nenhum atleta na equipe. Vá ao Recrutamento para trazer talentos.</p>
        </div>
      `;
    }

    return `
      <div class="page-header">
        <h2>Minha Equipe</h2>
        <p>${sorted.length} atleta${sorted.length === 1 ? '' : 's'} sob seus cuidados · defina o foco de treino de cada um</p>
      </div>

      <div class="roster-cards" data-reveal-stagger>
        ${sorted.map(f => this._renderCard(f, bookings.find(b => b.fighterId === f.id), now)).join('')}
      </div>
    `;
  }

  static _renderCard(f, booking, now) {
    const injured = f.status === 'injured';
    const focus = f.trainingFocus || 'striking';

    const suspended = !injured && f.availableFromAbsWeek > now;

    let statusLine;
    if (injured) {
      const weeksLeft = Math.max(0, (f.injury?.untilAbsWeek || now) - now);
      statusLine = `<div class="roster-status roster-status--danger">🏥 Lesionado · volta em ${weeksLeft} semana${weeksLeft === 1 ? '' : 's'}</div>`;
    } else if (booking) {
      const weeksOut = Math.max(0, booking.eventAbsWeek - now);
      statusLine = `<div class="roster-status roster-status--gold">🥊 Luta em ${weeksOut} sem vs ${booking.opponentName} · ${formatCurrency(booking.purse)}</div>`;
    } else if (suspended) {
      const weeksLeft = f.availableFromAbsWeek - now;
      statusLine = `<div class="roster-status roster-status--warning">⏳ Suspensão médica · libera em ${weeksLeft} semana${weeksLeft === 1 ? '' : 's'}</div>`;
    } else {
      statusLine = `<div class="roster-status roster-status--muted">Sem luta marcada — aceite uma oferta</div>`;
    }

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

        <div class="flex items-center gap-3 my-3">
          <span class="badge badge-info" style="font-size:0.75rem">${f.record.wins}-${f.record.losses}-${f.record.draws}</span>
          <span class="text-xs text-muted">${f.popularityTier} · ${f.popularity} pop</span>
        </div>

        ${statusLine}

        <div class="attr-grid mt-3">
          ${renderAttrBar('Striking', f.strikingScore)}
          ${renderAttrBar('Grappling', f.grapplingScore)}
          ${renderAttrBar('Cardio', f.attributes.cardio)}
          ${renderAttrBar('Fight IQ', f.attributes.fightIQ)}
        </div>

        <div class="grid grid-cols-2 gap-3 mt-3">
          <div>
            <div class="text-xs text-muted mb-1">Fadiga</div>
            <div class="progress-bar" style="height:6px">
              <div class="progress-fill ${f.fatigue >= 60 ? 'low' : f.fatigue >= 30 ? 'medium' : 'high'}" style="width:${f.fatigue}%"></div>
            </div>
          </div>
          <div>
            <div class="text-xs text-muted mb-1">Moral</div>
            <div class="progress-bar" style="height:6px">
              <div class="progress-fill ${f.morale >= 70 ? 'high' : f.morale >= 40 ? 'medium' : 'low'}" style="width:${f.morale}%"></div>
            </div>
          </div>
        </div>

        <div class="mt-3">
          <div class="text-xs text-muted mb-1" style="text-transform:uppercase;letter-spacing:0.08em">Foco de Treino desta Semana</div>
          <div class="focus-picker">
            ${Object.entries(TRAINING_FOCUS_META).map(([key, meta]) => `
              <button class="btn btn-sm ${focus === key ? 'btn-primary' : 'btn-secondary'} training-focus-set" data-id="${f.id}" data-focus="${key}">
                ${meta.icon} ${meta.label}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="mt-3">
          <button class="btn btn-sm btn-danger roster-release" data-id="${f.id}" data-name="${f.name}">Dispensar</button>
        </div>
      </div>
    `;
  }
}
