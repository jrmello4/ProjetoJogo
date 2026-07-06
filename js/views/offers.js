import { formatCurrency, getWeightClassShort } from '../utils/helpers.js';
import { TIER_LABELS, NEGOTIATION_CONFIG } from '../config/game-config.js';
import { OFFER_STATUS } from '../models/fight-offer.js';

const STATUS_LABELS = {
  [OFFER_STATUS.COMPLETED]: { label: 'Realizada', cls: 'badge-success' },
  [OFFER_STATUS.DECLINED]: { label: 'Recusada', cls: 'badge-warning' },
  [OFFER_STATUS.EXPIRED]: { label: 'Expirada', cls: 'badge-danger' },
  [OFFER_STATUS.CANCELLED]: { label: 'Cancelada', cls: 'badge-danger' },
};

export class OffersView {
  static render(pending, accepted, history, team, now) {
    const fighterOf = (o) => team.find(f => f.id === o.fighterId);

    const tierBadge = (tier) => {
      const cls = tier === 1 ? 'badge-danger' : tier === 2 ? 'badge-warning' : 'badge-info';
      return `<span class="badge ${cls}">${TIER_LABELS[tier]}</span>`;
    };

    const pendingHtml = pending.length === 0
      ? `<div class="empty-state"><p>Nenhuma oferta na mesa. Avance a semana — promoções procuram lutadores ativos e descansados.</p></div>`
      : pending.map(o => {
          const fighter = fighterOf(o);
          const weeksToFight = o.eventAbsWeek - now;
          const weeksToExpire = o.expiresAbsWeek - now;
          const risky = fighter && o.opponentOverall != null && o.opponentOverall - fighter.overallRating >= 5;
          return `
            <div class="card mb-2" data-reveal style="border-top-color:${o.tier === 1 ? 'var(--accent)' : o.tier === 2 ? 'var(--gold,#d4a843)' : 'var(--border)'}">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  ${tierBadge(o.tier)}
                  <span class="font-bold">${o.promotionName}</span>
                </div>
                <span class="badge ${weeksToExpire <= 1 ? 'badge-danger' : 'badge-warning'}">expira em ${weeksToExpire} sem</span>
              </div>

              <div class="live-vs-card mb-2">
                <div class="live-corner live-corner--red">
                  <div class="live-corner-name">${fighter ? fighter.name : '—'}</div>
                  <div class="live-corner-record">${fighter ? `${fighter.record.wins}-${fighter.record.losses}-${fighter.record.draws} · OVR ${fighter.overallRating}` : ''}</div>
                </div>
                <span class="live-vs">VS</span>
                <div class="live-corner live-corner--blue">
                  <div class="live-corner-name">${o.opponentName}</div>
                  <div class="live-corner-record">${o.opponentRecord ? `${o.opponentRecord.wins}-${o.opponentRecord.losses}-${o.opponentRecord.draws}` : ''} · OVR ${o.opponentOverall ?? '?'} · ${o.opponentStyle || ''}</div>
                </div>
              </div>

              <div class="flex items-center justify-between" style="flex-wrap:wrap;gap:0.5rem">
                <div class="flex items-center gap-3">
                  <div>
                    <div class="text-xs text-muted">Bolsa</div>
                    <div class="text-sm font-bold" style="color:var(--success)">${formatCurrency(o.purse)}</div>
                  </div>
                  <div>
                    <div class="text-xs text-muted">Bônus de vitória</div>
                    <div class="text-sm font-bold">${formatCurrency(o.winBonus)}</div>
                  </div>
                  <div>
                    <div class="text-xs text-muted">Luta em</div>
                    <div class="text-sm font-bold">${weeksToFight} semana${weeksToFight === 1 ? '' : 's'}</div>
                  </div>
                  <div>
                    <div class="text-xs text-muted">Divisão</div>
                    <div class="text-sm font-bold">${getWeightClassShort(o.weightClass)}</div>
                  </div>
                </div>
                <div class="flex gap-2">
                  <button class="btn btn-sm btn-success offer-accept" data-id="${o.id}">Aceitar Luta</button>
                  <button class="btn btn-sm btn-secondary offer-decline" data-id="${o.id}">Recusar</button>
                </div>
              </div>
              ${risky ? '<div class="text-xs mt-2" style="color:var(--accent)">⚠️ Adversário mais forte no papel — risco alto, recompensa de reputação maior.</div>' : ''}
              ${fighter && fighter.fatigue >= 40 ? '<div class="text-xs mt-1" style="color:var(--gold,#d4a843)">⚡ Seu atleta ainda carrega fadiga — considere o tempo de recuperação.</div>' : ''}

              ${o.negotiated
                ? '<div class="text-xs text-muted mt-2">Bolsa já negociada nesta oferta.</div>'
                : `
                  <div class="mt-2">
                    <button class="btn btn-sm btn-secondary negotiate-toggle" data-id="${o.id}">💬 Negociar Bolsa</button>
                    <div class="negotiate-panel" data-panel="${o.id}" style="display:none">
                      ${NEGOTIATION_CONFIG.BUMP_OPTIONS.map((b, i) => `
                        <button class="btn btn-sm btn-primary negotiate-option" data-id="${o.id}" data-bump="${i}">Pedir +${Math.round(b * 100)}%</button>
                      `).join('')}
                    </div>
                  </div>
                `
              }
            </div>
          `;
        }).join('');

    const acceptedHtml = accepted.length === 0 ? '' : `
      <div class="section-label mt-4">Lutas Confirmadas</div>
      ${accepted.map(o => {
        const fighter = fighterOf(o);
        const weeksOut = o.eventAbsWeek - now;
        return `
          <div class="card mb-2" data-reveal>
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm font-bold">${fighter ? fighter.name : '—'} vs ${o.opponentName}</div>
                <div class="text-xs text-muted">${o.promotionName} · ${formatCurrency(o.purse)} + ${formatCurrency(o.winBonus)} por vitória</div>
              </div>
              <span class="badge ${weeksOut <= 1 ? 'badge-danger' : 'badge-warning'}">${weeksOut <= 0 ? 'Esta semana!' : `em ${weeksOut} sem`}</span>
            </div>
          </div>
        `;
      }).join('')}
    `;

    const historyHtml = history.length === 0 ? '' : `
      <div class="section-label mt-4">Histórico</div>
      <div class="card" data-reveal>
        ${history.map(o => {
          const st = STATUS_LABELS[o.status] || { label: o.status, cls: 'badge-info' };
          return `
            <div class="flex items-center justify-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
              <div class="text-sm">${o.opponentName} <span class="text-xs text-muted">· ${o.promotionName} · ${formatCurrency(o.purse)}</span></div>
              <span class="badge ${st.cls}">${st.label}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    return `
      <div class="page-header">
        <h2>Ofertas de Luta</h2>
        <p>Promoções enviam propostas para seus atletas — escolha as lutas certas</p>
      </div>

      ${pendingHtml}
      ${acceptedHtml}
      ${historyHtml}
    `;
  }
}
