import { formatCurrency, getWeightClassShort, getWeightClassName, renderAttrRange } from '../utils/helpers.js';
import { TIER_LABELS, NEGOTIATION_CONFIG, TITLE_ROLE, GAME_PLANS } from '../config/game-config.js';
import { OFFER_STATUS } from '../models/fight-offer.js';

const STATUS_LABELS = {
  [OFFER_STATUS.COMPLETED]: { label: 'Realizada', cls: 'badge-success' },
  [OFFER_STATUS.DECLINED]: { label: 'Recusada', cls: 'badge-warning' },
  [OFFER_STATUS.EXPIRED]: { label: 'Expirada', cls: 'badge-danger' },
  [OFFER_STATUS.CANCELLED]: { label: 'Cancelada', cls: 'badge-danger' },
};

const ARCHETYPE_LABELS = {
  striker: 'Trocador',
  grappler: 'Grappler',
  mixed: 'Completo',
  highCardio: 'Cardio de sobra',
  lowCardio: 'Cardio frágil',
  midCardio: 'Cardio mediano',
  highIq: 'Lê a luta',
  lowIq: 'Impulsivo',
  midIq: 'Leitura mediana',
};

export class OffersView {
  // Fase 3 — o espelho do dossiê. Até aqui o scouting era via de mão única:
  // você estudava, o mundo nunca te estudava. Este bloco é o mundo te
  // devolvendo o olhar.
  static _renderTheirRead(offer, r) {
    if (!r) return '';

    const exposureCls = r.exposure >= 75 ? 'badge-danger' : r.exposure >= 50 ? 'badge-warning' : 'badge-info';
    const sig = r.signature
      ? `<span class="badge badge-warning">Assinatura: ${GAME_PLANS[r.signature].label}</span>`
      : '<span class="badge badge-success">Imprevisível — não há o que counter-ar</span>';

    const prediction = r.predictedPlanKey
      ? `<p class="text-sm mt-2">
           O córner dele deve trazer <strong>${GAME_PLANS[r.predictedPlanKey].label}</strong>.
           ${r.reliable
             ? '<span class="text-xs text-muted">Sua equipe confia nessa leitura.</span>'
             : '<span class="text-xs" style="color:var(--warning)">⚠️ Sua equipe não tem certeza. Pode estar errado.</span>'}
         </p>`
      : '<p class="text-sm text-muted mt-2">Você não faz ideia do que ele preparou. Estude-o para saber o que ele sabe.</p>';

    const weapon = r.weapon
      ? `<p class="text-xs mt-2" style="color:var(--gold,#d4a843)">
           🧰 Carta na manga: <strong>${GAME_PLANS[r.weapon.planKey].label}</strong> (${Math.round(r.weapon.mastery)}% instalada).
           Ninguém sabe que você tem isso — mas só funciona uma vez.
         </p>`
      : '';

    return `
      <div class="dossier mt-3" style="border-left:3px solid var(--warning)">
        <div class="dossier-header">
          <span class="dossier-title">📖 O que eles sabem sobre você</span>
          <span class="badge ${exposureCls}">${r.exposureLabel} · ${r.exposure}%</span>
        </div>
        <div class="dossier-reads mt-2">${sig}</div>
        ${prediction}
        ${weapon}
      </div>
    `;
  }

  // Dossiê do adversário. Sem estudar, tudo é faixa larga e ninguém sabe
  // como ele luta — e aí o plano de jogo vira aposta.
  static _renderDossier(offer, d) {
    const studyBtn = d.level >= 3
      ? '<span class="text-xs text-muted">Nada mais a descobrir.</span>'
      : `<button class="btn btn-sm btn-secondary study-opponent" data-id="${offer.id}" ${d.canAfford ? '' : 'disabled'}>
           🔍 Estudar — ${formatCurrency(d.nextCost)}
         </button>`;

    const tendencies = d.tendencies
      ? `<div class="dossier-reads">
           <span class="badge badge-info">${ARCHETYPE_LABELS[d.tendencies.archetype]}</span>
           <span class="badge badge-info">${ARCHETYPE_LABELS[d.tendencies.cardio]}</span>
           <span class="badge badge-info">${ARCHETYPE_LABELS[d.tendencies.iq]}</span>
         </div>`
      : '<div class="text-xs text-muted">Sem informação sobre como ele luta. Estude-o antes de escolher o plano.</div>';

    const dna = d.dna && d.dna.length > 0
      ? `<div class="dossier-reads mt-2">${d.dna.map(t => `<span class="badge badge-warning">${t.label}</span>`).join('')}</div>`
      : '';

    return `
      <div class="dossier">
        <div class="dossier-header">
          <span class="dossier-title">Dossiê · ${offer.opponentName}</span>
          <div class="flex items-center gap-2">
            <span class="badge ${d.level >= 2 ? 'badge-success' : d.level === 1 ? 'badge-warning' : 'badge-danger'}">${d.levelLabel}</span>
            ${studyBtn}
          </div>
        </div>

        <div class="attr-grid mt-3">
          ${renderAttrRange('Striking', d.attrs.striking)}
          ${renderAttrRange('Grappling', d.attrs.grappling)}
          ${renderAttrRange('Cardio', d.attrs.cardio)}
          ${renderAttrRange('Queixo', d.attrs.chin)}
        </div>

        <div class="mt-3">${tendencies}${dna}</div>
      </div>
      ${this._renderTheirRead(offer, d.theirRead)}
    `;
  }

  // Plano de jogo. O acerto ou erro de leitura vale mais que qualquer
  // instrução de córner — e você escolhe sem saber, se não estudou.
  static _renderGamePlan(offer, d) {
    const current = offer.gamePlan || 'balanced';
    const read = d?.tendencies;

    const verdictOf = (plan) => {
      if (!read || (!plan.strongVs && !plan.weakVs)) return '';
      const traits = new Set([read.archetype, read.cardio, read.iq]);
      if (plan.strongVs && traits.has(plan.strongVs)) return '<span class="plan-verdict plan-verdict--good">Boa leitura</span>';
      if (plan.weakVs && traits.has(plan.weakVs)) return '<span class="plan-verdict plan-verdict--bad">Joga no jogo dele</span>';
      return '<span class="plan-verdict plan-verdict--neutral">Neutro</span>';
    };

    return `
      <div class="mt-3">
        <div class="text-xs text-muted mb-2" style="text-transform:uppercase;letter-spacing:0.1em">Plano de Jogo</div>
        <div class="plan-grid">
          ${Object.entries(GAME_PLANS).map(([key, plan]) => `
            <button class="plan-option ${current === key ? 'plan-option--active' : ''}" data-offer="${offer.id}" data-plan="${key}">
              <span class="plan-icon">${plan.icon}</span>
              <span class="plan-label">${plan.label}</span>
              <span class="plan-desc">${plan.desc}</span>
              ${verdictOf(plan)}
            </button>
          `).join('')}
        </div>
        ${!read ? '<div class="text-xs text-muted mt-2">⚠️ Você não estudou o adversário — está escolhendo no escuro.</div>' : ''}
        ${this._renderBait(offer, d?.theirRead)}
      </div>
    `;
  }

  // A isca. Só aparece quando você TEM uma assinatura pra fingir e escolheu um
  // plano que não é ela — fingir ser quem você já é não engana ninguém.
  static _renderBait(offer, r) {
    if (!r?.signature) return '';

    if (!r.canBait) {
      return `<div class="text-xs text-muted mt-3">
        🎣 Iscar exige trazer um plano diferente da sua assinatura (${GAME_PLANS[r.signature].label}).
      </div>`;
    }

    return `
      <div class="mt-3 p-2" style="border:1px dashed var(--warning);border-radius:6px">
        <label class="flex items-center gap-2 text-sm" style="cursor:pointer">
          <input type="checkbox" class="bait-toggle" data-offer="${offer.id}" ${r.bait ? 'checked' : ''}>
          <span><strong>🎣 Iscar</strong> — deixar que ele prepare a luta contra a sua assinatura, e trazer outra coisa.</span>
        </label>
        <p class="text-xs text-muted mt-1">
          Só paga se ele realmente te leu. Contra alguém que não te estudou, você só jogou fora o que sabe fazer.
          O sucesso depende da sua leitura de luta.
        </p>
      </div>
    `;
  }

  static render(pending, accepted, history, fighter, now, dossiers = {}, contractProposals = []) {
    const fighterOf = () => fighter;

    const tierBadge = (tier) => {
      const cls = tier === 1 ? 'badge-danger' : tier === 2 ? 'badge-warning' : 'badge-info';
      return `<span class="badge ${cls}">${TIER_LABELS[tier]}</span>`;
    };

    const pendingHtml = pending.length === 0
      ? `<div class="empty-state"><p>Silêncio no rádio hoje. Avance a semana — as promoções estão de olho em quem está treinando.</p></div>`
      : pending.map(o => {
          const fighter = fighterOf(o);
          const weeksToFight = o.eventAbsWeek - now;
          const weeksToExpire = o.expiresAbsWeek - now;
          const risky = fighter && o.opponentOverall != null && o.opponentOverall - fighter.overallRating >= 5;

          const titleLabel = o.titleRole === TITLE_ROLE.DEFENSE
            ? `Defesa de cinturão ${getWeightClassName(o.weightClass)}`
            : o.titleRole === TITLE_ROLE.VACANT
              ? `Cinturão ${getWeightClassName(o.weightClass)} vago`
              : `Disputa de cinturão ${getWeightClassName(o.weightClass)}`;

          return `
            <div class="card mb-2 ${o.isTitleFight ? 'offer-card--title' : ''}" data-reveal ${o.isTitleFight ? '' : `style="border-top-color:${o.tier === 1 ? 'var(--accent)' : o.tier === 2 ? 'var(--gold,#d4a843)' : 'var(--border)'}"`}>
              ${o.isTitleFight ? `<div class="offer-title-strap"><span class="belt-mark">🏆</span> ${titleLabel}</div>` : ''}
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

    // O camp: estudar o adversário e escolher o plano. É aqui que a luta
    // é ganha, antes de alguém dar o primeiro soco.
    const acceptedHtml = accepted.length === 0 ? '' : `
      <div class="section-label mt-4">Camp de Luta</div>
      ${accepted.map(o => {
        const fighter = fighterOf(o);
        const weeksOut = o.eventAbsWeek - now;
        const d = dossiers[o.id];
        return `
          <div class="card mb-2 ${o.isTitleFight ? 'offer-card--title' : ''}" data-reveal>
            <div class="flex items-center justify-between mb-3">
              <div>
                <div class="text-sm font-bold">${o.isTitleFight ? '<span class="belt-mark">🏆</span> ' : ''}${fighter ? fighter.name : '—'} vs ${o.opponentName}${o.isReencounter ? ' <span class="badge badge-danger" style="font-size:0.65rem">⚔️ REENCONTRO</span>' : ''}</div>
                <div class="text-xs text-muted">${o.promotionName} · ${formatCurrency(o.purse)} + ${formatCurrency(o.winBonus)} por vitória</div>
              </div>
              <span class="badge ${weeksOut <= 1 ? 'badge-danger' : 'badge-warning'}">${weeksOut <= 0 ? 'Esta semana!' : `em ${weeksOut} sem`}</span>
            </div>

            ${d ? this._renderDossier(o, d) : ''}
            ${this._renderGamePlan(o, d)}
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

    // Épico B: Propostas de contrato exclusivo
    const contractHtml = contractProposals.length === 0 ? '' : `
      <div class="section-label mt-4">Propostas de Contrato Exclusivo</div>
      <p class="text-xs text-muted mb-2">Aceitar um contrato vincula o atleta a uma promoção — ofertas de outras promoções deixam de aparecer.</p>
      ${contractProposals.map(cp => `
        <div class="card mb-2 offer-card--contract" data-reveal>
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              ${tierBadge(cp.tier)}
              <span class="font-bold">${cp.promotionName}</span>
            </div>
            <span class="badge badge-info">${cp.fightsTotal} lutas</span>
          </div>
          <div class="flex items-center gap-3 mb-2" style="flex-wrap:wrap">
            <div>
              <div class="text-xs text-muted">Bolsa por luta</div>
              <div class="text-sm font-bold" style="color:var(--success)">${formatCurrency(cp.basePurse)}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Bônus de vitória</div>
              <div class="text-sm font-bold">${formatCurrency(cp.winBonus)}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Cláusula de título</div>
              <div class="text-sm font-bold">${cp.titleClause ? 'Sim' : 'Não'}</div>
            </div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-success contract-accept" data-fighter="${cp.fighterId}" data-promo="${cp.promotionId}" data-promo-name="${cp.promotionName}">Aceitar Contrato</button>
            <button class="btn btn-sm btn-secondary contract-decline" data-fighter="${cp.fighterId}">Recusar</button>
          </div>
        </div>
      `).join('')}
    `;

    return `
      <div class="page-header">
        <h2>Ofertas de Luta</h2>
        <p>Promoções enviam propostas para seus atletas — escolha as lutas certas</p>
      </div>

      ${contractHtml}
      ${pendingHtml}
      ${acceptedHtml}
      ${historyHtml}
    `;
  }
}
