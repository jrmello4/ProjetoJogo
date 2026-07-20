import { formatCurrency, formatDate, formatDateShort, getWeightClassName, e } from '../utils/helpers.js';
import { TIER_LABELS, CORNER_INSTRUCTIONS, MILESTONE_LABELS } from '../config/game-config.js';

// Visão do mundo: calendário das promoções de IA e resultados dos eventos.
// O jogador não cria eventos — ele coloca atletas nos cards via Ofertas.
export class EventsView {
  static render(promotions, pastEvents, bookings, now) {
    const tierBadge = (tier) => {
      const cls = tier === 1 ? 'badge-danger' : tier === 2 ? 'badge-warning' : 'badge-info';
      return `<span class="badge ${cls}">${TIER_LABELS[tier]}</span>`;
    };

    const upcomingHtml = `
      <div class="section-label" data-reveal>Calendário</div>
      <div class="card mb-4" data-reveal>
        <div class="card-header">
          <span class="card-title">Próximos Eventos</span>
        </div>
        <div data-reveal-stagger>
          ${promotions.map(p => {
            const weeksOut = (p.nextEventAbsWeek || 0) - now;
            const eventBookings = Array.isArray(bookings) ? bookings.filter(b => b.promotionId === p.id && b.eventAbsWeek === p.nextEventAbsWeek) : [];
            return `
              <div style="padding:0.75rem 0;border-bottom:1px solid var(--border)">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    ${tierBadge(p.tier)}
                    <span class="font-bold">${e(p.nextEventName ? p.nextEventName() : p.name || 'Evento')}</span>
                    <span class="text-xs text-muted">${e(p.name)}</span>
                  </div>
                  <span class="badge ${weeksOut <= 0 ? 'badge-danger' : 'badge-warning'}">${weeksOut <= 0 ? 'esta semana' : `em ${weeksOut} sem`}</span>
                </div>
                ${eventBookings.map(b => `
                  <div class="text-xs mt-1" style="color:var(--gold)">🥊 Seu atleta no card: vs ${e(b.opponentName)} — bolsa ${formatCurrency(b.purse)}</div>
                `).join('')}
              </div>
            `;
          }).join('')}
        </div>
        <div class="text-xs text-muted mt-2">Eventos acontecem automaticamente ao avançar a semana. Feche lutas na aba Ofertas para colocar seus atletas nos cards.</div>
      </div>
    `;

    const pastHtml = pastEvents.length === 0 ? `
      <div class="empty-state"><p>Nenhum evento realizado ainda. O mundo do MMA está em silêncio — avance a semana para o primeiro evento.</p></div>
    ` : `
      <div class="section-label" data-reveal>Resultados</div>
      <div class="table-container" data-reveal>
        <table>
          <thead>
            <tr>
              <th>Evento</th>
              <th>Promoção</th>
              <th>Data</th>
              <th>Lutas</th>
              <th>Luta Principal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${pastEvents.map(ev => {
              const main = ev.results?.[0];
              return `
                <tr>
                  <td class="font-bold">${e(ev.name)}</td>
                  <td class="text-xs">${e(ev.promotionName || '—')}</td>
                  <td>${formatDateShort(ev.date)}</td>
                  <td>${ev.totalFights}</td>
                  <td class="text-xs">${main ? (main.isDraw ? `Empate (${e(main.method)})` : `${e(main.winnerName)} venceu por ${e(main.method)}`) : '—'}</td>
                  <td><button class="btn btn-sm btn-secondary event-details" data-id="${ev.id}">Ver card</button></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    return `
      <div class="page-header">
        <h2>O Mundo do MMA</h2>
        <p>As promoções realizam eventos toda semana — acompanhe onde seus atletas podem brilhar</p>
      </div>

      ${upcomingHtml}
      ${pastHtml}
    `;
  }

  static renderLiveSimulation(event, results, playerFighterIds = new Set()) {
    const isFinish = (m) => m && !m.startsWith('Decision');

    const fightsHtml = (results || []).map((r, i) => {
      const aWon = r.winnerId === r.fighterAId;
      const bWon = r.winnerId === r.fighterBId;
      const finish = isFinish(r.method);
      const aIsPlayer = playerFighterIds.has(r.fighterAId);
      const bIsPlayer = playerFighterIds.has(r.fighterBId);

      const lead = (a, b) => a > b ? ['tot-lead', ''] : b > a ? ['', 'tot-lead'] : ['', ''];
      const [strA, strB] = r.stats ? lead(r.stats.sigStrikesA, r.stats.sigStrikesB) : ['', ''];
      const [tdA, tdB] = r.stats ? lead(r.stats.takedownsA, r.stats.takedownsB) : ['', ''];
      const [kdA, kdB] = r.stats ? lead(r.stats.knockdownsA, r.stats.knockdownsB) : ['', ''];
      const [subA, subB] = r.stats ? lead(r.stats.subAttemptsA, r.stats.subAttemptsB) : ['', ''];

      return `
        <div class="card mb-2 live-fight ${aIsPlayer || bIsPlayer ? 'live-fight--player' : ''} ${r.isTitleFight ? 'live-fight--title' : ''}" data-live-index="${i}">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              ${r.isTitleFight
                ? `<span class="badge badge-warning"><span class="belt-mark">🏆</span> Cinturão ${getWeightClassName(r.titleWeightClass)}</span>`
                : `<span class="badge ${r.card === 'main' ? 'badge-info' : 'badge-warning'}">${r.card === 'main' ? 'Card Principal' : 'Preliminar'}</span>`}
              ${aIsPlayer || bIsPlayer ? '<span class="badge badge-success" style="font-size:0.6rem">SUA ACADEMIA</span>' : ''}
            </div>
            <span class="text-xs text-muted">Luta ${i + 1} de ${results.length}</span>
          </div>

          <div class="live-vs-card">
            <div class="live-corner live-corner--red ${aWon ? 'live-corner--winner' : ''}">
              <div class="live-corner-name">${aWon ? '🏆 ' : ''}${r.fighterAName}</div>
              <div class="live-corner-record">${aIsPlayer ? 'Sua academia' : 'Córner vermelho'}</div>
            </div>
            <span class="live-vs">VS</span>
            <div class="live-corner live-corner--blue ${bWon ? 'live-corner--winner' : ''}">
              <div class="live-corner-name">${bWon ? '🏆 ' : ''}${r.fighterBName}</div>
              <div class="live-corner-record">${bIsPlayer ? 'Sua academia' : 'Córner azul'}</div>
            </div>
          </div>

          <div class="live-method ${finish ? 'live-method--finish' : ''}">
            ${r.isDraw
              ? `<strong>Empate</strong> — <strong>${e(r.method)}</strong>`
              : `<strong>${r.winnerName}</strong> vence por <strong>${e(r.method)}</strong> no round ${r.round}`}
          </div>

          <table class="tale-of-tape">
            <tr><td class="${strA}">${r.stats?.sigStrikesA ?? 0}</td><td>Golpes significativos</td><td class="${strB}">${r.stats?.sigStrikesB ?? 0}</td></tr>
            <tr><td class="${tdA}">${r.stats?.takedownsA ?? 0}</td><td>Quedas</td><td class="${tdB}">${r.stats?.takedownsB ?? 0}</td></tr>
            <tr><td class="${kdA}">${r.stats?.knockdownsA ?? 0}</td><td>Knockdowns</td><td class="${kdB}">${r.stats?.knockdownsB ?? 0}</td></tr>
            <tr><td class="${subA}">${r.stats?.subAttemptsA ?? 0}</td><td>Tentativas de finalização</td><td class="${subB}">${r.stats?.subAttemptsB ?? 0}</td></tr>
          </table>
        </div>
      `;
    }).join('');

    return `
      <div class="page-header">
        <h2>${e(event.name)}</h2>
        <p>${formatDate(event.date)} — transmissão do evento</p>
      </div>

      <div class="live-banner">
        <span class="live-dot"></span>
        <span class="live-label">Ao Vivo</span>
        <span class="live-status" id="liveStatus">Abrindo o octógono...</span>
        <button class="btn btn-sm btn-secondary skip-live" id="skipLiveBtn">Pular para o resultado</button>
      </div>

      <div id="liveFights">${fightsHtml}</div>

      <div class="live-fight" id="liveSummary">
        <div class="flex gap-2">
          <button class="btn btn-primary event-back">Voltar ao Dashboard</button>
          <button class="btn btn-secondary" onclick="window.dispatchEvent(new CustomEvent('navigate',{detail:{view:'rankings'}}))">Ver Rankings</button>
        </div>
      </div>
    `;
  }

  static renderSimulation(event, results, playerFighterIds = new Set()) {
    return `
      <div class="page-header">
        <h2>${e(event.name)}</h2>
        <p>${e(event.promotionName || '')} — Resultados de ${formatDate(event.date)}</p>
      </div>

      <div class="mb-4">
        ${(results || []).map((r, i) => {
          const isPlayer = playerFighterIds.has(r.fighterAId) || playerFighterIds.has(r.fighterBId);
          return `
          <div class="card mb-2 fight-result-card" style="cursor:pointer${isPlayer ? ';border-left:3px solid var(--gold)' : ''}" data-expand="fight-${i}">
            <div class="flex items-center justify-between mb-2">
              <div>
                <span class="badge ${r.card === 'main' ? 'badge-info' : 'badge-warning'}">${r.card === 'main' ? 'Main Card' : 'Prelim'}</span>
                ${isPlayer ? '<span class="badge badge-success" style="font-size:0.6rem;margin-left:0.25rem">SUA ACADEMIA</span>' : ''}
                <span class="text-xs text-muted ml-2">${e(r.method)} · R${r.round}</span>
                ${r.isDraw ? '<span class="badge badge-warning" style="font-size:0.6rem;margin-left:0.25rem">EMPATE</span>' : ''}
              </div>
              <span class="text-xs text-muted">Clique para detalhes ▼</span>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2" style="flex:1">
                <span class="font-bold ${r.winnerId === r.fighterAId ? 'text-success' : ''}">${r.fighterAName}</span>
                ${r.winnerId === r.fighterAId ? '<span class="badge badge-success" style="font-size:0.65rem">VENCEDOR</span>' : ''}
              </div>
              <span class="text-muted" style="font-size:0.8rem">vs</span>
              <div class="flex items-center gap-2" style="flex:1;justify-content:flex-end">
                ${r.winnerId === r.fighterBId ? '<span class="badge badge-success" style="font-size:0.65rem">VENCEDOR</span>' : ''}
                <span class="font-bold ${r.winnerId === r.fighterBId ? 'text-success' : ''}">${r.fighterBName}</span>
              </div>
            </div>

            <div id="fight-${i}" style="display:none;margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">
              ${r.rounds ? `
              <div class="mb-3">
                <div class="text-xs font-bold mb-1" style="text-transform:uppercase;letter-spacing:0.05em">Scorecards por Round</div>
                <table style="width:100%;font-size:0.8rem">
                  <thead>
                    <tr>
                      <th style="text-align:left">Round</th>
                      <th style="text-align:center">${r.fighterAName}</th>
                      <th style="text-align:center">${r.fighterBName}</th>
                      <th style="text-align:center">Destaque</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${r.rounds.map(rd => `
                      <tr>
                        <td style="text-align:left">${rd.round}</td>
                        <td style="text-align:center;font-weight:bold;color:${rd.scoreA > rd.scoreB ? 'var(--success)' : ''}">${rd.scoreA}</td>
                        <td style="text-align:center;font-weight:bold;color:${rd.scoreB > rd.scoreA ? 'var(--success)' : ''}">${rd.scoreB}</td>
                        <td style="text-align:center;font-size:0.75rem">
                          ${rd.knockdownsA > 0 ? '🔴 KD' : ''}
                          ${rd.knockdownsB > 0 ? '🔵 KD' : ''}
                          ${rd.subAttemptsA > 0 ? '🔴 Sub' : ''}
                          ${rd.subAttemptsB > 0 ? '🔵 Sub' : ''}
                          ${rd.finished ? '💥 Finalização' : ''}
                          ${!rd.knockdownsA && !rd.knockdownsB && !rd.subAttemptsA && !rd.subAttemptsB && !rd.finished ? '—' : ''}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              ` : ''}

              ${r.stats ? `
              <div>
                <div class="text-xs font-bold mb-1" style="text-transform:uppercase;letter-spacing:0.05em">Estatísticas da Luta</div>
                <div class="grid grid-cols-2 gap-2" style="font-size:0.8rem">
                  <div class="card" style="padding:0.5rem">
                    <div class="font-bold">${r.fighterAName}</div>
                    <div class="text-muted">Golpes: ${r.stats.sigStrikesA}</div>
                    <div class="text-muted">Quedas: ${r.stats.takedownsA}</div>
                    <div class="text-muted">KDs: ${r.stats.knockdownsA}</div>
                    <div class="text-muted">Subs: ${r.stats.subAttemptsA}</div>
                  </div>
                  <div class="card" style="padding:0.5rem">
                    <div class="font-bold">${r.fighterBName}</div>
                    <div class="text-muted">Golpes: ${r.stats.sigStrikesB}</div>
                    <div class="text-muted">Quedas: ${r.stats.takedownsB}</div>
                    <div class="text-muted">KDs: ${r.stats.knockdownsB}</div>
                    <div class="text-muted">Subs: ${r.stats.subAttemptsB}</div>
                  </div>
                </div>
              </div>
              ` : ''}
            </div>
          </div>
        `;
        }).join('')}
      </div>

      <div class="flex gap-2 mt-4">
        <button class="btn btn-primary event-back">Voltar ao Mundo</button>
      </div>
    `;
  }

  // ===== Instruções de córner ao vivo (Fase 3) =====

  static renderCornerFightIntro(fighter, opponent, promoName) {
    return `
      <div class="page-header">
        <h2>${promoName}</h2>
        <p>Sua luta está prestes a começar — acompanhe ao vivo e comande o córner</p>
      </div>

      <div class="live-banner">
        <span class="live-dot"></span>
        <span class="live-label">Ao Vivo</span>
        <span class="live-status">Round 1 prestes a começar...</span>
      </div>

      <div class="card live-fight live-fight--shown">
        <div class="live-vs-card">
          <div class="live-corner live-corner--red">
            <div class="live-corner-name">${e(fighter.name)}</div>
            <div class="live-corner-record">Sua Academia · ${fighter.record.wins}-${fighter.record.losses}-${fighter.record.draws}</div>
          </div>
          <span class="live-vs">VS</span>
          <div class="live-corner live-corner--blue">
            <div class="live-corner-name">${e(opponent.name)}</div>
            <div class="live-corner-record">${opponent.record.wins}-${opponent.record.losses}-${opponent.record.draws}</div>
          </div>
        </div>
      </div>
    `;
  }

  // `suggested`: chave de CORNER_INSTRUCTIONS sugerida pelo técnico da
  // Academia atual para o PRÓXIMO round (§C.2 — já passou pelo embaralho de
  // sinergia em CornerAdvice antes de chegar aqui; esta view só destaca).
  static renderCornerRound({ fighterName, opponentName, round, roundResult, totalScoreA, totalScoreB, cardA, cardB, suggested = null }) {
    // Cartões oficiais (10-point must acumulado). Fallback pra performance
    // bruta só em chamadas antigas que não passam cardA/cardB.
    const cA = cardA ?? totalScoreA;
    const cB = cardB ?? totalScoreB;
    const leading = cA === cB
      ? 'Tudo igual nos cartões'
      : cA > cB
        ? `${fighterName} está na frente nos cartões`
        : `${opponentName} está na frente nos cartões`;

    // Whoever won the stat takes it in chalk. A blank column lost it.
    const row = (label, a, b) => {
      const lead = (x, y) => (x > y ? 'tot-lead' : '');
      return `<tr>
        <td class="${lead(a, b)}">${a}</td>
        <td>${label}</td>
        <td class="${lead(b, a)}">${b}</td>
      </tr>`;
    };

    return `
      <div class="live-banner">
        <span class="live-dot"></span>
        <span class="live-label">Ao Vivo</span>
        <span class="live-status">Round ${round} encerrado · ${leading}</span>
      </div>

      <div class="page-header">
        <h2>Fim do Round ${round}</h2>
        <p>Cartões parciais: ${cA} — ${cB}</p>
      </div>

      <table class="tale-of-tape mb-4">
        <thead>
          <tr>
            <th class="tot-red">${fighterName}</th>
            <th>Round ${round}</th>
            <th class="tot-blue">${opponentName}</th>
          </tr>
        </thead>
        <tbody>
          ${row('Golpes significativos', roundResult.sigStrikesA, roundResult.sigStrikesB)}
          ${row('Quedas', roundResult.takedownsA, roundResult.takedownsB)}
          ${row('Knockdowns', roundResult.knockdownsA, roundResult.knockdownsB)}
          ${row('Tentativas de finalização', roundResult.subAttemptsA, roundResult.subAttemptsB)}
        </tbody>
      </table>

      <div class="section-label">Instruções de córner para o round ${round + 1}</div>
      <div class="corner-choice-grid">
        ${Object.entries(CORNER_INSTRUCTIONS).map(([key, meta]) => `
          <button class="card corner-choice${key === suggested ? ' corner-choice--suggested' : ''}" data-instruction="${key}">
            ${key === suggested ? '<div class="corner-choice-tag">Sugestão do técnico</div>' : ''}
            <div class="corner-choice-icon">${meta.icon}</div>
            <div class="corner-choice-label">${e(meta.label)}</div>
            <div class="corner-choice-desc text-xs text-muted">${e(meta.desc)}</div>
          </button>
        `).join('')}
        <button class="card corner-choice corner-choice--instinct" data-instruction="instinct">
          <div class="corner-choice-icon">🧭</div>
          <div class="corner-choice-label">Lutar no Instinto</div>
          <div class="corner-choice-desc text-xs text-muted">Ignora o córner. Vale sua própria composição e leitura de jogo.</div>
        </button>
      </div>
    `;
  }

  // ===== Resumo de período (simular meses/anos de uma vez) =====

  static renderPeriodSummary(result) {
    if (!result) return '<div class="empty-state"><p>Nenhum resultado disponível.</p></div>';
    const { weeksSimulated, offersAccepted, cashDelta, popularityDelta, winsDelta, lossesDelta, fightResults = [], milestonesUnlocked = [] } = result;

    const fightsHtml = fightResults.length === 0
      ? '<div class="empty-state"><p>Nenhuma luta sua durante o período — só o tempo passou.</p></div>'
      : fightResults.map(f => `
          <div class="flex items-center justify-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
            <div>
              <span class="badge ${f.won === true ? 'badge-success' : f.won === null ? 'badge-warning' : 'badge-danger'}">${f.won === true ? 'VITÓRIA' : f.won === null ? 'EMPATE' : 'DERROTA'}</span>
              <span class="text-xs text-muted"> vs ${e(f.opponentName)} · ${e(f.method)} · ${e(f.promoName)}</span>
            </div>
          </div>
        `).join('');

    const milestonesHtml = milestonesUnlocked.length === 0 ? '' : `
      <div class="section-label" data-reveal>Conquistas Desbloqueadas</div>
      <div class="card mb-4" data-reveal>
        ${milestonesUnlocked.map(id => `<div class="text-sm" style="padding:0.4rem 0">${MILESTONE_LABELS[id] || id}</div>`).join('')}
      </div>
    `;

    return `
      <div class="page-header">
        <h2>Resumo do Período</h2>
        <p>${weeksSimulated} semana${weeksSimulated === 1 ? '' : 's'} simulada${weeksSimulated === 1 ? '' : 's'} · ${offersAccepted} oferta${offersAccepted === 1 ? '' : 's'} de luta aceita${offersAccepted === 1 ? '' : 's'} automaticamente</p>
      </div>

      <div class="grid grid-cols-4 mb-4" data-reveal-stagger>
        <div class="card stat-card">
          <div class="card-header"><span class="card-title">Caixa</span></div>
          <div class="stat-value ${cashDelta >= 0 ? 'text-success' : 'text-danger'}" style="font-size:1.6rem">${cashDelta >= 0 ? '+' : ''}${formatCurrency(cashDelta)}</div>
        </div>
        <div class="card stat-card">
          <div class="card-header"><span class="card-title">Popularidade</span></div>
          <div class="stat-value ${popularityDelta >= 0 ? 'text-success' : 'text-danger'}">${popularityDelta >= 0 ? '+' : ''}${popularityDelta}</div>
        </div>
        <div class="card stat-card">
          <div class="card-header"><span class="card-title">Cartel no Período</span></div>
          <div class="stat-value">${winsDelta}-${lossesDelta}</div>
        </div>
        <div class="card stat-card">
          <div class="card-header"><span class="card-title">Conquistas</span></div>
          <div class="stat-value">${milestonesUnlocked.length}</div>
        </div>
      </div>

      ${milestonesHtml}

      <div class="section-label" data-reveal>Suas Lutas no Período</div>
      <div class="card mb-4" data-reveal>
        ${fightsHtml}
      </div>

      <button class="btn btn-primary summary-back">Voltar ao Dashboard</button>
    `;
  }
}

// Intro do combate por cartas (Fase 1 — ver CombatAdapter/App#runCardFight).
// Puramente aditivo: não substitui renderCornerFightIntro, que continua
// servindo o fluxo de luta ao vivo padrão.
export function renderCardFightIntro(container, fighterA, fighterB) {
  container.innerHTML = `
    <div class="fight-intro">
      <div class="fighter-card">
        <div class="fighter-name red">${e(fighterA.name)}</div>
        <div class="fighter-record">${fighterA.record?.wins || 0}V ${fighterA.record?.losses || 0}D</div>
      </div>
      <div class="vs-badge">VS</div>
      <div class="fighter-card">
        <div class="fighter-name blue">${e(fighterB.name)}</div>
        <div class="fighter-record">${fighterB.record?.wins || 0}V ${fighterB.record?.losses || 0}D</div>
      </div>
    </div>
  `;
}
