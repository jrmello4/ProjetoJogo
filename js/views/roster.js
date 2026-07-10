import { getWeightClassShort, getNationalityFlag, formatCurrency, renderAttrBar } from '../utils/helpers.js';
import { TRAINING_FOCUS_META } from '../config/game-config.js';

const RETENTION_RESPONSE_LABELS = {
  renegotiate: 'Renegociação',
  stay_bonus: 'Bônus de Permanência',
  promise: 'Promessa',
};

// Minha Equipe: cartão por atleta com atributos legíveis e o seletor de
// foco de treino individual — o coração da gestão do treinador.
export class RosterView {
  static render(fighters, bookings = [], now = 1, approaches = []) {
    const sorted = [...fighters].sort((a, b) => b.overallRating - a.overallRating);
    const activeApproaches = approaches.filter(a => !a.resolved);

    // Épico A: card de retenção para atletas sondados
    const approachHtml = activeApproaches.length === 0 ? '' : `
      <div class="section-label mt-4" style="color:var(--warning)">🔍 Sondagens de Rivais</div>
      <p class="text-xs text-muted mb-2">Academias rivais demonstraram interesse nestes atletas. Reaja antes do prazo ou eles podem sair.</p>
      ${activeApproaches.map(a => {
        const weeksLeft = Math.max(0, a.deadlineAbsWeek - now);
        return `
          <div class="card mb-2" style="border-color:var(--warning)" data-reveal>
            <div class="flex items-center justify-between mb-2">
              <div>
                <span class="font-bold">${a.fighterName}</span>
                <span class="text-xs text-muted ml-2">Sondado por ${a.rivalGymName}</span>
              </div>
              <span class="badge ${weeksLeft <= 1 ? 'badge-danger' : 'badge-warning'}">${weeksLeft} sem${weeksLeft === 1 ? '' : 's'}</span>
            </div>
            ${a.response
              ? `<div class="text-xs text-muted">✅ Você respondeu com "${RETENTION_RESPONSE_LABELS[a.response] || a.response}" — aguardando o atleta decidir.</div>`
              : `<div class="flex gap-2" style="flex-wrap:wrap">
              <button class="btn btn-sm btn-primary retention-respond" data-approach="${a.id}" data-action="renegotiate">Renegociar</button>
              <button class="btn btn-sm btn-success retention-respond" data-approach="${a.id}" data-action="stay_bonus">Bônus Permanência</button>
              <button class="btn btn-sm btn-info retention-respond" data-approach="${a.id}" data-action="promise">Fazer Promessa</button>
              <button class="btn btn-sm btn-secondary retention-respond" data-approach="${a.id}" data-action="let_go">Deixar Ir</button>
            </div>`
            }
          </div>
        `;
      }).join('')}
    `;

    if (sorted.length === 0) {
      return `
        <div class="page-header">
          <h2>Minha Equipe</h2>
          <p>Os atletas da sua academia</p>
        </div>
        <div class="empty-state">
          <p>Sua academia precisa de lutadores. Vá ao Recrutamento — o próximo campeão pode estar lá.</p>
        </div>
      `;
    }

    return `
      <div class="page-header">
        <h2>Minha Equipe</h2>
        <p>${sorted.length} atleta${sorted.length === 1 ? '' : 's'} sob seus cuidados · defina o foco de treino de cada um</p>
      </div>

      ${approachHtml}

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

        ${f.expectation ? `
          <div class="mt-2">
            <span class="badge ${f.expectation.urgency >= 3 ? 'badge-danger' : f.expectation.urgency >= 2 ? 'badge-warning' : 'badge-info'}" style="font-size:0.65rem">
              ${f.expectation.kind === 'title_shot' ? 'Quer chance de título' : f.expectation.kind === 'move_up_tier' ? 'Quer subir de tier' : f.expectation.kind === 'more_fights' ? 'Quer lutar mais' : 'Quer melhor pagamento'}
              ${f.expectation.urgency >= 2 ? ' · Urgente!' : ''}
            </span>
            ${f.expectation.urgency >= 3 ? `
              <div class="text-danger text-xs mt-1">
                ⚠️ Expectativa não atendida — perde moral/lealdade a cada semana. Alvo fácil de rivais!
              </div>
            ` : ''}
          </div>
        ` : ''}

        <div class="attr-grid mt-3">
          ${renderAttrBar('Striking', f.strikingScore)}
          ${renderAttrBar('Grappling', f.grapplingScore)}
          ${renderAttrBar('Cardio', f.attributes.cardio)}
          ${renderAttrBar('Fight IQ', f.attributes.fightIQ)}
        </div>

        <div class="grid grid-cols-3 gap-3 mt-3">
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
          <div>
            <div class="text-xs text-muted mb-1">Lealdade</div>
            <div class="progress-bar" style="height:6px">
              <div class="progress-fill ${f.loyalty >= 70 ? 'high' : f.loyalty >= 40 ? 'medium' : 'low'}" style="width:${f.loyalty}%"></div>
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

        <div class="mt-2 text-xs">
          ${f.promotionContract?.status === 'active'
            ? `<span class="text-muted">📋 ${f.promotionContract.promotionName} · ${f.promotionContract.fightsRemaining}/${f.promotionContract.fightsTotal} lutas</span>`
            : f.promotionContract?.status === 'expired'
              ? `<span class="text-warning">📋 Contrato expirado — aguardando renovação</span>`
              : `<span class="text-muted">📋 Sem contrato exclusivo</span>`
          }
        </div>

        <div class="mt-3">
          <button class="btn btn-sm btn-danger roster-release" data-id="${f.id}" data-name="${f.name}">Dispensar</button>
        </div>
      </div>
    `;
  }
}
