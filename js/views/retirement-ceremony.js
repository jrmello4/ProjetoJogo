import { formatDate, getWeightClassName, formatCurrency } from '../utils/helpers.js';
import { absWeekToDate } from '../config/game-config.js';

// §B.3 — Legado & documentário de carreira. Substitui a cerimônia genérica
// por um documentário em capítulos (Ascensão/Auge/Declínio/Legado) montado
// inteiramente a partir de dados já coletados durante a carreira jogada —
// nada aqui é texto fixo desconectado do save: cada frase carrega um número
// ou nome que veio de fighter.fights[]/permanentScars/discoveredTraits/
// careerLog/rivalries. Sem esses dados (save antigo, carreira curta), a
// seção correspondente simplesmente não aparece em vez de inventar algo.
//
// `ctx` (tudo opcional, montado por App.renderRetirementCeremony):
//   { fighter: Fighter|null,      // instância viva — o hallOfFame entry é só
//                                 // um snapshot na hora da indução (não tem
//                                 // fights[] completo, permanentScars, etc.)
//     topMoments: CareerLogEntry[], // careerLogService.topByMagnitude(fighterId, 8)
//     rivalryInfo: { rivalry, opponentName } | null,
//     startedAt: string|null }     // p/ converter atAbsWeek em data real

const NUMERIC_TRAIT_LABELS = {
  potential: 'Potencial',
  discipline: 'Disciplina',
  determination: 'Determinação',
};

const RIVALRY_TYPE_LABELS = {
  competitive: 'Rivalidade competitiva',
  personal: 'Rivalidade pessoal',
  grudge: 'Rivalidade de rancor',
  robbery: 'Rivalidade nascida de decisão controversa',
};

const MOMENT_ICONS = {
  title_won: '🏆',
  finish: '🥊',
  provocation: '📣',
  upset: '⚡',
  streak: '🔥',
  rematch: '🔁',
  dna_discovered: '🧬',
  permanent_scar: '🩹',
  academy_switch: '🏋️',
  manager_switch: '🤝',
  rivalry_born: '⚔️',
  weapon_revealed: '🧰',
  figured_out: '📖',
  reinvention: '🔄',
  bait_success: '🎣',
  weapon_seen_coming: '🥋',
  fought_friend: '💔',
  refused_friend: '🤝',
};

function humanizeType(type) {
  return String(type || '')
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Descreve uma entrada do careerLog em texto corrido. Cobre os tipos
// documentados no cabeçalho de career-log-service.js MAIS os que já existem
// de fato no código hoje ('finish', 'provocation') — qualquer tipo novo que
// outro sistema publique cai no fallback genérico, que nunca inventa nada:
// só lista os campos reais de `data`.
function describeMoment(entry) {
  const d = entry.data || {};
  switch (entry.type) {
    case 'title_won':
      return `${d.defense ? 'Defendeu' : 'Conquistou'} o cinturão${d.division ? ` ${d.division}` : ''}${d.promo ? ` do ${d.promo}` : ''}`;
    case 'finish':
      return `Finalizou ${d.opponentName || 'o adversário'}${d.method ? ` por ${d.method}` : ''}${d.promo ? ` no ${d.promo}` : ''}`;
    case 'provocation':
      return d.targetName ? `Provocou ${d.targetName} nas redes sociais` : 'Publicou uma provocação nas redes sociais';
    case 'upset':
      return `Zebra${d.opponentName ? ` sobre ${d.opponentName}` : ''}${typeof d.gap === 'number' ? ` (favorito por ${d.gap} pts de OVR)` : ''}`;
    case 'streak':
      return `Sequência de vitórias${typeof d.count === 'number' ? ` (${d.count} seguidas)` : ''}`;
    case 'rematch':
      return `Revanche${d.opponentName ? ` com ${d.opponentName}` : ''}`;
    case 'dna_discovered':
      return `Descobriu o traço "${d.traitLabel || d.trait || '?'}"`;
    case 'permanent_scar':
      return `Sequela permanente${d.bodyPart ? ` no(a) ${d.bodyPart}` : ''}`;
    case 'academy_switch':
      return `Trocou de academia${d.academyName ? ` para ${d.academyName}` : ''}`;
    case 'manager_switch':
      return `Trocou de empresário${d.managerName ? ` para ${d.managerName}` : ''}`;
    case 'rivalry_born':
      return `Nasceu uma rivalidade${d.opponentName ? ` com ${d.opponentName}` : ''}`;
    // O Livro Sobre Você — os três momentos que dão um segundo ato à carreira:
    // ser decifrado, mostrar algo novo, e voltar outro lutador.
    case 'weapon_revealed':
      return `Mostrou ${d.plan || 'uma arma nova'} pela primeira vez — e ninguém estava esperando`;
    case 'figured_out':
      return `O mundo abriu o livro: adversários passaram a ler ${d.signature || 'seu jogo'} antes do gongo`;
    case 'reinvention':
      return 'Reinventou-se depois de ser decifrado — voltou outro lutador';
    case 'bait_success':
      return `Iscou o adversário${d.plan ? `, que entrou preparado para ${d.plan}` : ''}`;
    // A sala de treino viva — o que o tatame cobra fora da luta.
    case 'weapon_seen_coming':
      return `Mostrou ${d.plan || 'a arma nova'} para quem já a tinha visto nascer no treino${d.opponentName ? ` — ${d.opponentName}` : ''}`;
    case 'fought_friend':
      return `Aceitou lutar contra ${d.partnerName || 'um parceiro de treino'}`;
    case 'refused_friend':
      return `Recusou lutar contra ${d.partnerName || 'um parceiro de treino'}`;
    default: {
      const parts = Object.entries(d)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${k}: ${v}`);
      return `${humanizeType(entry.type)}${parts.length ? ' — ' + parts.join(' · ') : ''}`;
    }
  }
}

function weekLabel(absWeek, startedAt) {
  if (typeof absWeek !== 'number') return '';
  if (startedAt) {
    try {
      return formatDate(absWeekToDate(absWeek, startedAt).toISOString());
    } catch (e) { /* startedAt inválido — cai no fallback abaixo */ }
  }
  return `Semana ${absWeek}`;
}

// fights[] é mais-recente-primeiro (unshift em SimulationEngine) — inverte
// pra ordem cronológica real, do primeiro pro último combate.
function chronologicalFights(fighter) {
  return [...(fighter?.fights || [])].reverse();
}

function computeAscensao(fighter) {
  const chrono = chronologicalFights(fighter);
  if (chrono.length === 0) return null;

  const firstFight = chrono[0];
  const firstWin = chrono.find(f => f.won === true) || null;
  // record.wins+losses+draws conta TODAS as lutas da carreira; fights[] é
  // limitado às últimas 50 (ver SimulationEngine._updateFighter). Se a
  // carreira foi mais longa que isso, a "primeira luta" aqui é a mais antiga
  // que ainda sobrou no registro, não necessariamente a estreia real —
  // melhor avisar isso do que fingir que é.
  const truncated = (fighter.totalFights || 0) > (fighter.fights?.length || 0);

  return { firstFight, firstWin, truncated };
}

function computeAuge(fighter) {
  const chrono = chronologicalFights(fighter);

  const rated = chrono.filter(f => typeof f.fighterRating === 'number');
  const peak = rated.length > 0
    ? rated.reduce((best, f) => (f.fighterRating > best.fighterRating ? f : best), rated[0])
    : null;

  let upset = null;
  for (const f of chrono) {
    if (f.won !== true) continue;
    if (typeof f.opponentRating !== 'number' || typeof f.fighterRating !== 'number') continue;
    const gap = f.opponentRating - f.fighterRating;
    if (gap > 0 && (!upset || gap > upset.gap)) upset = { fight: f, gap };
  }

  // Maior sequência de vitórias da carreira toda (não só a atual, ver
  // Fighter.winStreak) — varre em ordem cronológica pra também saber QUANDO
  // ela aconteceu (empate/derrota quebra a sequência, igual à convenção já
  // usada em HallOfFame.induct()).
  let current = 0, currentStart = 0, best = 0, bestStart = -1, bestEnd = -1;
  chrono.forEach((f, i) => {
    if (f.won === true) {
      if (current === 0) currentStart = i;
      current++;
      if (current > best) { best = current; bestStart = currentStart; bestEnd = i; }
    } else {
      current = 0;
    }
  });
  const streak = best > 0 ? { count: best, from: chrono[bestStart], to: chrono[bestEnd] } : null;

  return { peak, upset, streak };
}

function computeLegado(fighter) {
  if (!fighter) return { boolTraits: [], numericTraits: [] };
  const boolTraits = (fighter.dnaTraits || []).filter(t => fighter.isDiscovered(t.key));
  const numericTraits = Object.keys(NUMERIC_TRAIT_LABELS)
    .filter(k => fighter.isDiscovered(k))
    .map(k => ({ key: k, label: NUMERIC_TRAIT_LABELS[k], value: fighter.hidden?.[k] }))
    .filter(t => typeof t.value === 'number');
  return { boolTraits, numericTraits };
}

export class RetirementCeremonyView {
  static render(entry, ctx = {}) {
    const fighter = ctx.fighter || null;
    const topMoments = ctx.topMoments || [];
    const rivalryInfo = ctx.rivalryInfo || null;
    const startedAt = ctx.startedAt || null;

    const stats = entry.careerStats || {};
    const totalFights = (stats.finishes || 0) + (stats.decisions?.length || 0);

    const ascensao = computeAscensao(fighter);
    const auge = computeAuge(fighter);
    const scars = fighter?.permanentScars || [];
    const legado = computeLegado(fighter);

    // Frase de abertura — só concatena fatos reais (adversário de estreia,
    // cinturões, recorde final), nunca flavor text solto.
    const heroLine = (() => {
      const parts = [];
      if (ascensao?.firstFight) parts.push(`estreou como profissional contra ${ascensao.firstFight.opponent}`);
      if ((stats.titlesWon || 0) > 0) parts.push(`conquistou ${stats.titlesWon} cinturão${stats.titlesWon > 1 ? 'ões' : ''}`);
      parts.push(`encerrou a carreira com ${entry.record.wins}-${entry.record.losses}-${entry.record.draws}`);
      return `${entry.name} ${parts.join(', ')}.`;
    })();

    // ===== Capítulo 1: Ascensão =====
    const ascensaoHtml = `
      <div class="card mt-4">
        <div class="card-header">
          <span class="card-title">🌱 Capítulo 1 — Ascensão</span>
        </div>
        ${ascensao ? `
          <div class="grid grid-cols-2 gap-4" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
            <div>
              <div class="text-xs text-muted">Estreia profissional</div>
              <div class="text-sm font-bold">vs ${ascensao.firstFight.opponent}</div>
              <div class="text-xs text-muted">${formatDate(ascensao.firstFight.date)} · ${ascensao.firstFight.result} por ${ascensao.firstFight.method}</div>
            </div>
            ${ascensao.firstWin ? `
            <div>
              <div class="text-xs text-muted">Primeira vitória</div>
              <div class="text-sm font-bold">vs ${ascensao.firstWin.opponent}</div>
              <div class="text-xs text-muted">${formatDate(ascensao.firstWin.date)} · ${ascensao.firstWin.method} (R${ascensao.firstWin.round})</div>
            </div>` : `
            <div>
              <div class="text-xs text-muted">Primeira vitória</div>
              <div class="text-sm text-muted">Não há vitória registrada no início da carreira</div>
            </div>`}
          </div>
          ${ascensao.truncated ? `
            <div class="text-xs text-muted mt-3">📼 O registro detalhado guarda só as últimas ${fighter.fights.length} lutas — a carreira teve ${fighter.totalFights} no total, então esta é a estreia mais antiga que ainda restou no arquivo, não necessariamente a real.</div>
          ` : ''}
        ` : `
          <div class="empty-state"><p>Sem lutas registradas no início da carreira.</p></div>
        `}
      </div>
    `;

    // ===== Capítulo 2: Auge =====
    const augeHtml = `
      <div class="card mt-4">
        <div class="card-header">
          <span class="card-title">⭐ Capítulo 2 — Auge</span>
        </div>
        <div class="grid grid-cols-2 gap-4" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
          ${auge.peak ? `
          <div>
            <div class="text-xs text-muted">OVR de pico</div>
            <div class="font-bold text-lg">${auge.peak.fighterRating}</div>
            <div class="text-xs text-muted">vs ${auge.peak.opponent} · ${formatDate(auge.peak.date)}</div>
          </div>` : `
          <div>
            <div class="text-xs text-muted">OVR de pico</div>
            <div class="text-sm text-muted">Sem histórico de OVR por luta neste save</div>
          </div>`}

          ${auge.upset ? `
          <div>
            <div class="text-xs text-muted">Maior zebra</div>
            <div class="font-bold text-lg">+${auge.upset.gap} pts</div>
            <div class="text-xs text-muted">venceu ${auge.upset.fight.opponent} (OVR ${auge.upset.fight.opponentRating} vs seu ${auge.upset.fight.fighterRating}) · ${formatDate(auge.upset.fight.date)}</div>
          </div>` : `
          <div>
            <div class="text-xs text-muted">Maior zebra</div>
            <div class="text-sm text-muted">Nenhuma vitória sobre um favorito registrada</div>
          </div>`}

          ${auge.streak ? `
          <div>
            <div class="text-xs text-muted">Maior sequência de vitórias</div>
            <div class="font-bold text-lg">${auge.streak.count}</div>
            <div class="text-xs text-muted">${formatDate(auge.streak.from.date)} → ${formatDate(auge.streak.to.date)}</div>
          </div>` : `
          <div>
            <div class="text-xs text-muted">Maior sequência de vitórias</div>
            <div class="text-sm text-muted">Nenhuma sequência registrada</div>
          </div>`}

          <div>
            <div class="text-xs text-muted">Cinturões conquistados</div>
            <div class="font-bold text-lg">${stats.titlesWon || 0}</div>
          </div>
        </div>

        ${stats.belts?.length > 0 ? `
          <div class="mt-3" style="border-top:1px solid var(--border);padding-top:0.75rem">
            <div class="text-xs text-muted mb-2">Cinturões na hora da aposentadoria</div>
            <div class="flex gap-2 flex-wrap">
              ${stats.belts.map(b => `<span class="badge badge-warning" style="font-size:0.7rem">${b.promotionShort || b.name} — ${getWeightClassName(b.weightClass)}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // ===== Capítulo 3: Declínio =====
    const declinioHtml = `
      <div class="card mt-4">
        <div class="card-header">
          <span class="card-title">🩹 Capítulo 3 — Declínio</span>
        </div>
        ${scars.length > 0 ? `
          <div class="flex flex-col gap-2">
            ${scars.map(s => `
              <div class="flex items-center justify-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
                <div>
                  <span class="text-sm">🩹 ${s.bodyPart.charAt(0).toUpperCase() + s.bodyPart.slice(1)}</span>
                  <div class="text-xs text-muted">${weekLabel(s.atAbsWeek, startedAt)}</div>
                </div>
                <div class="text-xs text-muted" style="text-align:right">
                  <div>${Object.entries(s.attributeCeilings || {}).map(([k, v]) => `${k} ${v}`).join(' · ')}</div>
                  ${s.compensation && Object.keys(s.compensation).length > 0 ? `<div class="text-success">compensação: ${Object.entries(s.compensation).map(([k, v]) => `${k} +${v}`).join(' · ')}</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
          <div class="text-xs text-muted mt-2">Sequelas reduzem o teto de evolução dos atributos acima pro resto da carreira — a dor de cada uma virou parte do estilo de luta.</div>
        ` : `
          <div class="empty-state"><p>Carreira encerrada sem nenhuma sequela permanente registrada.</p></div>
        `}
      </div>
    `;

    // ===== Capítulo 4: Legado =====
    const traitsHtml = (legado.boolTraits.length > 0 || legado.numericTraits.length > 0)
      ? `
        <div class="flex gap-2 flex-wrap">
          ${legado.boolTraits.map(t => `<span class="badge badge-info">${t.label}</span>`).join('')}
          ${legado.numericTraits.map(t => `<span class="badge badge-info">${t.label}: ${t.value}</span>`).join('')}
        </div>
      `
      : `<div class="text-xs text-muted">Nenhum traço de DNA foi revelado durante esta carreira.</div>`;

    const rivalryHtml = rivalryInfo ? `
      <div class="mt-3" style="border-top:1px solid var(--border);padding-top:0.75rem">
        <div class="text-xs text-muted mb-1">Maior rivalidade</div>
        <div class="text-sm font-bold">vs ${rivalryInfo.opponentName}</div>
        <div class="text-xs text-muted">${RIVALRY_TYPE_LABELS[rivalryInfo.rivalry.type] || humanizeType(rivalryInfo.rivalry.type)} · intensidade ${rivalryInfo.rivalry.intensity}/10</div>
      </div>
    ` : '';

    const momentsHtml = topMoments.length > 0 ? `
      <div class="mt-3" style="border-top:1px solid var(--border);padding-top:0.75rem">
        <div class="text-xs text-muted mb-2">Momentos marcantes</div>
        <div class="timeline">
          ${topMoments.map(m => `
            <div class="timeline-item">
              <div class="timeline-date">${weekLabel(m.atAbsWeek, startedAt)}</div>
              <div class="timeline-content">
                <span class="text-sm">${MOMENT_ICONS[m.type] || '📌'} ${describeMoment(m)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    const legadoHtml = `
      <div class="card mt-4">
        <div class="card-header">
          <span class="card-title">📜 Capítulo 4 — Legado</span>
        </div>
        <div class="grid grid-cols-2 gap-4" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
          <div>
            <div class="text-xs text-muted">Ganhos na carreira</div>
            <div class="font-bold text-lg">${formatCurrency(fighter?.careerEarnings ?? stats.careerEarnings ?? 0)}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Recorde final</div>
            <div class="font-bold text-lg">${entry.record.wins}-${entry.record.losses}-${entry.record.draws}</div>
          </div>
        </div>

        <div class="mt-3" style="border-top:1px solid var(--border);padding-top:0.75rem">
          <div class="text-xs text-muted mb-2">DNA revelado ao longo da carreira</div>
          ${traitsHtml}
        </div>

        ${rivalryHtml}
        ${momentsHtml}
      </div>
    `;

    return `
      <div class="page-header">
        <h2>🏆 Aposentadoria</h2>
        <p>${entry.name} pendurou as luvas</p>
      </div>

      <div class="card" style="text-align:center;padding:2rem;background:linear-gradient(135deg,var(--bg),#1a1a2e);border:2px solid var(--belt)">
        <div style="font-size:3rem;margin-bottom:0.5rem">🏆</div>
        <h1 style="font-size:1.75rem;margin-bottom:0.25rem">${entry.name}</h1>
        <p class="text-muted">${getWeightClassName(entry.weightClass)} · ${entry.nationality} · ${stats.ageAtInduction} anos</p>

        <div class="grid grid-cols-3 gap-3" style="max-width:400px;margin:1.5rem auto">
          <div>
            <div class="stat-value">${entry.record.wins}-${entry.record.losses}-${entry.record.draws}</div>
            <div class="text-xs text-muted">Recorde</div>
          </div>
          <div>
            <div class="stat-value">${entry.peakRating}</div>
            <div class="text-xs text-muted">OVR na Aposentadoria</div>
          </div>
          <div>
            <div class="stat-value">${(stats.titlesWon || 0)}</div>
            <div class="text-xs text-muted">Cinturões</div>
          </div>
        </div>

        <p class="text-muted" style="max-width:500px;margin:1rem auto">${heroLine}</p>

        <div style="margin-top:1.5rem">
          <button class="btn btn-secondary" id="viewFullCareerBtn" data-fighter-id="${entry.fighterId}">Ver Carreira Completa</button>
          <button class="btn btn-secondary" id="backToHallBtn" style="margin-left:0.5rem">Hall da Fama</button>
        </div>
      </div>

      <!-- Destaques da carreira -->
      <div class="card mt-4">
        <div class="card-header">
          <span class="card-title">📊 Estatísticas da Carreira</span>
        </div>
        <div class="grid grid-cols-2 gap-4 mt-2" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
          <div>
            <div class="text-xs text-muted">Lutas Totais</div>
            <div class="font-bold text-lg">${totalFights}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Finalizações</div>
            <div class="font-bold text-lg">${stats.finishes || 0} (${stats.finishRate || 0}%)</div>
          </div>
          <div>
            <div class="text-xs text-muted">Nocaute/TKO</div>
            <div class="font-bold text-lg">${stats.kos?.length || 0}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Finalizações (Sub)</div>
            <div class="font-bold text-lg">${stats.subs?.length || 0}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Decisões</div>
            <div class="font-bold text-lg">${stats.decisions?.length || 0}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Maior Streak</div>
            <div class="font-bold text-lg">${stats.maxWinStreak || 0}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Bônus de Luta</div>
            <div class="font-bold text-lg">${(stats.fightNightBonuses || 0) + (stats.performanceBonuses || 0)}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Induzido ao Hall da Fama</div>
            <div class="font-bold text-lg">${formatDate(entry.inductionDate)}</div>
          </div>
        </div>
      </div>

      ${ascensaoHtml}
      ${augeHtml}
      ${declinioHtml}
      ${legadoHtml}

      ${(entry.achievements || []).length > 0 ? `
      <div class="card mt-4">
        <div class="card-header">
          <span class="card-title">🏅 Conquistas</span>
        </div>
        <div class="flex gap-1 flex-wrap mt-2">
          ${entry.achievements.map(a => `
            <span class="badge badge-success" style="font-size:0.7rem">${a}</span>
          `).join('')}
        </div>
      </div>` : ''}
    `;
  }
}
