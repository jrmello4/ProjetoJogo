import { formatCurrency, getWeightClassShort, getWeightClassName, renderAttrRange, e } from '../utils/helpers.js';
import { TIER_LABELS, NEGOTIATION_CONFIG, TITLE_ROLE, GAME_PLANS, CARD_POSITION } from '../config/game-config.js';
import { OFFER_STATUS } from '../models/fight-offer.js';
import { PortraitService } from '../services/portrait-service.js';
import { deriveScoutingReads } from '../services/scouting-report.js';

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
  // Prontidão (item 4) — o número que decide a luta equilibrada. Mostrado
  // com a MESMA conta que a simulação vai usar na noite do evento: cada
  // tela que o jogador ignorou aparece aqui como pontos deixados na mesa.
  static _renderReadiness(rd) {
    if (!rd) return '';
    const cls = rd.player >= 60 ? 'badge-success' : rd.player >= 45 ? 'badge-warning' : 'badge-danger';
    const barColor = rd.player >= 60 ? 'var(--success)' : rd.player >= 45 ? 'var(--gold)' : 'var(--danger)';

    const chip = (p) => {
      const zero = p.value === 0;
      const sign = p.value > 0 ? '+' : '';
      const style = p.value < 0
        ? 'color:var(--danger)'
        : zero ? 'color:var(--text-muted)' : 'color:var(--success)';
      return `<span class="text-xs" style="${style}">${e(p.label)}: ${sign}${p.value}${p.key === 'camp' ? `/${p.max}` : ''}</span>`;
    };

    const oppHtml = rd.opponentKnown
      ? `Prontidão dele: <strong>~${e(rd.opponent)}%</strong> (${e(rd.opponentLabel)})`
      : `Prontidão dele: <strong>?</strong> — estude-o para descobrir`;

    return `
      <div class="dossier mb-3" style="border-left:3px solid ${barColor}">
        <div class="dossier-header">
          <span class="dossier-title">🎯 Prontidão para esta luta</span>
          <span class="badge ${cls}">${rd.player}%</span>
        </div>
        <div class="mt-2" style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">
          <div style="width:${rd.player}%;height:100%;background:${barColor}"></div>
        </div>
        <div class="flex mt-2" style="flex-wrap:wrap;gap:0.35rem 0.85rem">
          ${rd.parts.map(chip).join('')}
        </div>
        <p class="text-xs text-muted mt-2">${oppHtml}. O gap de preparo multiplica sua performance em TODOS os rounds.</p>
      </div>
    `;
  }

  // Fase 3 — o espelho do dossiê. Até aqui o scouting era via de mão única:
  // você estudava, o mundo nunca te estudava. Este bloco é o mundo te
  // devolvendo o olhar.
  static _renderTheirRead(offer, r) {
    if (!r) return '';

    const exposureCls = r.exposure >= 75 ? 'badge-danger' : r.exposure >= 50 ? 'badge-warning' : 'badge-info';
    const sig = r.signature && GAME_PLANS[r.signature]
      ? `<span class="badge badge-warning">Assinatura: ${GAME_PLANS[r.signature].label}</span>`
      : '<span class="badge badge-success">Imprevisível — não há o que counter-ar</span>';

    const prediction = r.predictedPlanKey && GAME_PLANS[r.predictedPlanKey]
      ? `<p class="text-sm mt-2">
           O córner dele deve trazer <strong>${GAME_PLANS[r.predictedPlanKey].label}</strong>.
           ${r.reliable
             ? '<span class="text-xs text-muted">Sua equipe confia nessa leitura.</span>'
             : '<span class="text-xs" style="color:var(--warning)">⚠️ Sua equipe não tem certeza. Pode estar errado.</span>'}
         </p>`
      : '<p class="text-sm text-muted mt-2">Você não faz ideia do que ele preparou. Estude-o para saber o que ele sabe.</p>';

    const weapon = r.weapon && GAME_PLANS[r.weapon.planKey]
      ? `<p class="text-xs mt-2" style="color:var(--gold)">
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

  // Fase 6 — o dossiê como relatório profissional: quanto você CONHECE vs o
  // que ainda é ????, ameaças do adversário e oportunidades contra ele, com o
  // grau de confiança da leitura (indício/provável/confirmado). A informação
  // nunca é perfeita — é isso que gera tensão na escolha do plano.
  static _renderScoutingReads(reads) {
    if (!reads) return '';
    const known = reads.coveragePct;
    const confBadge = reads.level > 0
      ? `<span class="badge ${reads.level >= 3 ? 'badge-success' : reads.level === 2 ? 'badge-warning' : 'badge-info'}">${e(reads.confidence)}</span>`
      : '';
    const list = (items) => items.length === 0
      ? '<li class="scout-empty">????</li>'
      : items.map(t => `<li>${e(t)}</li>`).join('');
    const unknownLine = reads.unknown.length
      ? `<div class="scout-unknown">🕵️ Ainda oculto: ${reads.unknown.map(u => e(u)).join(' · ')}</div>`
      : '';
    return `
      <div class="scout-reads mt-3">
        <div class="scout-coverage">
          <div class="scout-coverage-head">
            <span class="scout-coverage-label">Conhecido</span>
            <span class="text-xs text-muted">${known}% · desconhecido ${100 - known}%</span>
            ${confBadge}
          </div>
          <div class="scout-bar"><div class="scout-bar-fill" style="width:${known}%"></div></div>
        </div>
        <div class="scout-grid mt-2">
          <div class="scout-col scout-col--threats">
            <div class="scout-col-title">⚔️ Ameaças</div>
            <ul>${list(reads.threats)}</ul>
          </div>
          <div class="scout-col scout-col--opps">
            <div class="scout-col-title">🎯 Oportunidades</div>
            <ul>${list(reads.opportunities)}</ul>
          </div>
        </div>
        ${unknownLine}
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
      ? `<div class="dossier-reads mt-2">${d.dna.map(t => `<span class="badge badge-warning">${e(t.label)}</span>`).join('')}</div>`
      : '';

    return `
      <div class="dossier">
        <div class="dossier-header">
          <span class="dossier-title">Dossiê · ${e(offer.opponentName)}</span>
          <div class="flex items-center gap-2">
            <span class="badge ${d.level >= 2 ? 'badge-success' : d.level === 1 ? 'badge-warning' : 'badge-danger'}">${d.levelLabel}</span>
            ${studyBtn}
          </div>
        </div>

        <div class="attr-grid mt-3">
          ${d.attrs ? renderAttrRange('Striking', d.attrs.striking) : ''}
          ${d.attrs ? renderAttrRange('Grappling', d.attrs.grappling) : ''}
          ${d.attrs ? renderAttrRange('Cardio', d.attrs.cardio) : ''}
          ${d.attrs ? renderAttrRange('Queixo', d.attrs.chin) : ''}
        </div>

        <div class="mt-3">${tendencies}${dna}</div>
        ${this._renderScoutingReads(deriveScoutingReads(d))}
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
              <span class="plan-label">${e(plan.label)}</span>
              <span class="plan-desc">${e(plan.desc)}</span>
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
    if (!r?.signature || !GAME_PLANS[r.signature]) return '';

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

  // §Fase 3b — o dilema. A promoção não te oferece o seu parceiro de treino por
  // acaso: essa luta costuma ser a boa. O jogador precisa ver o preço ANTES de
  // clicar em aceitar, senão não é uma decisão — é uma pegadinha.
  static _renderTeammateWarning(t) {
    if (!t) return '';
    return `
      <div class="mt-2 p-2" style="border-left:3px solid var(--danger);background:color-mix(in srgb, var(--danger) 8%, transparent);border-radius:4px">
        <p class="text-sm"><strong>🥋 ${e(t.name)} treina com você.</strong> <span class="text-muted">${e(t.bondLabel)}.</span></p>
        <p class="text-xs text-muted mt-1">
          Aceitar acaba com o vínculo — e ele conhece o seu jogo por dentro, não pela fita.
          Recusar mantém o parceiro e devolve a luta para a promoção.
        </p>
      </div>
    `;
  }

  // Fase 1 — "O que está em jogo". Três colunas (RECOMPENSA / RISCO /
  // CONSEQUÊNCIA) traduzem o estado do jogo na decisão central do core loop:
  // o que conquisto, com o que entro, o que perco. Dados vêm de
  // computeFightStakes (fight-stakes.js); aqui só desenha.
  static _renderStakes(stakes) {
    if (!stakes) return '';
    const col = (title, cls, items) => `
      <div class="stakes-col stakes-col--${cls}">
        <div class="stakes-col-title">${title}</div>
        ${items.length === 0 ? '' : `<ul class="stakes-list">
          ${items.map(i => `<li><span class="stakes-icon">${i.icon}</span>${e(i.text)}</li>`).join('')}
        </ul>`}
      </div>`;
    return `
      <div class="stakes-block mt-2" data-reveal>
        <div class="stakes-header">⚖️ O que está em jogo</div>
        <div class="stakes-grid">
          ${col('Recompensa', 'reward', stakes.reward)}
          ${col('Risco', 'risk', stakes.risk)}
          ${col('Se perder', 'consequence', stakes.consequence)}
        </div>
      </div>
    `;
  }

  static render(pending, accepted, history, fighter, now, dossiers = {}, contractProposals = [], teammates = {}, rivalries = {}, readiness = {}, opponents = {}, stakes = {}) {
    const fighterOf = () => fighter;
    // Retrato do oponente — SEMPRE do lutador completo (opponents map);
    // sem ele, cai num placeholder de projeção só como último recurso.
    const opponentPortrait = (o, size) =>
      `<span class="portrait-frame offer-portrait">${PortraitService.renderFighter(opponents[o.opponentId] || { id: o.opponentId, name: o.opponentName }, { size })}</span>`;

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

          const titleLabel = o.titleRole === TITLE_ROLE.DEFENSE
            ? `Defesa de cinturão ${getWeightClassName(o.weightClass)}`
            : o.titleRole === TITLE_ROLE.VACANT
              ? `Cinturão ${getWeightClassName(o.weightClass)} vago`
              : `Disputa de cinturão ${getWeightClassName(o.weightClass)}`;

          return `
            <div class="card mb-2 ${o.isTitleFight ? 'offer-card--title' : ''}" data-reveal ${o.isTitleFight ? '' : `style="border-top-color:${o.tier === 1 ? 'var(--accent)' : o.tier === 2 ? 'var(--gold)' : 'var(--border)'}"`}>
              ${o.isTitleFight ? `<div class="offer-title-strap"><span class="belt-mark">🏆</span> ${titleLabel}</div>` : ''}
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  ${tierBadge(o.tier)}
                  <span class="font-bold">${e(o.promotionName)}</span>
                  <span class="badge ${CARD_POSITION[o.cardPosition]?.badge || 'badge-secondary'}">${CARD_POSITION[o.cardPosition]?.shortLabel || 'Prelim'}</span>
                  ${o.isShortNotice ? '<span class="badge badge-warning" style="margin-left:0.25rem">🔥 Short Notice</span>' : ''}
                  ${o.isSuperFight ? '<span class="badge badge-danger" style="margin-left:0.25rem">⭐ Super Fight</span>' : ''}
                  ${o.opponentWeightBully ? '<span class="badge badge-warning" style="margin-left:0.25rem">⚠️ Corta Peso Pesado</span>' : ''}
                </div>
                <span class="badge ${weeksToExpire <= 1 ? 'badge-danger' : 'badge-warning'}">expira em ${weeksToExpire} sem</span>
              </div>

              <div class="live-vs-card mb-2">
                <div class="live-corner live-corner--red">
                  <div class="live-corner-name">${fighter ? e(fighter.name) : '—'}</div>
                  <div class="live-corner-record">${fighter ? `${fighter.record.wins}-${fighter.record.losses}-${fighter.record.draws} · OVR ${fighter.overallRating}` : ''}</div>
                </div>
                <span class="live-vs">VS</span>
                <div class="live-corner live-corner--blue">
                  <div class="flex items-center gap-2" style="justify-content:flex-end">
                    ${opponentPortrait(o, 32)}
                    <div class="live-corner-name">${e(o.opponentName)}${rivalries[o.id] ? ` <span class="badge badge-danger" style="font-size:0.6rem">⚔️ RIVAL · ${rivalries[o.id].label}</span>` : ''}</div>
                  </div>
                  <div class="live-corner-record">${o.opponentRecord ? `${o.opponentRecord.wins}-${o.opponentRecord.losses}-${o.opponentRecord.draws}` : ''} · OVR ${o.opponentOverall ?? '?'} · ${e(o.opponentStyle || '')}</div>
                </div>
              </div>
              ${rivalries[o.id] ? `<div class="text-xs mt-1" style="color:var(--danger)">⚔️ Ele te leu melhor — rivalidade ${rivalries[o.id].label.toLowerCase()} deixa seu jogo mais previsível pra ele, mas a bolsa também sobe.</div>` : ''}

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
                  ${o.isShortNotice ? '<div class="text-xs mt-1" style="color:var(--gold);width:100%">⚡ Aviso curto: apenas 2-3 semanas de camp. A bolsa já inclui o bônus de última hora.</div>' : ''}
                  ${o.opponentWeightBully ? '<div class="text-xs mt-1" style="color:var(--warning);width:100%">⚠️ Ele corta muito peso — chega bem maior no dia da luta (mais poder, mais fadiga acumulada).</div>' : ''}
                  <div>
                    <div class="text-xs text-muted">Divisão</div>
                    <div class="text-sm font-bold">${getWeightClassShort(o.weightClass)}</div>
                  </div>
                </div>
                ${this._renderTeammateWarning(teammates[o.id])}
                <div class="flex gap-2">
                  <button class="btn btn-sm btn-success offer-accept" data-id="${o.id}">Aceitar Luta</button>
                  <button class="btn btn-sm btn-secondary offer-decline" data-id="${o.id}">Recusar</button>
                </div>
              </div>
              ${this._renderStakes(stakes[o.id])}

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

    // P7.x — grid de comparação. Só aparece com 2+ ofertas na mesa: uma
    // oferta só já tem o card detalhado embaixo, comparar contra nada não
    // ajuda ninguém. Reaproveita as MESMAS classes/data-id de accept/decline
    // dos cards de baixo — os listeners de app.js já fazem
    // querySelectorAll('.offer-accept') a cada render, então não precisa de
    // wiring novo.
    const comparisonHtml = pending.length < 2 ? '' : `
      <div class="section-label" data-reveal>⚖️ Comparar Ofertas</div>
      <div class="card mb-4" data-reveal style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:${Math.max(480, pending.length * 170)}px">
          <thead>
            <tr>
              <th style="text-align:left;padding:0.5rem;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase"></th>
              ${pending.map(o => `<th style="padding:0.5rem;text-align:center;min-width:150px;border-bottom:1px solid var(--border)">${e(o.opponentName)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-xs text-muted" style="padding:0.5rem">Promoção</td>
              ${pending.map(o => `<td style="text-align:center;padding:0.5rem">${tierBadge(o.tier)} <span class="text-xs">${e(o.promotionName)}</span></td>`).join('')}
            </tr>
            <tr>
              <td class="text-xs text-muted" style="padding:0.5rem">Adversário</td>
              ${pending.map(o => `<td style="text-align:center;padding:0.5rem;font-size:0.8rem">${o.opponentRecord ? `${o.opponentRecord.wins}-${o.opponentRecord.losses}-${o.opponentRecord.draws}` : '—'} · OVR ${o.opponentOverall ?? '?'}${o.opponentStyle ? `<br>${e(o.opponentStyle)}` : ''}</td>`).join('')}
            </tr>
            <tr>
              <td class="text-xs text-muted" style="padding:0.5rem">Bolsa</td>
              ${pending.map(o => `<td style="text-align:center;padding:0.5rem;color:var(--success);font-weight:bold">${formatCurrency(o.purse)}</td>`).join('')}
            </tr>
            <tr>
              <td class="text-xs text-muted" style="padding:0.5rem">Bônus vitória</td>
              ${pending.map(o => `<td style="text-align:center;padding:0.5rem">${formatCurrency(o.winBonus)}</td>`).join('')}
            </tr>
            <tr>
              <td class="text-xs text-muted" style="padding:0.5rem">Luta em</td>
              ${pending.map(o => `<td style="text-align:center;padding:0.5rem">${o.eventAbsWeek - now} sem</td>`).join('')}
            </tr>
            <tr>
              <td class="text-xs text-muted" style="padding:0.5rem">Posição no card</td>
              ${pending.map(o => `<td style="text-align:center;padding:0.5rem"><span class="badge ${CARD_POSITION[o.cardPosition]?.badge || 'badge-secondary'}">${CARD_POSITION[o.cardPosition]?.shortLabel || 'Prelim'}</span></td>`).join('')}
            </tr>
            <tr>
              <td class="text-xs text-muted" style="padding:0.5rem">Avisos</td>
              ${pending.map(o => {
                const tags = [
                  o.isTitleFight ? '🏆 Título' : '',
                  o.isSuperFight ? '⭐ Super Fight' : '',
                  o.isShortNotice ? '🔥 Short Notice' : '',
                  o.opponentWeightBully ? '⚠️ Corta Peso' : '',
                  rivalries[o.id] ? `⚔️ ${rivalries[o.id].label}` : '',
                ].filter(Boolean);
                return `<td style="text-align:center;padding:0.5rem;font-size:0.7rem">${tags.length ? tags.join('<br>') : '<span class="text-muted">—</span>'}</td>`;
              }).join('')}
            </tr>
            <tr>
              <td></td>
              ${pending.map(o => `
                <td style="text-align:center;padding:0.5rem">
                  <div class="flex gap-1" style="justify-content:center">
                    <button class="btn btn-sm btn-success offer-accept" data-id="${o.id}">Aceitar</button>
                    <button class="btn btn-sm btn-secondary offer-decline" data-id="${o.id}">Recusar</button>
                  </div>
                </td>
              `).join('')}
            </tr>
          </tbody>
        </table>
      </div>
    `;

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
              <div class="flex items-center gap-2">
                ${opponentPortrait(o, 36)}
                <div>
                  <div class="text-sm font-bold">${o.isTitleFight ? '<span class="belt-mark">🏆</span> ' : ''}${fighter ? e(fighter.name) : '—'} vs ${e(o.opponentName)}${o.isReencounter ? ' <span class="badge badge-danger" style="font-size:0.65rem">⚔️ REENCONTRO</span>' : ''}${o.isShortNotice ? ' <span class="badge badge-warning" style="font-size:0.65rem">🔥 Short Notice</span>' : ''}${o.isSuperFight ? ' <span class="badge badge-danger" style="font-size:0.65rem">⭐ Super Fight</span>' : ''}${o.opponentWeightBully ? ' <span class="badge badge-warning" style="font-size:0.65rem">⚠️ Corta Peso Pesado</span>' : ''}${rivalries[o.id] ? ` <span class="badge badge-danger" style="font-size:0.65rem">⚔️ RIVAL · ${e(rivalries[o.id].label)}</span>` : ''}</div>
                  <div class="text-xs text-muted">${e(o.promotionName)} · ${formatCurrency(o.purse)} + ${formatCurrency(o.winBonus)} por vitória</div>
                </div>
              </div>
              <span class="badge ${weeksOut <= 1 ? 'badge-danger' : 'badge-warning'}">${weeksOut <= 0 ? 'Esta semana!' : `em ${weeksOut} sem`}</span>
            </div>

            ${this._renderReadiness(readiness[o.id])}
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
              <div class="text-sm">${e(o.opponentName)} <span class="text-xs text-muted">· ${e(o.promotionName)} · ${formatCurrency(o.purse)}</span></div>
              <span class="badge ${st.cls}">${e(st.label)}</span>
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
              <span class="font-bold">${e(cp.promotionName)}</span>
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
            <button class="btn btn-sm btn-success contract-accept" data-fighter="${cp.fighterId}" data-promo="${cp.promotionId}" data-promo-name="${e(cp.promotionName)}">Aceitar Contrato</button>
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
      ${comparisonHtml}
      ${pendingHtml}
      ${acceptedHtml}
      ${historyHtml}
    `;
  }
}
